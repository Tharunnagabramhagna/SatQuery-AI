"""Change Detection Tool implementation for SatQuery AI.

Integrates ChangeDetectionEngine into the SatQuery BaseTool / ToolExecutor pipeline.
Handles input validation, graceful missing-input reporting, error containment,
and output transformation into standardized ToolResult schema.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from backend.agents.tools.base import BaseTool
from backend.agents.tools.change_detection.engine import (
    ChangeDetectionEngine,
    ImageValidationError,
    default_change_detection_engine,
)
from backend.schemas.common import AnalysisEvidence, AnalysisVisualization
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.change_detection")


class ChangeDetectionTool(BaseTool):
    """
    Specialist tool executing bi-temporal RGB change detection.
    Evaluates pixel-level deltas, structural alignment, and localized change clusters.
    """

    tool_id = ToolIdentifier.CHANGE_DETECTION_TOOL
    name = "Bi-Temporal Change Detection Tool"
    description = (
        "Performs pixel-level RGB change detection and spatial co-registration between "
        "baseline (T1) and follow-up (T2) satellite image acquisitions."
    )

    def __init__(self, engine: Optional[ChangeDetectionEngine] = None):
        self.engine = engine or default_change_detection_engine

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """
        Execute change detection analysis.

        Args:
            params: Dictionary containing parameters passed by ToolExecutor:
                - before_image: Path, base64 string, or image object for T1 acquisition.
                - after_image: Path, base64 string, or image object for T2 acquisition.
                - query: Optional natural language query directing analysis.
                - sensitivity: Optional pixel difference threshold float.
                - coregistration_threshold: Optional alignment tolerance float.

        Returns:
            Structured ToolResult adhering to SatQuery output schema.
        """
        before_image = params.get("before_image")
        after_image = params.get("after_image")
        query = params.get("query") or params.get("structured_query", {}).get("original_query")
        sensitivity = params.get("sensitivity")
        coreg_thresh = params.get("coregistration_threshold")

        # 1. Image pair input validation
        if not before_image or not after_image:
            missing = []
            if not before_image:
                missing.append("before_image")
            if not after_image:
                missing.append("after_image")

            logger.info("ChangeDetectionTool invoked without required imagery: missing %s", missing)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.INPUT_REQUIRED.value,
                answer="Change detection requires before and after imagery. Please supply baseline (T1) and follow-up (T2) image inputs.",
                confidence=None,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "CHANGE_DETECTION",
                    "required_inputs": ["before_image", "after_image"],
                    "missing_inputs": missing,
                },
                warnings=["Change detection requires before and after imagery."],
            )

        # 2. Run ChangeDetectionEngine with structured error handling
        try:
            logger.info("Executing ChangeDetectionEngine with before and after imagery")
            result = self.engine.run(
                before_image=before_image,
                after_image=after_image,
                query=query,
                sensitivity=float(sensitivity) if sensitivity is not None else None,
                coregistration_threshold=float(coreg_thresh) if coreg_thresh is not None else None,
            )
        except ImageValidationError as exc:
            logger.warning("Image validation error in ChangeDetectionTool: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "CHANGE_DETECTION",
                    "error_type": "image_validation_error",
                },
                warnings=[str(exc)],
            )
        except Exception as exc:
            logger.exception("Unexpected error in ChangeDetectionTool execution: %s", exc)
            return ToolResult(
                tool_name=self.tool_id.value,
                status=ToolStatus.ERROR.value,
                answer=None,
                confidence=0.0,
                evidence=[],
                visualizations=[],
                metadata={
                    "capability": "CHANGE_DETECTION",
                    "error_type": "engine_execution_exception",
                },
                warnings=[f"Failed to execute change detection engine: {str(exc)}"],
            )

        # 3. Map engine output into ToolResult schema
        evidence = [
            AnalysisEvidence(
                type="metric",
                description=(
                    f"Pixel change ratio: {result.metrics.change_percentage}% across "
                    f"{result.metrics.changed_pixels} of {result.metrics.total_pixels} evaluated pixels "
                    f"(mean difference intensity: {result.metrics.mean_difference_intensity:.4f})."
                ),
                source="ChangeDetectionEngine (RGB Pixel Difference)",
            ),
            AnalysisEvidence(
                type="co_registration",
                description=(
                    f"Spatial alignment quality score: {result.coregistration.quality_score:.2f} "
                    f"(Status: {result.coregistration.status}, discrepancy factor: "
                    f"{result.coregistration.discrepancy_factor:.2f})."
                ),
                source="ChangeDetectionEngine (Edge Gradient Correlation)",
            ),
        ]

        visualizations = [
            AnalysisVisualization(
                type="mask",
                data=result.mask_base64,
                label="Bi-Temporal Change Mask Overlay (PNG)",
            ),
            *[
                AnalysisVisualization(
                    type="bounding_box",
                    data={
                        "region_id": region.region_id,
                        "box_2d": region.box_2d,
                        "coordinate_format": "normalized [ymin, xmin, ymax, xmax]",
                    },
                    label=f"Change Cluster #{region.region_id}",
                )
                for region in result.regions
            ],
        ]

        metadata = {
            "capability": "CHANGE_DETECTION",
            "changed_pixels": result.metrics.changed_pixels,
            "total_pixels": result.metrics.total_pixels,
            "change_percentage": result.metrics.change_percentage,
            "mean_difference_intensity": result.metrics.mean_difference_intensity,
            "co_registration_score": result.coregistration.quality_score,
            "co_registration_status": result.coregistration.status,
            "co_registration_verified": result.coregistration.is_co_registered,
            "sensitivity": result.sensitivity,
            "image_dimensions": result.image_dimensions,
            "detected_clusters_count": len(result.regions),
            "coordinate_format": "normalized [ymin, xmin, ymax, xmax]",
        }

        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.SUCCESS.value,
            answer=result.summary,
            confidence=result.confidence,
            evidence=evidence,
            visualizations=visualizations,
            metadata=metadata,
            warnings=result.warnings,
        )
