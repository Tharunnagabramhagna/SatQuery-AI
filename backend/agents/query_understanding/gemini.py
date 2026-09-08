"""Gemini-powered Query Understanding classifier for SatQuery AI.

Implements BaseQueryClassifier using the official Google Gemini SDK (google-genai).
Utilizes Gemini structured JSON output (Pydantic schema) for strict classification
into the five supported SatQuery intents:
  - VQA
  - GROUNDING
  - CHANGE_DETECTION
  - COMPARISON
  - UNKNOWN

Architecture & Safety Guarantees:
  1. Strict JSON schema validation against GeminiClassificationSchema.
  2. Fallback to RuleBasedQueryClassifier on ANY error (API, timeout, quota, validation, missing key).
  3. Zero credentials logged or exposed.
  4. Preserves transparent execution trace with provider attribution ('gemini' or 'rule_based').
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ValidationError

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import settings
from backend.agents.query_understanding.base import BaseQueryClassifier
from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.schemas.query_understanding import (
    ComparisonInfo,
    QueryIntent,
    SpatialInfo,
    StructuredQuery,
    TemporalInfo,
)

logger = logging.getLogger("satquery.query_understanding.gemini")

GEMINI_SYSTEM_INSTRUCTION = (
    "You are the Query Understanding intelligence layer for SatQuery AI, an Earth Observation (EO) "
    "and remote sensing analysis assistant. Your sole job is to classify the user's natural-language "
    "query into exactly one of five supported intents:\n"
    "- VQA: Questions asking what visual features, land cover, or properties are present in satellite imagery.\n"
    "- GROUNDING: Questions asking WHERE specific objects or features are located (e.g. 'where are the airplanes').\n"
    "- CHANGE_DETECTION: Questions about changes, differences, urban expansion, construction, or deforestation between images or across dates.\n"
    "- COMPARISON: Questions comparing imagery sources, sensors, optical vs SAR, or multimodal products.\n"
    "- UNKNOWN: General trivia (e.g. 'capital of France'), greetings, math, non-satellite questions, or underspecified isolated words.\n\n"
    "Guidelines:\n"
    "1. Be conservative. If a query is unrelated to Earth Observation or remote sensing, classify as UNKNOWN.\n"
    "2. If a query contains only an isolated noun without an action (e.g. 'buildings'), classify as UNKNOWN or set is_ambiguous=True.\n"
    "3. Never invent tool names or hallucinate image analysis results. Only classify the semantic intent."
)


class GeminiClassificationSchema(BaseModel):
    """Pydantic structured output schema for Gemini content generation."""

    intent: QueryIntent = Field(
        ...,
        description="Must be exactly one of: VQA, GROUNDING, CHANGE_DETECTION, COMPARISON, UNKNOWN.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0.",
    )
    target_objects: List[str] = Field(
        default_factory=list,
        description="Extracted domain entities e.g. airplanes, ships, buildings, roads.",
    )
    is_ambiguous: bool = Field(
        default=False,
        description="True if query could map to multiple intents or is underspecified.",
    )
    ambiguity_reason: Optional[str] = Field(
        default=None,
        description="Explanation if ambiguous.",
    )
    modality_hint: Optional[str] = Field(
        default=None,
        description="Sensor or modality hint: optical, sar, multispectral, or None.",
    )
    time_range: Optional[str] = Field(
        default=None,
        description="Extracted time range if query mentions dates or intervals.",
    )
    is_count_query: bool = Field(
        default=False,
        description="True if asking 'how many' or counting objects.",
    )
    is_existence_query: bool = Field(
        default=False,
        description="True if asking 'is there' or existence questions.",
    )
    locations: List[str] = Field(
        default_factory=list,
        description="Spatial locations, landmarks, or regions mentioned.",
    )
    time_points: List[str] = Field(
        default_factory=list,
        description="Specific dates, years, or phases mentioned.",
    )
    is_bi_temporal: bool = Field(
        default=False,
        description="True if query references two distinct dates or before/after comparison.",
    )
    comparison_type: Optional[str] = Field(
        default=None,
        description="Comparison type if COMPARISON: optical_sar, temporal, sensor, general.",
    )


class GeminiQueryClassifier(BaseQueryClassifier):
    """
    Intelligent Query Understanding classifier powered by Google Gemini (gemini-3.6-flash).
    Falls back gracefully to RuleBasedQueryClassifier if Gemini is unavailable.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[genai.Client] = None,
        fallback_classifier: Optional[BaseQueryClassifier] = None,
    ) -> None:
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-3.6-flash"
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS or 10.0
        self.fallback_classifier = fallback_classifier or RuleBasedQueryClassifier()

        if client is not None:
            self._client = client
        elif (
            self.api_key
            and self.api_key.strip() not in ("", "your-gemini-api-key", "placeholder", "your_gemini_api_key", "fake-test-key", "test-key", "test-api-key")
            and not self.api_key.startswith("test-")
            and not self.api_key.startswith("fake-")
        ):
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning("Failed to initialize Gemini client: %s", type(exc).__name__)
                self._client = None
        else:
            self._client = None

    async def classify(self, query: str) -> StructuredQuery:
        """
        Classify a natural-language query using Gemini 3.6 Flash structured output.
        Automatically falls back to RuleBasedQueryClassifier on any failure.
        """
        sanitized_query = query.strip()
        if not sanitized_query:
            return await self._fallback(query, "empty_query")

        if self._client is None or not self.api_key:
            return await self._fallback(query, "missing_api_key")

        # Execute with at most 1 controlled retry for transient errors
        last_error_reason = "unknown"
        for attempt in range(2):
            try:
                parsed_output = await self._call_gemini(sanitized_query)
                return self._build_structured_query(sanitized_query, parsed_output)
            except asyncio.TimeoutError:
                last_error_reason = "timeout"
                logger.warning("Gemini request timed out on attempt %d for query: %s", attempt + 1, sanitized_query[:40])
            except genai_errors.APIError as exc:
                last_error_reason = "api_error"
                status_code = getattr(exc, "code", None)
                if status_code in (401, 403):
                    last_error_reason = "authentication_error"
                    logger.warning("Gemini authentication error (HTTP %s): %s", status_code, type(exc).__name__)
                    break
                elif status_code == 429:
                    last_error_reason = "rate_limit_exceeded"
                    logger.warning("Gemini rate limit exceeded (HTTP 429): %s", type(exc).__name__)
                    break
                logger.warning("Gemini API error (%s) on attempt %d: %s", last_error_reason, attempt + 1, type(exc).__name__)
            except ValidationError as exc:
                last_error_reason = "invalid_structured_output"
                logger.warning("Gemini output validation failed on attempt %d: %s", attempt + 1, type(exc).__name__)
                break  # Do not retry schema validation failure
            except Exception as exc:
                last_error_reason = "unexpected_provider_error"
                logger.warning("Unexpected error during Gemini call on attempt %d: %s", attempt + 1, type(exc).__name__)

        return await self._fallback(query, last_error_reason)

    async def _call_gemini(self, query: str) -> GeminiClassificationSchema:
        """Call Gemini API with structured JSON output and timeout enforcement."""
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiClassificationSchema,
            system_instruction=GEMINI_SYSTEM_INSTRUCTION,
            temperature=0.0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        async def _generate():
            # Use async client for non-blocking I/O
            response = await self._client.aio.models.generate_content(
                model=self.model,
                contents=query,
                config=config,
            )
            return response

        response = await asyncio.wait_for(_generate(), timeout=self.timeout)

        # Retrieve parsed Pydantic model
        if hasattr(response, "parsed") and isinstance(response.parsed, GeminiClassificationSchema):
            return response.parsed

        # Fallback to manual JSON validation if SDK didn't populate response.parsed
        raw_text = getattr(response, "text", None) or ""
        return GeminiClassificationSchema.model_validate_json(raw_text)

    def _build_structured_query(
        self, original_query: str, p: GeminiClassificationSchema
    ) -> StructuredQuery:
        """Transform Gemini output into standard SatQuery StructuredQuery model."""
        temporal: Optional[TemporalInfo] = None
        if p.time_range or p.time_points or p.is_bi_temporal:
            temporal = TemporalInfo(
                has_temporal=True,
                raw_time_expression=p.time_range,
                time_points=p.time_points,
                is_bi_temporal=p.is_bi_temporal or len(p.time_points) >= 2,
            )

        spatial: Optional[SpatialInfo] = None
        if p.locations:
            spatial = SpatialInfo(
                has_spatial=True,
                locations=p.locations,
                cardinal_directions=[],
            )

        comparison: Optional[ComparisonInfo] = None
        if p.intent == QueryIntent.COMPARISON or p.comparison_type:
            comparison = ComparisonInfo(
                is_comparison=True,
                comparison_type=p.comparison_type or "general",
                indicators=[],
            )

        extracted_attrs: Dict[str, Any] = {
            "provider": "gemini",
            "model": self.model,
        }
        if p.is_count_query:
            extracted_attrs["is_count_query"] = True
        if p.is_existence_query:
            extracted_attrs["is_existence_query"] = True

        return StructuredQuery(
            original_query=original_query,
            intent=p.intent,
            confidence=float(p.confidence),
            target_objects=p.target_objects,
            time_range=p.time_range,
            temporal=temporal,
            spatial=spatial,
            comparison=comparison,
            modality_hint=p.modality_hint,
            is_ambiguous=p.is_ambiguous,
            ambiguity_reason=p.ambiguity_reason,
            extracted_attributes=extracted_attrs,
        )

    async def _fallback(self, query: str, reason: str) -> StructuredQuery:
        """Fall back to deterministic RuleBasedQueryClassifier."""
        logger.info("Engaging RuleBasedQueryClassifier fallback: reason=%s", reason)
        structured = await self.fallback_classifier.classify(query)
        structured.extracted_attributes["provider"] = "rule_based"
        structured.extracted_attributes["fallback_reason"] = reason
        return structured
