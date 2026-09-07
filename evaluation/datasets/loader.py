"""Evaluation dataset models and loader for SatQuery AI."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


EvaluationType = Literal["synthetic_unit", "manually_curated", "real_annotated"]


class EvaluationCase(BaseModel):
    """Schema representing a single benchmark evaluation case."""

    case_id: str = Field(..., description="Unique identifier for evaluation case (e.g. QU_001)")
    query: str = Field(..., description="Natural language input query")
    category: str = Field(..., description="Evaluation category: query_understanding, agent_routing, vqa, grounding, change_detection")
    capability: str = Field(..., description="Target analytical capability")
    expected_intent: str = Field(..., description="Expected QueryIntent value (e.g. VQA, GROUNDING, CHANGE_DETECTION)")
    expected_tool: str = Field(..., description="Expected tool identifier (e.g. vqa_tool, change_detection_tool)")
    expected_entities: List[str] = Field(default_factory=list, description="Expected target objects or entities")
    expected_spatial: Optional[Dict[str, Any]] = Field(default=None, description="Expected spatial properties")
    expected_temporal: Optional[Dict[str, Any]] = Field(default=None, description="Expected temporal properties")
    evaluation_type: EvaluationType = Field(
        ...,
        description="Type of evaluation: synthetic_unit, manually_curated, or real_annotated",
    )
    test_inputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="Runtime tool arguments (e.g. image paths, parameters)",
    )
    expected_output: Dict[str, Any] = Field(
        default_factory=dict,
        description="Expected task outcome (e.g. change presence, reference answer, keywords)",
    )
    description: Optional[str] = Field(default=None, description="Human-readable description of test case")


DEFAULT_DATASET_PATH = os.path.join(
    os.path.dirname(__file__), "benchmark_cases.json"
)


def load_benchmark_dataset(path: Optional[str] = None) -> List[EvaluationCase]:
    """Load and validate benchmark evaluation cases from JSON file."""
    dataset_file = path or DEFAULT_DATASET_PATH
    if not os.path.exists(dataset_file):
        raise FileNotFoundError(f"Evaluation dataset not found at: {dataset_file}")

    with open(dataset_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError(f"Dataset root must be a list of cases, got: {type(data)}")

    cases = [EvaluationCase.model_validate(item) for item in data]
    return cases
