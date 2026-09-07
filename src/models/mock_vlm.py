"""Mock Vision-Language Model (VLM) services for SatQuery AI (SIH26167).

Provides lightweight, high-fidelity mock implementations for:
  1. Visual Question Answering (VQA) on remote-sensing imagery.
  2. Text-Guided Grounding (bounding boxes [ymin, xmin, ymax, xmax] with confidence scores).
  3. Bi-temporal Change Detection (localized change regions, quantification, natural language summary).

These mock services allow Backend, Agent, and Frontend teams to build and test their integrations
independently without requiring active GPU/model infrastructure.
"""

from __future__ import annotations

import asyncio
import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

logger = logging.getLogger("satquery.mock_vlm")


# -----------------------------------------------------------------------------
# Domain-Specific Remote Sensing Synthetic Knowledge Base
# -----------------------------------------------------------------------------

GROUNDING_CATALOG: Dict[str, Dict[str, Any]] = {
    "airport": {
        "label": "airport_runway_infrastructure",
        "description": "Commercial paved runway and taxiway infrastructure",
        "boxes": [
            {"label": "primary_runway", "box_2d": [0.42, 0.08, 0.48, 0.92], "confidence": 0.96},
            {"label": "highspeed_taxiway", "box_2d": [0.49, 0.22, 0.53, 0.78], "confidence": 0.91},
            {"label": "aircraft_apron", "box_2d": [0.55, 0.35, 0.68, 0.65], "confidence": 0.94},
            {"label": "passenger_terminal", "box_2d": [0.66, 0.40, 0.75, 0.60], "confidence": 0.89},
        ],
    },
    "aircraft": {
        "label": "aircraft",
        "description": "Parked commercial narrow-body and regional aircraft",
        "boxes": [
            {"label": "aircraft_narrow_body", "box_2d": [0.56, 0.38, 0.60, 0.42], "confidence": 0.95},
            {"label": "aircraft_narrow_body", "box_2d": [0.57, 0.44, 0.61, 0.48], "confidence": 0.93},
            {"label": "aircraft_wide_body", "box_2d": [0.60, 0.51, 0.66, 0.58], "confidence": 0.97},
            {"label": "aircraft_regional_jet", "box_2d": [0.62, 0.36, 0.65, 0.39], "confidence": 0.88},
        ],
    },
    "storage_tank": {
        "label": "petroleum_storage_tank",
        "description": "Cylindrical industrial fuel and chemical storage tanks",
        "boxes": [
            {"label": "storage_tank", "box_2d": [0.18, 0.62, 0.26, 0.70], "confidence": 0.94},
            {"label": "storage_tank", "box_2d": [0.19, 0.72, 0.27, 0.80], "confidence": 0.96},
            {"label": "storage_tank", "box_2d": [0.28, 0.63, 0.36, 0.71], "confidence": 0.92},
            {"label": "storage_tank", "box_2d": [0.29, 0.73, 0.37, 0.81], "confidence": 0.95},
        ],
    },
    "ship": {
        "label": "maritime_vessel",
        "description": "Vessels berthed or traversing coastal harbor channels",
        "boxes": [
            {"label": "cargo_container_ship", "box_2d": [0.31, 0.15, 0.42, 0.32], "confidence": 0.96},
            {"label": "bulk_carrier", "box_2d": [0.52, 0.18, 0.64, 0.31], "confidence": 0.93},
            {"label": "tugboat", "box_2d": [0.44, 0.28, 0.47, 0.31], "confidence": 0.87},
        ],
    },
    "building": {
        "label": "urban_builtup_structure",
        "description": "Commercial and residential structured buildings",
        "boxes": [
            {"label": "commercial_facility", "box_2d": [0.22, 0.31, 0.38, 0.49], "confidence": 0.93},
            {"label": "logistics_warehouse", "box_2d": [0.24, 0.52, 0.41, 0.74], "confidence": 0.95},
            {"label": "residential_cluster", "box_2d": [0.68, 0.18, 0.85, 0.42], "confidence": 0.89},
            {"label": "office_complex", "box_2d": [0.65, 0.58, 0.82, 0.78], "confidence": 0.91},
        ],
    },
    "solar": {
        "label": "photovoltaic_solar_array",
        "description": "Ground-mounted utility-scale photovoltaic solar panel clusters",
        "boxes": [
            {"label": "solar_panel_block_north", "box_2d": [0.12, 0.14, 0.28, 0.45], "confidence": 0.97},
            {"label": "solar_panel_block_south", "box_2d": [0.32, 0.15, 0.48, 0.46], "confidence": 0.96},
            {"label": "inverter_substation", "box_2d": [0.28, 0.46, 0.34, 0.52], "confidence": 0.90},
        ],
    },
    "water": {
        "label": "water_body",
        "description": "Open inland freshwater reservoir or canal water surface",
        "boxes": [
            {"label": "water_reservoir", "box_2d": [0.08, 0.58, 0.38, 0.94], "confidence": 0.98},
            {"label": "drainage_canal", "box_2d": [0.39, 0.70, 0.88, 0.76], "confidence": 0.89},
        ],
    },
}

DEFAULT_GROUNDING_BOXES = [
    {"label": "feature_of_interest_primary", "box_2d": [0.25, 0.25, 0.65, 0.70], "confidence": 0.91},
    {"label": "feature_of_interest_secondary", "box_2d": [0.68, 0.32, 0.85, 0.58], "confidence": 0.86},
]


# -----------------------------------------------------------------------------
# Mock VLM Core Service Implementation
# -----------------------------------------------------------------------------

class MockVLMService:
    """Service providing synthetic remote-sensing VLM predictions."""

    def __init__(self, model_version: str = "SatQuery-RS-VLM-Mock-v1.0", simulated_latency_s: float = 0.02):
        self.model_version = model_version
        self.simulated_latency_s = simulated_latency_s

    # -------------------------------------------------------------------------
    # Visual Question Answering (VQA)
    # -------------------------------------------------------------------------
    def generate_vqa_payload(
        self,
        image: str,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate a realistic VQA response based on image input and question."""
        cleaned_query = query.strip().lower()
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Keyword-matched domain answers
        if any(w in cleaned_query for w in ["land cover", "terrain", "vegetation", "forest", "crop"]):
            answer = (
                "The scene displays mixed terrestrial land cover dominated by agricultural cropland (44.2%), "
                "secondary temperate broadleaf forest (31.8%), and developed rural infrastructure (14.5%). "
                "A natural dendritic drainage network flows across the southwestern quadrant."
            )
            confidence = 0.93
            evidence = [
                "Spectral profile indicates high near-infrared reflectance (NDVI ~ 0.64) across vegetated parcels.",
                "Regular parcel geometry confirms organized agricultural cultivation.",
                "Low-reflectance sinuous corridor indicates active surface water drainage.",
            ]
            regions = [
                {"label": "agricultural_cropland", "box_2d": [0.15, 0.10, 0.55, 0.65], "confidence": 0.94},
                {"label": "broadleaf_forest", "box_2d": [0.50, 0.40, 0.90, 0.88], "confidence": 0.92},
            ]
        elif any(w in cleaned_query for w in ["airport", "runway", "aircraft", "plane", "flight", "airfield"]):
            answer = (
                "An operational airport facility is visible. The installation features an east-west asphalt runway "
                "(oriented approx 09/27, length ~3,100 m), an interconnected parallel taxiway system, and an apron "
                "holding 4 visible commercial aircraft. Terminal facilities and air traffic control infrastructure "
                "are positioned southeast of the tarmac."
            )
            confidence = 0.96
            evidence = [
                "High-contrast linear paved feature with standard threshold runway marking geometry.",
                "Distinct cruciform planform signatures characteristic of commercial transport aircraft.",
                "Multi-bay terminal structure with jet bridge attachments.",
            ]
            regions = [
                {"label": "primary_runway", "box_2d": [0.42, 0.08, 0.48, 0.92], "confidence": 0.97},
                {"label": "aircraft_apron", "box_2d": [0.55, 0.35, 0.68, 0.65], "confidence": 0.95},
            ]
        elif any(w in cleaned_query for w in ["port", "harbor", "ship", "vessel", "dock", "maritime", "water"]):
            answer = (
                "The image captures a deepwater maritime port terminal. Three cargo vessels are detected berthed "
                "along the primary quay, equipped with rail-mounted gantry container cranes. Water clarity exhibits "
                "moderate turbidity near the river outflow, with outer sea state calm."
            )
            confidence = 0.94
            evidence = [
                "Elongated metallic hull reflections with orthogonal wake traces in navigational channel.",
                "High spatial frequency container stacks organized in rectangular storage blocks.",
                "Quayside infrastructure with regular crane gantry boom shadows.",
            ]
            regions = [
                {"label": "container_terminal_quay", "box_2d": [0.25, 0.20, 0.45, 0.75], "confidence": 0.95},
                {"label": "berthed_cargo_vessel", "box_2d": [0.31, 0.15, 0.42, 0.32], "confidence": 0.96},
            ]
        elif any(w in cleaned_query for w in ["tank", "fuel", "petroleum", "oil", "refinery"]):
            answer = (
                "The scene contains a designated petrochemical bulk liquid storage facility containing at least "
                "4 large circular floating-roof storage tanks. Safety retention berms and connecting pipeline "
                "corridors surround each tank group."
            )
            confidence = 0.95
            evidence = [
                "Circular footprint with distinct radial sun-shadow signature matching cylindrical bulk tanks.",
                "Earthen containment berm dikes delineating separate safety compartments.",
            ]
            regions = [
                {"label": "storage_tank_group", "box_2d": [0.18, 0.60, 0.38, 0.82], "confidence": 0.95},
            ]
        elif any(w in cleaned_query for w in ["building", "urban", "city", "structure", "house", "residential"]):
            answer = (
                "The scene depicts an urban mixed-use district with structured commercial blocks and high-density "
                "residential housing. Primary transport arterials demarcate the perimeter with secondary street grids "
                "providing interior parcel access."
            )
            confidence = 0.91
            evidence = [
                "High density of rectangular roof facets with consistent solar shadow cast.",
                "Paved transportation grid with road intersections.",
            ]
            regions = [
                {"label": "commercial_district", "box_2d": [0.22, 0.30, 0.42, 0.75], "confidence": 0.93},
                {"label": "residential_block", "box_2d": [0.65, 0.20, 0.85, 0.80], "confidence": 0.90},
            ]
        elif any(w in cleaned_query for w in ["flood", "disaster", "water level", "damage", "submerged"]):
            answer = (
                "Significant surface water inundation is evident. Low-lying riparian plains and several peripheral "
                "agricultural fields have been flooded. Critical elevated road causeways remain above the flood line "
                "while secondary rural access routes are partially submerged."
            )
            confidence = 0.92
            evidence = [
                "Anomalous low-reflectance water absorption spectrum over previously mapped vegetated parcels.",
                "Disrupted transport connectivity where standing water intersects road line features.",
            ]
            regions = [
                {"label": "flooded_inundation_zone", "box_2d": [0.20, 0.15, 0.60, 0.85], "confidence": 0.93},
            ]
        else:
            answer = (
                f"Based on remote-sensing visual-language analysis for query '{query}', the scene exhibits "
                "structured surface features characteristic of mixed suburban and natural terrain. "
                "Atmospheric transparency is optimal with negligible cloud cover (<3%)."
            )
            confidence = 0.88
            evidence = [
                "Multi-spectral surface reflectance profiles indicate balanced vegetative and impervious surface distribution.",
                "Edge-detection gradients indicate regular anthropogenic boundary demarcations.",
            ]
            regions = [
                {"label": "predominant_feature_cluster", "box_2d": [0.25, 0.25, 0.75, 0.75], "confidence": 0.89},
            ]

        # Calculate lightweight image hash/length representation for execution trace
        img_descriptor = f"length={len(image)} chars" if isinstance(image, str) else "binary"

        return {
            "query": query,
            "answer": answer,
            "confidence": float(confidence),
            "bounding_boxes": regions,
            "evidence": evidence,
            "metadata": {
                "model": self.model_version,
                "task": "single_image_vqa",
                "timestamp_utc": now_utc,
                "image_descriptor": img_descriptor,
                "execution_trace": [
                    "input_validation_passed",
                    "imagery_preprocessing_normalized",
                    "vision_token_embedding_extracted",
                    "cross_attention_reasoning_completed",
                    "response_synthesized",
                ],
                "parameters_applied": parameters or {},
            },
        }

    # -------------------------------------------------------------------------
    # Text-Guided Grounding
    # -------------------------------------------------------------------------
    def generate_grounding_payload(
        self,
        image: str,
        query: str,
        confidence_threshold: float = 0.5,
        target_classes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate bounding boxes [ymin, xmin, ymax, xmax] for objects grounded by text query."""
        cleaned_query = query.strip().lower()
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Identify which catalog entries match the query
        matched_category = None
        for key in GROUNDING_CATALOG:
            if key in cleaned_query or (target_classes and any(key in c.lower() for c in target_classes)):
                matched_category = key
                break

        if matched_category:
            catalog_entry = GROUNDING_CATALOG[matched_category]
            detected_boxes = catalog_entry["boxes"]
            summary_desc = (
                f"Successfully localized {len(detected_boxes)} instances of {catalog_entry['label']} "
                f"matching prompt '{query}'."
            )
        else:
            # General fallback detection for user query
            summary_desc = (
                f"Detected 2 candidate spatial regions for query '{query}' "
                f"above confidence threshold {confidence_threshold:.2f}."
            )
            detected_boxes = [
                {
                    "label": re.sub(r"[^a-zA-Z0-9_]+", "_", cleaned_query[:25]) or "target_object_1",
                    "box_2d": [0.20, 0.22, 0.58, 0.62],
                    "confidence": 0.91,
                },
                {
                    "label": re.sub(r"[^a-zA-Z0-9_]+", "_", cleaned_query[:25]) or "target_object_2",
                    "box_2d": [0.62, 0.40, 0.82, 0.76],
                    "confidence": 0.87,
                },
            ]

        # Filter by confidence threshold
        filtered_boxes = [
            box for box in detected_boxes if box["confidence"] >= confidence_threshold
        ]

        # Ensure coordinates are strictly [ymin, xmin, ymax, xmax] format
        formatted_detections = []
        for item in filtered_boxes:
            ymin, xmin, ymax, xmax = item["box_2d"]
            formatted_detections.append(
                {
                    "label": item["label"],
                    "box_2d": [round(float(ymin), 4), round(float(xmin), 4), round(float(ymax), 4), round(float(xmax), 4)],
                    "confidence": round(float(item["confidence"]), 4),
                    "description": f"Grounded region for '{item['label']}' with normalized coordinates [ymin, xmin, ymax, xmax].",
                }
            )

        return {
            "query": query,
            "detected_objects": formatted_detections,
            "total_detected": len(formatted_detections),
            "summary": summary_desc,
            "coordinate_format": "[ymin, xmin, ymax, xmax] normalized to [0.0, 1.0]",
            "metadata": {
                "model": self.model_version,
                "task": "text_guided_grounding",
                "timestamp_utc": now_utc,
                "confidence_threshold": confidence_threshold,
                "target_classes_requested": target_classes or [],
                "execution_trace": [
                    "text_prompt_tokenized",
                    "spatial_feature_pyramid_sampled",
                    "anchor_region_scoring_completed",
                    "non_maximum_suppression_applied",
                    "grounding_coordinates_projected",
                ],
            },
        }

    # -------------------------------------------------------------------------
    # Bi-Temporal Change Detection
    # -------------------------------------------------------------------------
    def generate_change_detection_payload(
        self,
        image_before: str,
        image_after: str,
        query: Optional[str] = None,
        threshold: float = 0.5,
    ) -> Dict[str, Any]:
        """Generate bi-temporal change analysis comparing two satellite timestamps."""
        default_query = "What changed between these two images?"
        active_query = query if query and query.strip() else default_query
        cleaned_query = active_query.strip().lower()
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Realistic change detections with [ymin, xmin, ymax, xmax]
        if "flood" in cleaned_query or "water" in cleaned_query:
            changes = [
                {
                    "change_type": "flood_water_inundation",
                    "box_2d": [0.18, 0.12, 0.54, 0.48],
                    "confidence": 0.95,
                    "description": "Submersion of low-lying agricultural parcels due to river overflow.",
                },
                {
                    "change_type": "surface_water_expansion",
                    "box_2d": [0.45, 0.35, 0.72, 0.82],
                    "confidence": 0.92,
                    "description": "Expansion of reservoir shoreline encroaching onto adjacent unpaved trails.",
                },
            ]
            summary = (
                "Bi-temporal inspection reveals severe surface water inundation. River discharge and surface runoff "
                "have inundated approximately 42.8 hectares of agricultural floodplains. Secondary access roads "
                "are compromised in the northwestern quadrant."
            )
            metrics = {
                "built_up_area_change_pct": 0.0,
                "vegetation_loss_pct": -19.4,
                "water_surface_change_pct": 52.3,
                "total_modified_area_hectares": 42.8,
                "change_intensity": "high",
            }
        elif "deforestation" in cleaned_query or "forest" in cleaned_query or "tree" in cleaned_query:
            changes = [
                {
                    "change_type": "forest_canopy_clearing",
                    "box_2d": [0.22, 0.50, 0.48, 0.88],
                    "confidence": 0.94,
                    "description": "Clear-cutting of closed canopy woodland for infrastructure easement.",
                },
                {
                    "change_type": "logging_access_road_creation",
                    "box_2d": [0.42, 0.45, 0.80, 0.55],
                    "confidence": 0.90,
                    "description": "New unpaved linear road cut through previously contiguous timber parcels.",
                },
            ]
            summary = (
                "Bi-temporal assessment confirms extensive canopy loss and land preparation. A contiguous 28.5 hectare "
                "sector of forested land was cleared between T1 and T2, accompanied by the construction of a new "
                "graded access road."
            )
            metrics = {
                "built_up_area_change_pct": 4.1,
                "vegetation_loss_pct": -28.5,
                "water_surface_change_pct": -0.8,
                "total_modified_area_hectares": 28.5,
                "change_intensity": "high",
            }
        else:
            # Default urban expansion / construction change detection
            changes = [
                {
                    "change_type": "new_commercial_construction",
                    "box_2d": [0.25, 0.30, 0.44, 0.58],
                    "confidence": 0.96,
                    "description": "Erection of two large warehouse/distribution structures on previously cleared brownfield.",
                },
                {
                    "change_type": "road_paving_and_expansion",
                    "box_2d": [0.38, 0.15, 0.46, 0.85],
                    "confidence": 0.93,
                    "description": "Widening and asphalt paving of east-west arterial transit corridor.",
                },
                {
                    "change_type": "vegetation_to_impervious_conversion",
                    "box_2d": [0.58, 0.40, 0.78, 0.70],
                    "confidence": 0.91,
                    "description": "Conversion of natural scrubland into paved logistics parking and staging lot.",
                },
            ]
            summary = (
                "Comparative analysis between bi-temporal acquisitions demonstrates notable urban growth. "
                "Two major commercial structures were erected in the central sector, and the connecting arterial road "
                "was paved. An estimated 18.2 hectares converted from permeable soil to impervious surfaces."
            )
            metrics = {
                "built_up_area_change_pct": 14.8,
                "vegetation_loss_pct": -8.6,
                "water_surface_change_pct": 0.0,
                "total_modified_area_hectares": 18.2,
                "change_intensity": "moderate-high",
            }

        # Filter changes by threshold
        filtered_changes = [c for c in changes if c["confidence"] >= threshold]

        return {
            "query": active_query,
            "summary": summary,
            "detected_changes": filtered_changes,
            "total_changes": len(filtered_changes),
            "quantified_metrics": metrics,
            "compatibility_verified": True,
            "coordinate_format": "[ymin, xmin, ymax, xmax] normalized to [0.0, 1.0]",
            "metadata": {
                "model": self.model_version,
                "task": "bi_temporal_change_analysis",
                "timestamp_utc": now_utc,
                "threshold": threshold,
                "spatial_coregistration": "subpixel_aligned_affine",
                "sensor_pair": "Sentinel-2 MSI Level-2A (T1 vs T2)",
                "execution_trace": [
                    "bitemporal_pair_validation_passed",
                    "radiometric_and_co_registration_checked",
                    "difference_feature_maps_computed",
                    "bitemporal_vlm_reasoning_executed",
                    "change_polygon_bounding_boxes_derived",
                    "quantitative_landcover_deltas_calculated",
                ],
            },
        }

    # -------------------------------------------------------------------------
    # Async Helpers
    # -------------------------------------------------------------------------
    async def async_mock_vqa(self, image: str, query: str, **kwargs) -> Dict[str, Any]:
        """Async wrapper for VQA simulation."""
        if self.simulated_latency_s > 0:
            await asyncio.sleep(self.simulated_latency_s)
        return self.generate_vqa_payload(image=image, query=query, parameters=kwargs)

    async def async_mock_grounding(
        self,
        image: str,
        query: str,
        confidence_threshold: float = 0.5,
        target_classes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Async wrapper for Grounding simulation."""
        if self.simulated_latency_s > 0:
            await asyncio.sleep(self.simulated_latency_s)
        return self.generate_grounding_payload(
            image=image,
            query=query,
            confidence_threshold=confidence_threshold,
            target_classes=target_classes,
        )

    async def async_mock_change_detection(
        self,
        image_before: str,
        image_after: str,
        query: Optional[str] = None,
        threshold: float = 0.5,
    ) -> Dict[str, Any]:
        """Async wrapper for Change Detection simulation."""
        if self.simulated_latency_s > 0:
            await asyncio.sleep(self.simulated_latency_s)
        return self.generate_change_detection_payload(
            image_before=image_before,
            image_after=image_after,
            query=query,
            threshold=threshold,
        )


# Global default instance
default_mock_service = MockVLMService()


# -----------------------------------------------------------------------------
# Standalone Functional API (Synchronous and Asynchronous)
# -----------------------------------------------------------------------------

def mock_vqa(image: str, query: str, **kwargs) -> Dict[str, Any]:
    """Execute synchronous mock VQA analysis on a satellite image."""
    return default_mock_service.generate_vqa_payload(image=image, query=query, parameters=kwargs)


async def async_mock_vqa(image: str, query: str, **kwargs) -> Dict[str, Any]:
    """Execute asynchronous mock VQA analysis on a satellite image."""
    return await default_mock_service.async_mock_vqa(image=image, query=query, **kwargs)


def mock_grounding(
    image: str,
    query: str,
    confidence_threshold: float = 0.5,
    target_classes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Execute synchronous mock text-guided grounding on a satellite image."""
    return default_mock_service.generate_grounding_payload(
        image=image,
        query=query,
        confidence_threshold=confidence_threshold,
        target_classes=target_classes,
    )


async def async_mock_grounding(
    image: str,
    query: str,
    confidence_threshold: float = 0.5,
    target_classes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Execute asynchronous mock text-guided grounding on a satellite image."""
    return await default_mock_service.async_mock_grounding(
        image=image,
        query=query,
        confidence_threshold=confidence_threshold,
        target_classes=target_classes,
    )


def mock_change_detection(
    image_before: str,
    image_after: str,
    query: Optional[str] = None,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Execute synchronous mock bi-temporal change detection."""
    return default_mock_service.generate_change_detection_payload(
        image_before=image_before,
        image_after=image_after,
        query=query,
        threshold=threshold,
    )


async def async_mock_change_detection(
    image_before: str,
    image_after: str,
    query: Optional[str] = None,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Execute asynchronous mock bi-temporal change detection."""
    return await default_mock_service.async_mock_change_detection(
        image_before=image_before,
        image_after=image_after,
        query=query,
        threshold=threshold,
    )
