"""Routing metrics for Agent Router evaluation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def calculate_routing_metrics(
    y_true: List[str],
    y_pred: List[str],
    fallback_tool: str = "clarification_tool",
) -> Dict[str, Any]:
    """
    Calculate Agent Routing metrics:
    - Routing accuracy (correct tool chosen)
    - Wrong tool selection rate
    - Fallback rate (clarification tool invoked)
    """
    if not y_true or not y_pred:
        return {
            "routing_accuracy": 0.0,
            "wrong_tool_rate": 0.0,
            "fallback_rate": 0.0,
            "total_cases": 0,
            "correct_routings": 0,
        }

    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have identical length")

    total = len(y_true)
    correct = sum(1 for yt, yp in zip(y_true, y_pred) if yt.lower() == yp.lower())
    fallbacks = sum(1 for yp in y_pred if yp.lower() == fallback_tool.lower())
    wrong = total - correct

    return {
        "routing_accuracy": round(correct / total, 4),
        "wrong_tool_rate": round(wrong / total, 4),
        "fallback_rate": round(fallbacks / total, 4),
        "total_cases": total,
        "correct_routings": correct,
    }
