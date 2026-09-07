"""Change Detection evaluation metrics: Pixel-level Precision, Recall, F1, IoU, and change percentage delta."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def binary_precision_recall_f1(
    predicted_changed: bool,
    expected_changed: bool,
) -> Dict[str, float]:
    """Calculate binary change/no-change classification metrics for a single case.

    Returns dict with tp, fp, fn, tn counts (each 0 or 1).
    """
    tp = 1 if predicted_changed and expected_changed else 0
    fp = 1 if predicted_changed and not expected_changed else 0
    fn = 1 if not predicted_changed and expected_changed else 0
    tn = 1 if not predicted_changed and not expected_changed else 0
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn}


def change_percentage_delta(
    predicted_pct: Optional[float],
    expected_pct: Optional[float],
) -> Optional[float]:
    """Compute absolute difference between predicted and expected change percentage."""
    if predicted_pct is None or expected_pct is None:
        return None
    return round(abs(predicted_pct - expected_pct), 4)


def calculate_change_detection_metrics(
    predicted_changed_list: List[bool],
    expected_changed_list: List[bool],
    predicted_pct_list: Optional[List[Optional[float]]] = None,
    expected_pct_list: Optional[List[Optional[float]]] = None,
) -> Dict[str, Any]:
    """Compute aggregate change detection evaluation metrics.

    Args:
        predicted_changed_list: Per-case boolean predictions (change detected?).
        expected_changed_list: Per-case boolean ground truth.
        predicted_pct_list: Optional per-case predicted change percentage.
        expected_pct_list: Optional per-case expected change percentage.
    """
    if not expected_changed_list:
        return {
            "binary_accuracy": 0.0,
            "binary_precision": 0.0,
            "binary_recall": 0.0,
            "binary_f1": 0.0,
            "mean_pct_delta": None,
            "total_cases": 0,
            "pct_evaluated_cases": 0,
        }

    total = len(expected_changed_list)
    tp_sum = fp_sum = fn_sum = tn_sum = 0

    for pred, exp in zip(predicted_changed_list, expected_changed_list):
        result = binary_precision_recall_f1(pred, exp)
        tp_sum += result["tp"]
        fp_sum += result["fp"]
        fn_sum += result["fn"]
        tn_sum += result["tn"]

    accuracy = round((tp_sum + tn_sum) / total, 4)
    precision = round(tp_sum / (tp_sum + fp_sum), 4) if (tp_sum + fp_sum) > 0 else 0.0
    recall = round(tp_sum / (tp_sum + fn_sum), 4) if (tp_sum + fn_sum) > 0 else 0.0
    f1 = (
        round(2 * (precision * recall) / (precision + recall), 4)
        if (precision + recall) > 0
        else 0.0
    )

    # Change percentage deltas
    pct_deltas: List[float] = []
    if predicted_pct_list and expected_pct_list:
        for pp, ep in zip(predicted_pct_list, expected_pct_list):
            d = change_percentage_delta(pp, ep)
            if d is not None:
                pct_deltas.append(d)

    mean_pct_delta = round(sum(pct_deltas) / len(pct_deltas), 4) if pct_deltas else None

    return {
        "binary_accuracy": accuracy,
        "binary_precision": precision,
        "binary_recall": recall,
        "binary_f1": f1,
        "mean_pct_delta": mean_pct_delta,
        "total_cases": total,
        "pct_evaluated_cases": len(pct_deltas),
    }
