"""Change Detection Tool implementation for SatQuery AI.

Integrates ChangeDetectionEngine into the SatQuery BaseTool / ToolExecutor pipeline.
Handles input validation, graceful missing-input reporting, error containment,
and output transformation into standardized ToolResult schema.
"""

import base64
import io
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from backend.agents.tools.base import BaseTool
from backend.agents.tools.change_detection.engine import (
    ChangeDetectionEngine,
    ImageValidationError,
    default_change_detection_engine,
)
from backend.agents.tools.change_detection.interpreter import (
    SemanticChangeInterpreter,
    SemanticInterpretationOutput,
)
from backend.schemas.common import AnalysisEvidence, AnalysisVisualization
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

logger = logging.getLogger("satquery.tools.change_detection")


class ChangeDetectionTool(BaseTool):
    """
    Two-stage specialist tool executing bi-temporal satellite change analysis:
    - Stage 1: Deterministic pixel-level deltas, structural alignment, and cluster bounding boxes.
    - Stage 2: Multimodal semantic change interpretation and directional attribution.
    """

    tool_id = ToolIdentifier.CHANGE_DETECTION_TOOL
    name = "Bi-Temporal Change Detection Tool"
    description = (
        "Performs deterministic pixel-level RGB change detection and spatial co-registration between "
        "baseline (T1) and follow-up (T2) satellite image acquisitions, enriched with multimodal semantic interpretation."
    )

    def __init__(
        self,
        engine: Optional[ChangeDetectionEngine] = None,
        interpreter: Optional[SemanticChangeInterpreter] = None,
    ):
        self.engine = engine or default_change_detection_engine
        self.interpreter = interpreter or SemanticChangeInterpreter()

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

        # 3. Stage 1 Base Evidence
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

        metadata: Dict[str, Any] = {
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

        # 4. Stage 2: Multimodal Semantic Change Interpretation
        answer_text = result.summary
        final_confidence = result.confidence
        warnings = list(result.warnings)

        before_extracted = self._extract_bytes_and_mime(before_image)
        after_extracted = self._extract_bytes_and_mime(after_image)

        if before_extracted and after_extracted and query:
            bytes_before, mime_before = before_extracted
            bytes_after, _ = after_extracted
            cluster_boxes = [r.box_2d for r in result.regions]

            stage1_metrics = {
                "changed_pixels": result.metrics.changed_pixels,
                "total_pixels": result.metrics.total_pixels,
                "change_percentage": result.metrics.change_percentage,
                "mean_difference_intensity": result.metrics.mean_difference_intensity,
            }

            semantic_out, sem_err_type, sem_err_msg = await self.interpreter.interpret_change(
                query=query,
                bytes_before=bytes_before,
                bytes_after=bytes_after,
                mime_type=mime_before,
                stage1_metrics=stage1_metrics,
                cluster_boxes=cluster_boxes,
                coregistration_score=result.coregistration.quality_score,
                coregistration_status=result.coregistration.status,
            )

            if semantic_out is not None:
                metadata["semantic_categories"] = semantic_out.change_categories
                metadata["directional_conclusion"] = semantic_out.directional_conclusion
                metadata["semantic_interpretation_status"] = "success"

                uncertain_detail = (
                    "; ".join(semantic_out.uncertainties)
                    if semantic_out.uncertainties
                    else f"Alignment quality score is {result.coregistration.quality_score:.2f} ({result.coregistration.status}). Exact area measurements require validated geospatial scale tags."
                )

                answer_text = (
                    f"[OBSERVED]: {result.summary}\n\n"
                    f"[INTERPRETED]: {semantic_out.summary}\n\n"
                    f"[UNCERTAIN]: {uncertain_detail}"
                )

                evidence.append(
                    AnalysisEvidence(
                        type="semantic_interpretation",
                        description=semantic_out.summary,
                        source=f"SemanticChangeInterpreter ({self.interpreter.model})",
                        confidence=semantic_out.confidence,
                    )
                )

                # Calibrate confidence: minimum of Stage 1 alignment and Stage 2 interpretation
                stage1_conf = result.confidence if result.confidence is not None else 0.5
                final_confidence = round(min(stage1_conf, semantic_out.confidence), 4)

                for u in semantic_out.uncertainties:
                    if u not in warnings:
                        warnings.append(u)
            else:
                metadata["semantic_interpretation_status"] = "unavailable"
                metadata["semantic_error_type"] = sem_err_type
                warnings.append(
                    f"Semantic change interpretation unavailable ({sem_err_msg or sem_err_type}). "
                    "Showing verified Stage 1 deterministic pixel change analysis only."
                )

        return ToolResult(
            tool_name=self.tool_id.value,
            status=ToolStatus.SUCCESS.value,
            answer=answer_text,
            confidence=final_confidence,
            evidence=evidence,
            visualizations=visualizations,
            metadata=metadata,
            warnings=warnings,
        )

    @staticmethod
    def _extract_bytes_and_mime(image_input: Any) -> Optional[Tuple[bytes, str]]:
        """Extract raw bytes and MIME type from file path, base64 string, or PIL Image."""
        try:
            if isinstance(image_input, Image.Image):
                buf = io.BytesIO()
                image_input.save(buf, format="PNG")
                return buf.getvalue(), "image/png"
            if isinstance(image_input, bytes):
                return image_input, "image/jpeg"
            if isinstance(image_input, str):
                if image_input.startswith("data:image/") and ";base64," in image_input:
                    header, b64_str = image_input.split(";base64,", 1)
                    mime = header.replace("data:", "").strip() or "image/jpeg"
                    return base64.b64decode(b64_str), mime
                p = Path(image_input)
                if p.exists():
                    data = p.read_bytes()
                    ext = p.suffix.lower()
                    mime = "image/png" if ext == ".png" else ("image/tiff" if ext in (".tif", ".tiff") else "image/jpeg")
                    return data, mime
        except Exception as exc:
            logger.warning("Failed to extract image bytes for semantic interpretation: %s", exc)
        return None
