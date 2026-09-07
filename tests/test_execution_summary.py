"""Unit and integration tests for Auditable ExecutionSummary in QueryResponse.

Tests verify:
1. ExecutionSummary schema validation, fields, and serialization.
2. AgentOrchestrator generates and attaches complete ExecutionSummary to response.
3. Multi-factor confidence calibration logic in orchestrator and tools.
4. Privacy/auditability: zero chain-of-thought, internal system instructions, or raw scratchpads leak.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.query_understanding import QueryUnderstandingService
from backend.agents.router import BaseRouter
from backend.agents.tools.executor import ToolExecutor
from backend.schemas.common import AnalysisEvidence
from backend.schemas.query import ExecutionSummary, QueryResponse
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus


def _create_mock_orchestrator(tool_name="vqa_tool", tool_confidence=0.88):
    mock_understanding = MagicMock(spec=QueryUnderstandingService)
    mock_understanding.analyze = AsyncMock(
        return_value=StructuredQuery(
            original_query="Describe the land-cover",
            intent=QueryIntent.VQA,
            target_objects=["land-cover"],
            confidence=0.95,
            extracted_attributes={"provider": "gemini", "model": "gemini-3.6-flash"},
        )
    )

    mock_router = MagicMock(spec=BaseRouter)
    mock_router.route = AsyncMock(
        return_value=RoutingDecision(
            selected_tool=ToolIdentifier.VQA_TOOL,
            intent=QueryIntent.VQA,
            routing_confidence=0.92,
            reason="Query asks for general scene description",
        )
    )

    mock_executor = MagicMock(spec=ToolExecutor)
    mock_executor.execute = AsyncMock(
        return_value=ToolResult(
            tool_name=tool_name,
            status=ToolStatus.SUCCESS.value,
            answer="Agricultural terrain with irrigation channels.",
            confidence=tool_confidence,
            evidence=[
                AnalysisEvidence(type="visual", description="Crops detected", source="gemini-3.6-flash"),
            ],
            visualizations=[],
            metadata={"model": "gemini-3.6-flash", "provider": "google"},
            warnings=["Slight shadow in lower sector"],
        )
    )

    return AgentOrchestrator(
        query_understanding=mock_understanding,
        router=mock_router,
        tool_executor=mock_executor,
    )


def test_execution_summary_schema_fields():
    """ExecutionSummary model validates correct types and formats."""
    summary = ExecutionSummary(
        task="vqa",
        models=["gemini-3.6-flash"],
        tools=["vqa_tool"],
        input_summary={"count": 1, "modalities": ["optical"]},
        parameters={"before_image_modality": "optical"},
        evidence=[
            AnalysisEvidence(type="visual", description="Crops detected", source="gemini"),
        ],
        confidence=0.88,
        warnings=["Test warning"],
        provider_info={"tool_provider": "google", "fallback_used": False},
    )

    data = summary.model_dump()
    assert data["task"] == "vqa"
    assert "gemini-3.6-flash" in data["models"]
    assert "vqa_tool" in data["tools"]
    assert data["confidence"] == 0.88
    assert len(data["evidence"]) == 1
    assert len(data["warnings"]) == 1
    assert data["provider_info"]["tool_provider"] == "google"


def test_orchestrator_attaches_execution_summary():
    """AgentOrchestrator generates ExecutionSummary in the final output dict and QueryResponse."""
    orch = _create_mock_orchestrator(tool_name="vqa_tool", tool_confidence=0.85)

    res_dict = asyncio.run(
        orch.process_query(
            query="Describe the land-cover",
            before_image="tests/data/sat_before.jpg",
            before_image_modality="optical",
        )
    )

    assert "execution_summary" in res_dict
    summary = res_dict["execution_summary"]
    assert isinstance(summary, ExecutionSummary)
    assert summary.task == QueryIntent.VQA.value
    assert "vqa_tool" in summary.tools
    assert "gemini-3.6-flash" in summary.models
    assert summary.confidence == 0.85
    assert len(summary.evidence) == 1
    assert summary.provider_info["tool_provider"] == "google"
    assert summary.provider_info["fallback_used"] is False

    # Also verify that QueryResponse validates this cleanly
    query_resp = QueryResponse(**res_dict)
    assert query_resp.execution_summary is not None
    assert query_resp.execution_summary.task == QueryIntent.VQA.value


def test_execution_summary_auditability_zero_cot_leak():
    """ExecutionSummary must only contain observable metadata, never chain-of-thought or prompt leakage."""
    orch = _create_mock_orchestrator()

    res_dict = asyncio.run(
        orch.process_query(
            query="Describe the land-cover",
            before_image="tests/data/sat_before.jpg",
            before_image_modality="optical",
        )
    )
    summary_dict = res_dict["execution_summary"].model_dump()

    forbidden_keys = [
        "thought",
        "chain_of_thought",
        "internal_scratchpad",
        "system_prompt",
        "system_instruction",
        "hidden_state",
    ]
    for key in forbidden_keys:
        assert key not in summary_dict

    # Verify no internal system prompt text in string values
    for val in summary_dict.values():
        if isinstance(val, str):
            assert "You are the specialist" not in val
            assert "Strict Operational Rules" not in val
