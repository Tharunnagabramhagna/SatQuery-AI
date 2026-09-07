"""Rule-based Query Classifier and Entity Extractor for Remote Sensing.

Implements BaseQueryClassifier using domain-specific regex patterns,
semantic keyword hierarchies, and spatial/temporal parsing.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.agents.query_understanding.base import BaseQueryClassifier
from backend.schemas.query_understanding import (
    ComparisonInfo,
    QueryIntent,
    SpatialInfo,
    StructuredQuery,
    TemporalInfo,
)


class RuleBasedQueryClassifier(BaseQueryClassifier):
    """
    Deterministic rule-based query classifier.
    Fast, interpretable, and reproducible baseline for the prototype.
    """

    # Remote Sensing Domain Vocabulary (for filtering out-of-domain queries)
    DOMAIN_KEYWORDS = {
        "satellite", "image", "imagery", "scene", "sensor", "optical", "sar", "radar",
        "sentinel", "landsat", "geospatial", "terrain", "remote sensing", "band", "resolution",
        "land use", "land cover", "ndvi", "lulc", "urban", "vegetation", "forest", "water",
        "building", "buildings", "road", "roads", "bridge", "bridges", "runway", "airport",
        "harbor", "port", "ship", "ships", "vessel", "vessels", "aircraft", "airplane",
        "airplanes", "tank", "tanks", "storage tank", "river", "lake", "ocean", "sea",
        "coast", "coastal", "field", "fields", "farm", "farmland", "agriculture", "crop",
        "solar", "turbine", "deforestation", "flood", "cloud", "shadow", "ground", "area",
    }

    # Entity Categories
    ENTITY_PATTERNS = {
        "buildings": [r"\bbuildings?\b", r"\bhouses?\b", r"\bstructures?\b", r"\broofs?\b", r"\bbuilt-up\b", r"\burban area\b"],
        "roads_infrastructure": [r"\broads?\b", r"\bhighways?\b", r"\bbridges?\b", r"\brunways?\b", r"\brailways?\b", r"\brailroads?\b"],
        "water_bodies": [r"\bwater bod(?:y|ies)\b", r"\brivers?\b", r"\blakes?\b", r"\boceans?\b", r"\bseas?\b", r"\bcanals?\b", r"\breservoirs?\b", r"\bcoastline\b"],
        "aircraft": [r"\bairplanes?\b", r"\baircrafts?\b", r"\bplanes?\b", r"\bjets?\b", r"\bhelicopters?\b"],
        "vessels": [r"\bships?\b", r"\bvessels?\b", r"\bboats?\b", r"\bcontainer ships?\b", r"\btankers?\b"],
        "storage_tanks": [r"\bstorage tanks?\b", r"\boil tanks?\b", r"\bfuel tanks?\b", r"\bsilos?\b"],
        "vegetation": [r"\bforests?\b", r"\btrees?\b", r"\bvegetation\b", r"\bagricultural\b", r"\bfarmland\b", r"\bcrops?\b", r"\bgrassland\b"],
        "vehicles": [r"\bvehicles?\b", r"\bcars?\b", r"\btrucks?\b"],
        "renewable_energy": [r"\bsolar panels?\b", r"\bsolar farms?\b", r"\bwind turbines?\b", r"\bwind farms?\b"],
    }

    # Spatial / Positional Vocabulary
    CARDINAL_DIRECTIONS = {
        "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
        "northern", "southern", "eastern", "western",
    }
    SPATIAL_LANDMARKS = {
        "harbor", "port", "airport", "coast", "coastal", "downtown", "center", "periphery",
        "suburb", "industrial zone", "waterfront", "shoreline",
    }

    async def classify(self, query: str) -> StructuredQuery:
        """Classify query and extract structured intelligence."""
        q_lower = query.lower().strip()

        # 1. Structured feature extractions
        target_objects = self._extract_target_objects(q_lower)
        temporal_info = self._extract_temporal(q_lower)
        spatial_info = self._extract_spatial(q_lower)
        comparison_info = self._extract_comparison(q_lower, temporal_info)
        modality_hint = self._extract_modality(q_lower)
        domain_relevance = self._calculate_domain_relevance(q_lower, target_objects)

        # 2. Check for underspecified query (e.g. just "buildings" or "airplanes")
        words = re.findall(r"\b\w+\b", q_lower)
        if len(words) <= 2 and target_objects and not any(
            w in q_lower for w in ["what", "where", "find", "locate", "detect", "how", "is", "are", "count", "compare"]
        ):
            return StructuredQuery(
                original_query=query,
                intent=QueryIntent.UNKNOWN,
                confidence=0.35,
                target_objects=target_objects,
                temporal=temporal_info,
                spatial=spatial_info,
                comparison=comparison_info,
                modality_hint=modality_hint,
                is_ambiguous=True,
                ambiguity_reason=f"Underspecified query consisting solely of entity name '{query.strip()}' without action or question.",
                extracted_attributes={"type": "isolated_entity"},
            )

        # 3. Check for out-of-domain / unknown queries
        if domain_relevance == 0.0 and self._is_completely_out_of_domain(q_lower):
            return StructuredQuery(
                original_query=query,
                intent=QueryIntent.UNKNOWN,
                confidence=0.95,
                target_objects=[],
                temporal=temporal_info,
                spatial=spatial_info,
                comparison=comparison_info,
                modality_hint=modality_hint,
                is_ambiguous=False,
                ambiguity_reason=None,
                extracted_attributes={"type": "out_of_domain"},
            )

        # 4. Score candidate intents
        scores: Dict[QueryIntent, float] = {
            QueryIntent.CHANGE_DETECTION: 0.0,
            QueryIntent.COMPARISON: 0.0,
            QueryIntent.GROUNDING: 0.0,
            QueryIntent.VQA: 0.0,
        }

        # --- Change Detection Scoring ---
        change_patterns = [
            (r"\b(?:what|any)\s+changed\b", 4.0),
            (r"\bchange\s+detection\b", 4.0),
            (r"\bchanges?\s+between\b", 4.0),
            (r"\bchanged\s+between\b", 4.0),
            (r"\burban\s+expansion\b", 3.5),
            (r"\bdeforestation\b", 3.5),
            (r"\b(?:new|recent)\s+(?:buildings?|construction|structures?)\s+(?:built|developed|added)\b", 4.0),
            (r"\bdid\s+.*(?:increase|decrease|grow|shrink|expand)\b", 3.5),
            (r"\bbefore\s+and\s+after\b", 3.0),
            (r"\bover\s+time\b", 2.5),
            (r"\btemporal\b", 2.5),
            (r"\b(?:built|constructed|developed|demolished)\s+(?:since|between)\b", 3.5),
            (r"\bfrom\s+\d{4}\s+to\s+\d{4}\b", 2.5),
            (r"\bbetween\s+\d{4}\s+and\s+\d{4}\b", 2.5),
            (r"\bhas\s+.*(?:expanded|disappeared|appeared|changed)\b", 3.5),
        ]
        for pat, weight in change_patterns:
            if re.search(pat, q_lower):
                scores[QueryIntent.CHANGE_DETECTION] += weight

        if temporal_info.is_bi_temporal and any(w in q_lower for w in ["change", "changed", "new", "built", "increase", "decrease", "expansion", "difference"]):
            scores[QueryIntent.CHANGE_DETECTION] += 3.0

        # --- Comparison Scoring ---
        comparison_patterns = [
            (r"\bcompare\s+(?:the\s+)?(?:optical\s+and\s+sar|sar\s+and\s+optical)\b", 5.0),
            (r"\boptical\s+(?:vs\.?|versus)\s+sar\b", 5.0),
            (r"\bsar\s+(?:vs\.?|versus)\s+optical\b", 5.0),
            (r"\bdifference\s+between\s+optical\s+and\s+sar\b", 5.0),
            (r"\bcompare\s+(?:the\s+)?(?:two\s+images?|both\s+images?)\b", 3.5),
            (r"\bcompare\s+(?:the\s+)?sensors?\b", 3.5),
            (r"\bcross-modal\b", 3.5),
            (r"\bcontrast\s+(?:the\s+)?(?:optical\s+and\s+sar|images?)\b", 4.0),
            (r"\bhow\s+do\s+optical\s+and\s+sar\s+differ\b", 4.5),
        ]
        for pat, weight in comparison_patterns:
            if re.search(pat, q_lower):
                scores[QueryIntent.COMPARISON] += weight

        if comparison_info.is_comparison and comparison_info.comparison_type == "optical_sar":
            scores[QueryIntent.COMPARISON] += 3.0
        elif comparison_info.is_comparison and not temporal_info.is_bi_temporal:
            scores[QueryIntent.COMPARISON] += 1.5

        # --- Grounding Scoring ---
        grounding_patterns = [
            (r"\bwhere\s+(?:is|are|can\s+we\s+find)\b", 4.0),
            (r"\blocate\b", 4.0),
            (r"\bfind\s+(?:all\s+)?(?:the\s+)?", 3.5),
            (r"\bdetect\s+(?:all\s+)?(?:the\s+)?", 3.5),
            (r"\bbounding\s+box(?:es)?\b", 4.5),
            (r"\bhighlight\b", 3.5),
            (r"\bpoint\s+(?:out|to)\b", 3.0),
            (r"\bshow\s+me\s+where\b", 4.0),
            (r"\blocalize\b", 4.0),
            (r"\bpinpoint\b", 3.5),
            (r"\bidentify\s+(?:the\s+)?(?:position|coordinates?|locations?)\b", 4.0),
            (r"\bsegment\s+(?:the\s+)?", 3.0),
            (r"\bspatial\s+distribution\b", 2.0),
        ]
        for pat, weight in grounding_patterns:
            if re.search(pat, q_lower):
                scores[QueryIntent.GROUNDING] += weight

        # --- VQA Scoring ---
        vqa_patterns = [
            (r"\bwhat\s+objects\s+are\s+present\b", 4.5),
            (r"\bwhat\s+is\s+(?:the|visible|present|shown)\b", 3.0),
            (r"\bwhat\s+are\s+(?:the|visible|present|shown)\b", 3.0),
            (r"\bhow\s+many\b", 4.0),
            (r"\bcount\s+(?:the\s+)?", 4.0),
            (r"\bis\s+there\s+a\b", 3.5),
            (r"\bare\s+there\s+any\b", 3.5),
            (r"\bdescribe\s+.*?(?:scene|imagery|image|area|terrain)\b", 4.5),
            (r"\bdescribe\b", 3.5),
            (r"\bscene\s+description\b", 4.0),
            (r"\bwhat\s+type\s+of\b", 3.0),
            (r"\bwhat\s+kind\s+of\b", 3.0),
            (r"\bwhat\s+color\s+is\b", 3.5),
            (r"\b(?:what\s+is|identify)\s+(?:the\s+)?land\s+(?:use|cover)\b", 4.0),
            (r"\bidentify\s+(?:the\s+)?(?:land\s+cover|terrain|class)\b", 3.5),
            (r"\bcan\s+you\s+see\b", 3.0),
        ]
        for pat, weight in vqa_patterns:
            if re.search(pat, q_lower):
                scores[QueryIntent.VQA] += weight

        # General question fallback for remote sensing context
        if any(q_lower.startswith(w) for w in ["what", "how", "is", "are", "does", "can", "why"]):
            scores[QueryIntent.VQA] += 1.0

        # 5. Determine winning intent and ambiguity
        sorted_intents = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_intent, top_score = sorted_intents[0]
        second_intent, second_score = sorted_intents[1]

        # If highest score is negligibly small
        if top_score < 1.0:
            if domain_relevance > 0.0:
                # Has remote sensing context but phrasing is unclear
                return StructuredQuery(
                    original_query=query,
                    intent=QueryIntent.VQA,
                    confidence=0.50,
                    target_objects=target_objects,
                    temporal=temporal_info,
                    spatial=spatial_info,
                    comparison=comparison_info,
                    modality_hint=modality_hint,
                    is_ambiguous=True,
                    ambiguity_reason="Remote sensing context recognized but specific analytical task intent is implicit or weak.",
                    extracted_attributes={"fallback": True},
                )
            else:
                return StructuredQuery(
                    original_query=query,
                    intent=QueryIntent.UNKNOWN,
                    confidence=0.85,
                    target_objects=target_objects,
                    temporal=temporal_info,
                    spatial=spatial_info,
                    comparison=comparison_info,
                    modality_hint=modality_hint,
                    is_ambiguous=False,
                    ambiguity_reason=None,
                    extracted_attributes={"type": "unrecognized_intent"},
                )

        # 6. Ambiguity detection between top two intents
        is_ambiguous = False
        ambiguity_reason = None
        confidence = min(0.95, 0.65 + (top_score * 0.06))

        # Check if top two intents have close competing scores
        if second_score > 2.0 and (top_score - second_score) <= 1.2:
            is_ambiguous = True
            ambiguity_reason = (
                f"Query exhibits characteristics of both {top_intent.value} (score: {top_score:.1f}) "
                f"and {second_intent.value} (score: {second_score:.1f})."
            )
            confidence = max(0.55, confidence - 0.20)

        # Special case: Grounding within Change Detection
        # e.g., "Locate the new buildings built between 2020 and 2023"
        if scores[QueryIntent.GROUNDING] >= 3.0 and scores[QueryIntent.CHANGE_DETECTION] >= 3.0:
            is_ambiguous = True
            ambiguity_reason = "Query requests both spatial localization ('locate/find') and temporal change analysis ('between/built')."
            # Prioritize Change Detection for bi-temporal routing or Grounding if explicit coordinates requested
            confidence = 0.72

        extracted_attrs: Dict[str, Any] = {
            "top_score": round(top_score, 2),
            "runner_up_intent": second_intent.value,
            "runner_up_score": round(second_score, 2),
            "is_count_query": bool(re.search(r"\b(?:how\s+many|count)\b", q_lower)),
            "is_existence_query": bool(re.search(r"\b(?:is\s+there|are\s+there)\b", q_lower)),
        }

        return StructuredQuery(
            original_query=query,
            intent=top_intent,
            confidence=round(confidence, 2),
            target_objects=target_objects,
            time_range=temporal_info.raw_time_expression if temporal_info.has_temporal else None,
            temporal=temporal_info,
            spatial=spatial_info,
            comparison=comparison_info,
            modality_hint=modality_hint,
            is_ambiguous=is_ambiguous,
            ambiguity_reason=ambiguity_reason,
            extracted_attributes=extracted_attrs,
        )

    # -------------------------------------------------------------------------
    # Helper Extraction Methods
    # -------------------------------------------------------------------------

    def _extract_target_objects(self, q: str) -> List[str]:
        """Extract canonical remote sensing target entities."""
        targets: List[str] = []
        for category, patterns in self.ENTITY_PATTERNS.items():
            for pat in patterns:
                match = re.search(pat, q)
                if match:
                    # Append matching surface form or canonical name
                    val = match.group(0).lower()
                    if val not in targets:
                        targets.append(val)
        return targets

    def _extract_temporal(self, q: str) -> TemporalInfo:
        """Extract dates, years, and bi-temporal expressions."""
        years = re.findall(r"\b(19\d\d|20\d\d)\b", q)
        time_points: List[str] = list(dict.fromkeys(years))

        # Check for phrase expressions
        has_before_after = bool(re.search(r"\bbefore\s+and\s+after\b", q))
        has_t1_t2 = bool(re.search(r"\b(?:t1\s+and\s+t2|time\s+1\s+and\s+time\s+2)\b", q))
        has_over_time = bool(re.search(r"\bover\s+time\b", q))
        has_since = bool(re.search(r"\bsince\s+\d{4}\b", q))
        has_range = bool(re.search(r"\b(?:between\s+\d{4}\s+and\s+\d{4}|from\s+\d{4}\s+to\s+\d{4})\b", q))

        raw_expr: Optional[str] = None
        if has_range:
            m = re.search(r"\b(?:between\s+\d{4}\s+and\s+\d{4}|from\s+\d{4}\s+to\s+\d{4})\b", q)
            raw_expr = m.group(0) if m else None
        elif has_before_after:
            raw_expr = "before and after"
            time_points.extend(["before", "after"])
        elif has_t1_t2:
            raw_expr = "T1 and T2"
            time_points.extend(["T1", "T2"])
        elif years:
            raw_expr = ", ".join(years)
        elif has_over_time:
            raw_expr = "over time"

        is_bi_temporal = len(time_points) >= 2 or has_before_after or has_t1_t2 or has_range
        has_temporal = is_bi_temporal or len(years) > 0 or has_over_time or has_since

        return TemporalInfo(
            has_temporal=has_temporal,
            raw_time_expression=raw_expr,
            time_points=time_points,
            is_bi_temporal=is_bi_temporal,
        )

    def _extract_spatial(self, q: str) -> SpatialInfo:
        """Extract cardinal directions and landmark references."""
        words = re.findall(r"\b\w+\b", q)
        cardinals = [w for w in words if w in self.CARDINAL_DIRECTIONS]
        landmarks = []
        for landmark in self.SPATIAL_LANDMARKS:
            if re.search(rf"\b{re.escape(landmark)}\b", q):
                landmarks.append(landmark)

        has_spatial = len(cardinals) > 0 or len(landmarks) > 0 or "where" in words
        return SpatialInfo(
            has_spatial=has_spatial,
            locations=list(dict.fromkeys(landmarks)),
            cardinal_directions=list(dict.fromkeys(cardinals)),
        )

    def _extract_comparison(self, q: str, temporal: TemporalInfo) -> ComparisonInfo:
        """Extract comparison indicators and compare type."""
        indicators: List[str] = []
        comp_keywords = ["compare", "comparison", "versus", "vs", "difference", "differ", "contrast"]
        for kw in comp_keywords:
            if re.search(rf"\b{kw}\b", q):
                indicators.append(kw)

        is_comp = len(indicators) > 0
        comp_type: Optional[str] = None

        has_optical = bool(re.search(r"\b(?:optical|rgb|visual)\b", q))
        has_sar = bool(re.search(r"\b(?:sar|radar|sentinel-1)\b", q))

        if has_optical and has_sar:
            comp_type = "optical_sar"
            is_comp = True
            if "optical vs sar" not in indicators:
                indicators.append("optical_sar_pair")
        elif is_comp and temporal.is_bi_temporal:
            comp_type = "temporal"
        elif is_comp:
            comp_type = "general"

        return ComparisonInfo(
            is_comparison=is_comp,
            comparison_type=comp_type,
            indicators=indicators,
        )

    def _extract_modality(self, q: str) -> Optional[str]:
        """Detect referenced sensor modalities."""
        has_optical = bool(re.search(r"\b(?:optical|rgb|true\s+color|sentinel-2)\b", q))
        has_sar = bool(re.search(r"\b(?:sar|radar|sentinel-1|backscatter)\b", q))

        if has_optical and has_sar:
            return "multimodal"
        if has_sar:
            return "sar"
        if has_optical:
            return "optical"
        return None

    def _calculate_domain_relevance(self, q: str, targets: List[str]) -> float:
        """Score the query against domain vocabulary."""
        matches = 0
        for kw in self.DOMAIN_KEYWORDS:
            if re.search(rf"\b{kw}\b", q):
                matches += 1
        matches += len(targets)
        return min(1.0, matches / 3.0)

    def _is_completely_out_of_domain(self, q: str) -> bool:
        """Check for clear non-remote-sensing conversational or trivia queries."""
        out_of_domain_patterns = [
            r"\bcapital\s+of\b",
            r"\bwrite\s+(?:a\s+)?(?:poem|story|code|essay|email)\b",
            r"\bwho\s+is\b",
            r"\bwho\s+won\b",
            r"\bpresident\s+of\b",
            r"\bmeaning\s+of\s+life\b",
            r"\btell\s+me\s+a\s+joke\b",
            r"\bhow\s+are\s+you\b",
            r"\bhello\b",
            r"\bhi\s+there\b",
            r"^\d+\s*[\+\-\*\/]\s*\d+",  # math like 2 + 2
        ]
        return any(re.search(pat, q) for pat in out_of_domain_patterns)
