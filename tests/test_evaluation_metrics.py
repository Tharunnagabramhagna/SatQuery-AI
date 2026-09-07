"""Unit and regression tests for ML Evaluation Metrics and Runner."""

import asyncio
import pytest

from evaluation.metrics.change_detection import (
    binary_precision_recall_f1,
    calculate_change_detection_metrics,
    change_percentage_delta,
)
from evaluation.metrics.classification import (
    accuracy_score,
    calculate_classification_metrics,
    precision_recall_f1_support,
)
from evaluation.metrics.grounding import (
    calculate_grounding_metrics,
    iou_score,
    semantic_match_score,
)
from evaluation.metrics.routing import calculate_routing_metrics
from evaluation.metrics.vqa import (
    calculate_vqa_metrics,
    exact_match_score,
    keyword_recall_score,
    normalize_answer,
    token_f1_score,
)
from evaluation.runner import EvaluationRunner


# -----------------------------------------------------------------------------
# 1. Classification Metrics Tests
# -----------------------------------------------------------------------------

def test_accuracy_score():
    assert accuracy_score(["A", "B", "C"], ["A", "B", "C"]) == 1.0
    assert accuracy_score(["A", "B", "C"], ["A", "B", "X"]) == 0.6667
    assert accuracy_score([], []) == 0.0

    with pytest.raises(ValueError):
        accuracy_score(["A"], ["A", "B"])


def test_precision_recall_f1_support():
    y_true = ["VQA", "VQA", "GROUNDING", "GROUNDING"]
    y_pred = ["VQA", "GROUNDING", "GROUNDING", "VQA"]

    metrics = precision_recall_f1_support(y_true, y_pred)
    assert "VQA" in metrics
    assert "GROUNDING" in metrics
    assert metrics["VQA"]["precision"] == 0.5
    assert metrics["VQA"]["recall"] == 0.5
    assert metrics["VQA"]["f1"] == 0.5
    assert metrics["VQA"]["support"] == 2


def test_calculate_classification_metrics_empty():
    res = calculate_classification_metrics([], [])
    assert res["accuracy"] == 0.0
    assert res["total_samples"] == 0


def test_calculate_classification_metrics_multiclass():
    y_true = ["A", "B", "C"]
    y_pred = ["A", "B", "C"]
    res = calculate_classification_metrics(y_true, y_pred)
    assert res["accuracy"] == 1.0
    assert res["macro_f1"] == 1.0
    assert res["weighted_f1"] == 1.0


# -----------------------------------------------------------------------------
# 2. Routing Metrics Tests
# -----------------------------------------------------------------------------

def test_calculate_routing_metrics():
    y_true = ["vqa_tool", "grounding_tool", "change_detection_tool"]
    y_pred = ["vqa_tool", "clarification_tool", "change_detection_tool"]

    res = calculate_routing_metrics(y_true, y_pred, fallback_tool="clarification_tool")
    assert res["routing_accuracy"] == 0.6667
    assert res["fallback_rate"] == 0.3333
    assert res["wrong_tool_rate"] == 0.3333
    assert res["total_cases"] == 3


def test_calculate_routing_metrics_empty():
    res = calculate_routing_metrics([], [])
    assert res["routing_accuracy"] == 0.0
    assert res["total_cases"] == 0


# -----------------------------------------------------------------------------
# 3. Change Detection Metrics Tests
# -----------------------------------------------------------------------------

def test_change_percentage_delta():
    assert change_percentage_delta(15.5, 12.0) == 3.5
    assert change_percentage_delta(None, 12.0) is None
    assert change_percentage_delta(10.0, None) is None


def test_binary_precision_recall_f1():
    res = binary_precision_recall_f1(True, True)
    assert res["tp"] == 1 and res["fp"] == 0
    res = binary_precision_recall_f1(True, False)
    assert res["fp"] == 1 and res["tp"] == 0


def test_calculate_change_detection_metrics():
    pred_changed = [True, False, True, False]
    exp_changed = [True, False, False, True]
    pred_pct = [10.0, 0.0, 5.0, 0.0]
    exp_pct = [9.0, 0.0, 0.0, 8.0]

    res = calculate_change_detection_metrics(
        pred_changed, exp_changed, pred_pct, exp_pct
    )
    assert res["binary_accuracy"] == 0.5
    assert res["total_cases"] == 4
    assert res["mean_pct_delta"] is not None


# -----------------------------------------------------------------------------
# 4. VQA Metrics Tests
# -----------------------------------------------------------------------------

def test_normalize_answer():
    assert normalize_answer("  The Apple, is Red! ") == "apple is red"


def test_exact_match_score():
    assert exact_match_score("A Runway", "runway") == 1.0
    assert exact_match_score("Aircraft", "airport") == 0.0


def test_token_f1_score():
    assert token_f1_score("runway and airport", "airport and runway") == 1.0
    assert token_f1_score("completely different", "nothing here") == 0.0
    assert 0.0 < token_f1_score("large cargo ship", "cargo ship") < 1.0


def test_keyword_recall_score():
    assert keyword_recall_score("There is a large airport and runway", ["airport", "runway"]) == 1.0
    assert keyword_recall_score("There is only a forest", ["airport", "runway"]) == 0.0
    assert keyword_recall_score("An airport was found", ["airport", "runway"]) == 0.5
    assert keyword_recall_score("empty check", []) == 1.0


def test_calculate_vqa_metrics():
    predictions = ["yes runway", "no water"]
    keywords = [["runway"], ["water"]]
    res = calculate_vqa_metrics(predictions, keywords)
    assert res["mean_keyword_recall"] == 1.0
    assert res["total_cases"] == 2


# -----------------------------------------------------------------------------
# 5. Grounding Metrics Tests
# -----------------------------------------------------------------------------

def test_semantic_match_score():
    assert semantic_match_score(["buildings", "roads"], ["buildings"]) == 1.0
    assert semantic_match_score(["vegetation"], ["buildings", "roads"]) == 0.0
    assert semantic_match_score([], []) == 1.0
    assert semantic_match_score([], ["buildings"]) == 0.0


def test_iou_score():
    box1 = {"x_min": 0.0, "y_min": 0.0, "x_max": 0.5, "y_max": 0.5}
    box2 = {"x_min": 0.0, "y_min": 0.0, "x_max": 0.5, "y_max": 0.5}
    assert iou_score(box1, box2) == 1.0

    box3 = {"x_min": 0.6, "y_min": 0.6, "x_max": 1.0, "y_max": 1.0}
    assert iou_score(box1, box3) == 0.0


def test_calculate_grounding_metrics():
    pred_ents = [["aircraft"], ["buildings"]]
    exp_ents = [["aircraft"], ["roads"]]
    res = calculate_grounding_metrics(pred_ents, exp_ents)
    assert res["mean_semantic_match"] == 0.5
    assert res["total_cases"] == 2


# -----------------------------------------------------------------------------
# 6. Evaluation Runner Tests
# -----------------------------------------------------------------------------

def test_evaluation_runner_loads_dataset():
    runner = EvaluationRunner()
    cases = runner.load_dataset()
    assert len(cases) == 60


def test_load_benchmark_dataset_loader():
    from evaluation.datasets.loader import load_benchmark_dataset
    cases = load_benchmark_dataset()
    assert len(cases) == 60
    assert cases[0].case_id == "QU_VQA_001"


def test_evaluation_runner_evaluates_case():
    runner = EvaluationRunner()
    case = {
        "case_id": "TEST_001",
        "category": "query_understanding",
        "capability": "VQA",
        "expected_intent": "VQA",
        "expected_tool": "vqa_tool",
        "query": "Is there an airport visible in this scene?",
        "expected_entities": ["roads_infrastructure"],
    }
    result = asyncio.run(runner.evaluate_case(case))
    assert result["case_id"] == "TEST_001"
    assert result["passed"] is True
    assert result["details"]["predicted_intent"] == "VQA"

