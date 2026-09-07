"""Classification metrics for Query Understanding evaluation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set


def accuracy_score(y_true: List[str], y_pred: List[str]) -> float:
    """Calculate standard classification accuracy."""
    if not y_true or not y_pred:
        return 0.0
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have identical length")

    correct = sum(1 for yt, yp in zip(y_true, y_pred) if yt == yp)
    return round(correct / len(y_true), 4)


def precision_recall_f1_support(
    y_true: List[str],
    y_pred: List[str],
    labels: Optional[List[str]] = None,
) -> Dict[str, Dict[str, float]]:
    """Compute per-class precision, recall, F1-score, and support."""
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have identical length")

    all_labels = sorted(list(set(y_true).union(set(y_pred)))) if labels is None else labels
    metrics: Dict[str, Dict[str, float]] = {}

    for label in all_labels:
        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == label and yp == label)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt != label and yp == label)
        fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == label and yp != label)
        support = sum(1 for yt in y_true if yt == label)

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
        f1 = (
            round(2 * (precision * recall) / (precision + recall), 4)
            if (precision + recall) > 0
            else 0.0
        )

        metrics[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }

    return metrics


def calculate_classification_metrics(
    y_true: List[str],
    y_pred: List[str],
    labels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Calculate overall classification metrics (accuracy, macro F1, weighted F1, confusion)."""
    if not y_true:
        return {
            "accuracy": 0.0,
            "macro_f1": 0.0,
            "macro_precision": 0.0,
            "macro_recall": 0.0,
            "weighted_f1": 0.0,
            "per_class": {},
            "total_samples": 0,
        }

    acc = accuracy_score(y_true, y_pred)
    per_class = precision_recall_f1_support(y_true, y_pred, labels=labels)

    num_classes = len(per_class)
    total_samples = len(y_true)

    if num_classes > 0:
        macro_prec = round(sum(v["precision"] for v in per_class.values()) / num_classes, 4)
        macro_rec = round(sum(v["recall"] for v in per_class.values()) / num_classes, 4)
        macro_f1 = round(sum(v["f1"] for v in per_class.values()) / num_classes, 4)

        weighted_f1 = (
            round(sum(v["f1"] * v["support"] for v in per_class.values()) / total_samples, 4)
            if total_samples > 0
            else 0.0
        )
    else:
        macro_prec = macro_rec = macro_f1 = weighted_f1 = 0.0

    return {
        "accuracy": acc,
        "macro_precision": macro_prec,
        "macro_recall": macro_rec,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "per_class": per_class,
        "total_samples": total_samples,
    }
