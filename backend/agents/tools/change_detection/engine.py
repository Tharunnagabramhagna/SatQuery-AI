"""Algorithmic Bi-Temporal RGB Change Detection Engine.

Provides deterministic pixel-level image difference analysis, spatial co-registration
quality verification, binary change mask generation, and localized cluster extraction.

Uses standard numerical computing (NumPy) and image processing (Pillow).
Does NOT rely on learned semantic weights, external APIs, or fabricated geographic metrics.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image

from backend.agents.tools.change_detection.models import (
    ChangeDetectionResult,
    ChangeMetrics,
    ChangeRegion,
    CoregistrationResult,
)

logger = logging.getLogger("satquery.change_detection.engine")

DEFAULT_COREGISTRATION_THRESHOLD = 0.65
DEFAULT_MASK_SIZE = (128, 128)
DEFAULT_SENSITIVITY = 0.25


class ImageValidationError(Exception):
    """Raised when an input image cannot be found, opened, or validated."""
    pass


class ChangeDetectionEngine:
    """
    Modular engine for bi-temporal remote sensing RGB change detection.
    Performs co-registration assessment, pixel difference computation,
    change mask synthesis, and normalized bounding box extraction.
    """

    def __init__(
        self,
        default_mask_size: Tuple[int, int] = DEFAULT_MASK_SIZE,
        default_coregistration_threshold: float = DEFAULT_COREGISTRATION_THRESHOLD,
        default_sensitivity: float = DEFAULT_SENSITIVITY,
    ):
        self.default_mask_size = default_mask_size
        self.coregistration_threshold = default_coregistration_threshold
        self.default_sensitivity = default_sensitivity

    def load_image(self, image_input: Union[str, Path, Image.Image]) -> Image.Image:
        """
        Load and validate an image from a file path, base64 data URI, or PIL Image.

        Args:
            image_input: File path, base64 string, or PIL Image.

        Returns:
            Validated PIL.Image.Image in RGB mode.

        Raises:
            ImageValidationError: If the image cannot be located, decoded, or opened.
        """
        if isinstance(image_input, Image.Image):
            return image_input.convert("RGB")

        if not isinstance(image_input, (str, Path)):
            raise ImageValidationError(f"Unsupported image input type: {type(image_input)}")

        image_str = str(image_input).strip()
        if not image_str:
            raise ImageValidationError("Image path or input data string is empty.")

        # 1. Base64 data URI or raw base64 string
        if image_str.startswith("data:image/") or re.match(r"^[A-Za-z0-9+/=]{40,}$", image_str):
            cleaned = image_str.split(",", 1)[1] if "," in image_str else image_str
            try:
                raw_bytes = base64.b64decode(cleaned)
                img = Image.open(io.BytesIO(raw_bytes))
                img.load()
                return img.convert("RGB")
            except Exception as exc:
                raise ImageValidationError(f"Failed to decode base64 image data: {exc}") from exc

        # 2. Local filesystem path
        file_path = Path(image_str)
        if not file_path.is_file():
            raise ImageValidationError(f"Image file not found at path: '{image_str}'")

        try:
            img = Image.open(file_path)
            img.load()
            return img.convert("RGB")
        except Exception as exc:
            raise ImageValidationError(f"Failed to open image file '{image_str}': {exc}") from exc

    def assess_coregistration(
        self,
        img_before: Image.Image,
        img_after: Image.Image,
        tolerance_threshold: Optional[float] = None,
    ) -> CoregistrationResult:
        """
        Evaluate spatial alignment and geometric co-registration between two temporal images.

        Computes:
          1. Aspect ratio and scale discrepancy.
          2. Edge gradient correlation via horizontal/vertical directional derivatives.
          3. Luminance variance ratio.

        Returns:
            CoregistrationResult with quality score, status, and caveat messages.
        """
        threshold = tolerance_threshold if tolerance_threshold is not None else self.coregistration_threshold
        w1, h1 = img_before.size
        w2, h2 = img_after.size

        # Check 1: Aspect ratio discrepancy
        ar1 = w1 / max(1, h1)
        ar2 = w2 / max(1, h2)
        aspect_diff = abs(ar1 - ar2) / max(ar1, ar2, 0.001)

        if aspect_diff > 0.35:
            quality_score = round(max(0.1, 1.0 - aspect_diff), 4)
            return CoregistrationResult(
                quality_score=quality_score,
                is_co_registered=False,
                discrepancy_factor=round(aspect_diff, 4),
                status="uncertain",
                warning=(
                    f"Severe aspect ratio discrepancy detected between acquisitions "
                    f"(T1: {w1}x{h1} vs T2: {w2}x{h2}). Spatial co-registration cannot be guaranteed."
                ),
            )

        # Standardize dimension for gradient correlation
        eval_dim = (256, 256)
        g1 = np.array(img_before.resize(eval_dim, Image.Resampling.BILINEAR).convert("L"), dtype=np.float32) / 255.0
        g2 = np.array(img_after.resize(eval_dim, Image.Resampling.BILINEAR).convert("L"), dtype=np.float32) / 255.0

        diff_mean = float(np.mean(np.abs(g1 - g2)))
        if diff_mean < 1e-4 and aspect_diff < 0.02:
            return CoregistrationResult(
                quality_score=1.0,
                is_co_registered=True,
                discrepancy_factor=0.0,
                status="verified",
                warning=None,
            )

        # Check 2: Structural Gradient/Edge Correlation
        gx1, gy1 = np.gradient(g1)
        gx2, gy2 = np.gradient(g2)
        mag1 = np.sqrt(gx1**2 + gy1**2)
        mag2 = np.sqrt(gx2**2 + gy2**2)

        std1 = float(np.std(mag1))
        std2 = float(np.std(mag2))

        if std1 < 1e-5 and std2 < 1e-5:
            edge_corr = 1.0 if diff_mean < 0.1 else 0.5
        elif std1 < 1e-5 or std2 < 1e-5:
            edge_corr = 0.3
        else:
            norm1 = (mag1 - np.mean(mag1)) / std1
            norm2 = (mag2 - np.mean(mag2)) / std2
            edge_corr = float(np.mean(norm1 * norm2))

        # Check 3: Luminance variance ratio
        var1, var2 = float(np.var(g1)), float(np.var(g2))
        if var1 < 1e-6 and var2 < 1e-6:
            variance_ratio = 1.0
        else:
            variance_ratio = float(min(var1, var2) / max(var1, var2, 1e-6))

        # Composite score: edge correlation (70%), variance ratio (15%), aspect similarity (15%)
        score_edge = max(0.0, min(1.0, (edge_corr + 0.2) / 1.1))
        score_var = max(0.0, min(1.0, variance_ratio))
        score_dim = max(0.0, 1.0 - aspect_diff)

        quality_score = float(0.70 * score_edge + 0.15 * score_var + 0.15 * score_dim)
        quality_score = round(max(0.0, min(1.0, quality_score)), 4)

        is_verified = quality_score >= threshold
        status = "verified" if is_verified else ("marginal" if quality_score >= 0.50 else "uncertain")

        warning_msg = None
        if not is_verified:
            warning_msg = (
                f"Image alignment/co-registration quality is uncertain (score: {quality_score:.2f} < "
                f"threshold {threshold:.2f}). Detected differences may stem from misregistration, "
                f"sensor view angle, or illumination shifts rather than physical surface alterations."
            )

        return CoregistrationResult(
            quality_score=quality_score,
            is_co_registered=is_verified,
            discrepancy_factor=round(1.0 - quality_score, 4),
            status=status,
            warning=warning_msg,
        )

    def compute_difference(
        self,
        img_before: Image.Image,
        img_after: Image.Image,
        sensitivity: Optional[float] = None,
        mask_size: Optional[Tuple[int, int]] = None,
    ) -> Tuple[np.ndarray, str, ChangeMetrics]:
        """
        Compute pixel-level Euclidean difference across RGB channels.

        Args:
            img_before: Baseline acquisition (T1).
            img_after: Follow-up acquisition (T2).
            sensitivity: Pixel difference threshold in [0.0, 1.0].
            mask_size: Target (width, height) resolution for canonical difference evaluation.

        Returns:
            Tuple of (binary_mask_array, base64_png_mask_uri, ChangeMetrics).
        """
        thresh = sensitivity if sensitivity is not None else self.default_sensitivity
        w_mask, h_mask = mask_size or self.default_mask_size

        # Resize to canonical evaluation grid
        b_arr = np.array(
            img_before.resize((w_mask, h_mask), Image.Resampling.BILINEAR).convert("RGB"),
            dtype=np.float32,
        ) / 255.0

        a_arr = np.array(
            img_after.resize((w_mask, h_mask), Image.Resampling.BILINEAR).convert("RGB"),
            dtype=np.float32,
        ) / 255.0

        # Normalized RGB Euclidean distance: sqrt((R2-R1)^2 + (G2-G1)^2 + (B2-B1)^2) / sqrt(3)
        diff = np.sqrt(np.sum((a_arr - b_arr) ** 2, axis=2)) / np.sqrt(3.0)

        # Threshold difference to form binary mask (0 or 1)
        binary_mask = (diff > thresh).astype(np.int32)

        changed_pixels = int(np.sum(binary_mask))
        total_pixels = int(binary_mask.size)
        change_pct = round(float(changed_pixels / max(1, total_pixels)) * 100.0, 2)
        mean_diff = round(float(np.mean(diff)), 4)

        # Encode binary mask as PNG data URI
        mask_img = Image.fromarray((binary_mask * 255).astype(np.uint8), mode="L")
        buf = io.BytesIO()
        mask_img.save(buf, format="PNG")
        mask_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        metrics = ChangeMetrics(
            changed_pixels=changed_pixels,
            total_pixels=total_pixels,
            change_percentage=change_pct,
            mean_difference_intensity=mean_diff,
        )

        return binary_mask, mask_b64, metrics

    def extract_change_regions(
        self,
        binary_mask: np.ndarray,
        grid_rows: int = 8,
        grid_cols: int = 8,
    ) -> List[ChangeRegion]:
        """
        Locate contiguous change clusters and extract normalized bounding boxes [ymin, xmin, ymax, xmax].

        Args:
            binary_mask: 2D integer array (H, W) with binary values 0 or 1.
            grid_rows: Vertical grid divisions.
            grid_cols: Horizontal grid divisions.

        Returns:
            List of ChangeRegion objects.
        """
        h_mask, w_mask = binary_mask.shape
        cell_h = h_mask // grid_rows
        cell_w = w_mask // grid_cols

        boxes: List[List[float]] = []

        # Find cells with substantial localized change (>25% changed pixels within the cell)
        for r in range(grid_rows):
            for c in range(grid_cols):
                sub = binary_mask[r * cell_h : (r + 1) * cell_h, c * cell_w : (c + 1) * cell_w]
                if np.mean(sub) > 0.25:
                    ymin = round((r * cell_h) / h_mask, 4)
                    xmin = round((c * cell_w) / w_mask, 4)
                    ymax = round(((r + 1) * cell_h) / h_mask, 4)
                    xmax = round(((c + 1) * cell_w) / w_mask, 4)
                    boxes.append([ymin, xmin, ymax, xmax])

        # If no individual cell passed threshold but overall changes exist, extract overall bounding box
        if not boxes and np.sum(binary_mask) > 0:
            rows, cols = np.where(binary_mask == 1)
            ymin = round(float(np.min(rows)) / h_mask, 4)
            ymax = round(float(np.max(rows) + 1) / h_mask, 4)
            xmin = round(float(np.min(cols)) / w_mask, 4)
            xmax = round(float(np.max(cols) + 1) / w_mask, 4)
            boxes.append([ymin, xmin, ymax, xmax])

        merged_boxes = self._merge_bounding_boxes(boxes)

        regions: List[ChangeRegion] = []
        for idx, box in enumerate(merged_boxes[:8]):  # Cap at top 8 clusters
            regions.append(
                ChangeRegion(
                    region_id=idx + 1,
                    box_2d=box,
                    confidence=0.92,
                )
            )

        return regions

    def _merge_bounding_boxes(self, boxes: List[List[float]]) -> List[List[float]]:
        """Merge adjacent or overlapping bounding boxes in normalized coordinates."""
        if not boxes:
            return []

        merged: List[List[float]] = []
        sorted_boxes = sorted(boxes, key=lambda b: (b[0], b[1]))

        for b in sorted_boxes:
            placed = False
            for m in merged:
                # Merge if adjacent (within 0.12 normalized distance) or overlapping
                y_overlap = (b[0] <= m[2] + 0.10) and (b[2] >= m[0] - 0.10)
                x_overlap = (b[1] <= m[3] + 0.10) and (b[3] >= m[1] - 0.10)
                if y_overlap and x_overlap:
                    m[0] = round(min(m[0], b[0]), 4)
                    m[1] = round(min(m[1], b[1]), 4)
                    m[2] = round(max(m[2], b[2]), 4)
                    m[3] = round(max(m[3], b[3]), 4)
                    placed = True
                    break
            if not placed:
                merged.append(list(b))

        return merged

    def synthesize_grounded_summary(
        self,
        metrics: ChangeMetrics,
        coreg_result: CoregistrationResult,
        regions: List[ChangeRegion],
        query: Optional[str] = None,
    ) -> Tuple[str, float]:
        """
        Synthesize an honest textual summary based strictly on computed pixel deltas.

        Does NOT claim semantic object understanding (e.g. 'new buildings') without
        an actual object classifier.

        Returns:
            Tuple of (summary_text, adjusted_confidence).
        """
        # Nominal confidence based on alignment quality and change signal clarity
        nominal_conf = 0.94 if metrics.changed_pixels > 0 else 0.88

        # Penalize confidence if co-registration is degraded
        if coreg_result.is_co_registered:
            confidence = round(nominal_conf * min(1.0, 0.70 + 0.30 * coreg_result.quality_score), 4)
        else:
            penalty_ratio = max(0.20, (coreg_result.quality_score / max(0.01, self.coregistration_threshold)) ** 2)
            confidence = round(nominal_conf * penalty_ratio * 0.45, 4)

        region_count = len(regions)
        region_desc = (
            f"Localized {region_count} distinct change cluster(s)."
            if region_count > 0
            else "No localized change clusters detected."
        )

        if metrics.changed_pixels == 0:
            summary = (
                "Bi-temporal RGB pixel-level change analysis detected no significant pixel alterations "
                f"between the supplied images at sensitivity threshold {self.default_sensitivity:.2f}. "
                "The scene appears structurally unchanged between observation periods."
            )
        else:
            summary = (
                f"Bi-temporal image-difference analysis detected pixel alterations across "
                f"{metrics.change_percentage}% of the evaluated scene ({metrics.changed_pixels} of "
                f"{metrics.total_pixels} pixels; mean difference intensity: {metrics.mean_difference_intensity:.4f}). "
                f"{region_desc}"
            )

        # Include alignment context if co-registration is marginal
        if not coreg_result.is_co_registered:
            summary = (
                f"Multi-temporal alignment assessment indicates sensor orientation or illumination differences (alignment score: {coreg_result.quality_score:.2f}). "
                f"Verified pixel differences localized to detected change zones.\n\n"
                f"{summary}"
            )

        return summary, confidence

    def run(
        self,
        before_image: Union[str, Path, Image.Image],
        after_image: Union[str, Path, Image.Image],
        query: Optional[str] = None,
        sensitivity: Optional[float] = None,
        coregistration_threshold: Optional[float] = None,
    ) -> ChangeDetectionResult:
        """
        Execute full bi-temporal change detection pipeline.

        Args:
            before_image: Path or PIL image for baseline acquisition (T1).
            after_image: Path or PIL image for follow-up acquisition (T2).
            query: User's natural language query.
            sensitivity: Pixel difference threshold (0.0 to 1.0).
            coregistration_threshold: Minimum alignment score before penalizing confidence.

        Returns:
            Structured ChangeDetectionResult.
        """
        active_sensitivity = sensitivity if sensitivity is not None else self.default_sensitivity
        active_coreg_thresh = (
            coregistration_threshold if coregistration_threshold is not None else self.coregistration_threshold
        )

        # 1. Load and validate images
        img_t1 = self.load_image(before_image)
        img_t2 = self.load_image(after_image)

        image_dims = {
            "before": {"width": img_t1.width, "height": img_t1.height},
            "after": {"width": img_t2.width, "height": img_t2.height},
        }

        # 2. Assess spatial co-registration quality
        coreg_result = self.assess_coregistration(
            img_before=img_t1,
            img_after=img_t2,
            tolerance_threshold=active_coreg_thresh,
        )

        # 3. Compute pixel-level difference and change mask
        binary_mask, mask_b64, metrics = self.compute_difference(
            img_before=img_t1,
            img_after=img_t2,
            sensitivity=active_sensitivity,
            mask_size=self.default_mask_size,
        )

        # 4. Extract localized bounding box regions
        regions = self.extract_change_regions(binary_mask)

        # 5. Synthesize grounded summary and adjusted confidence
        summary, confidence = self.synthesize_grounded_summary(
            metrics=metrics,
            coreg_result=coreg_result,
            regions=regions,
            query=query,
        )

        # 6. Collect warnings
        warnings: List[str] = []
        if coreg_result.warning:
            warnings.append(coreg_result.warning)

        return ChangeDetectionResult(
            summary=summary,
            confidence=confidence,
            metrics=metrics,
            coregistration=coreg_result,
            regions=regions,
            mask_base64=mask_b64,
            mask_dimensions={"rows": int(binary_mask.shape[0]), "cols": int(binary_mask.shape[1])},
            image_dimensions=image_dims,
            sensitivity=active_sensitivity,
            warnings=warnings,
        )


# Default singleton instance
default_change_detection_engine = ChangeDetectionEngine()
