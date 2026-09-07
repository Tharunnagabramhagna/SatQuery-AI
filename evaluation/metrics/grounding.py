"""Grounding evaluation metrics: Semantic Match Accuracy and IoU utilities."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def semantic_match_score(
    predicted_entities: List[str],
    expected_entities: List[str],
) -> float:
    """Calculate semantic entity match accuracy.

    Measures how many expected entities are found (case-insensitive)
    in the predicted entity list.
    """
    if not expected_entities:
        return 1.0
    if not predicted_entities:
        return 0.0

    pred_lower = {e.lower().strip() for e in predicted_entities}
    exp_lower = {e.lower().strip() for e in expected_entities}

    hits = len(pred_lower.intersection(exp_lower))
    return round(hits / len(exp_lower), 4)


def iou_score(
    pred_box: Dict[str, float],
    gt_box: Dict[str, float],
) -> float:
    """Calculate Intersection-over-Union between two bounding boxes.

    Boxes are dicts with keys: x_min, y_min, x_max, y_max (normalized 0-1).
    """
    x1 = max(pred_box["x_min"], gt_box["x_min"])
    y1 = max(pred_box["y_min"], gt_box["y_min"])
    x2 = min(pred_box["x_max"], gt_box["x_max"])
    y2 = min(pred_box["y_max"], gt_box["y_max"])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0.0

    pred_area = (pred_box["x_max"] - pred_box["x_min"]) * (pred_box["y_max"] - pred_box["y_min"])
    gt_area = (gt_box["x_max"] - gt_box["x_min"]) * (gt_box["y_max"] - gt_box["y_min"])
    union_area = pred_area + gt_area - inter_area

    if union_area <= 0:
        return 0.0

    return round(inter_area / union_area, 4)


def calculate_grounding_metrics(
    predicted_entities_list: List[List[str]],
    expected_entities_list: List[List[str]],
    predicted_boxes: Optional[List[Optional[Dict[str, float]]]] = None,
    expected_boxes: Optional[List[Optional[Dict[str, float]]]] = None,
) -> Dict[str, Any]:
    """Compute aggregate grounding evaluation metrics.

    Args:
        predicted_entities_list: Per-case list of predicted entity names.
        expected_entities_list: Per-case list of ground-truth entity names.
        predicted_boxes: Optional per-case predicted bounding box.
        expected_boxes: Optional per-case ground-truth bounding box.
    """
    if not expected_entities_list:
        return {
            "mean_semantic_match": 0.0,
            "mean_iou": 0.0,
            "total_cases": 0,
            "iou_evaluated_cases": 0,
        }

    total = len(expected_entities_list)

    # Semantic match
    sem_scores = [
        semantic_match_score(pred, exp)
        for pred, exp in zip(predicted_entities_list, expected_entities_list)
    ]
    mean_sem = round(sum(sem_scores) / total, 4)

    # IoU (only for cases where both boxes are available)
    iou_scores: List[float] = []
    if predicted_boxes and expected_boxes:
        for pb, gb in zip(predicted_boxes, expected_boxes):
            if pb is not None and gb is not None:
                iou_scores.append(iou_score(pb, gb))

    mean_iou = round(sum(iou_scores) / len(iou_scores), 4) if iou_scores else 0.0

    return {
        "mean_semantic_match": mean_sem,
        "mean_iou": mean_iou,
        "total_cases": total,
        "iou_evaluated_cases": len(iou_scores),
    }
