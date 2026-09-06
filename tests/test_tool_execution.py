"""Unit tests for Block 4: Tool Execution Architecture."""

import asyncio
from typing import Any, Dict
import pytest
from fastapi.testclient import TestClient

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.tools.base import BaseTool
from backend.agents.tools.executor import ToolExecutor
from backend.agents.tools.registry import (
    ToolNotFoundError,
    ToolRegistry,
    default_tool_registry,
)
from backend.main import app
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import RoutingDecision, ToolIdentifier
from backend.schemas.tool import ToolResult, ToolStatus

client = TestClient(app)


# -----------------------------------------------------------------------------
# 1. Tool Registry Tests
# -----------------------------------------------------------------------------

def test_tool_registry_contains_all_expected_tools():
    """Verify registry is initialized with all 5 required tools."""
    registry = ToolRegistry()
    assert registry.has_tool(ToolIdentifier.VQA_TOOL)
    assert registry.has_tool(ToolIdentifier.GROUNDING_TOOL)
    assert registry.has_tool(ToolIdentifier.CHANGE_DETECTION_TOOL)
    assert registry.has_tool(ToolIdentifier.COMPARISON_TOOL)
    assert registry.has_tool(ToolIdentifier.CLARIFICATION_TOOL)


def test_resolve_vqa_tool():
    """Verify VQA tool resolves properly."""
    tool = default_tool_registry.get(ToolIdentifier.VQA_TOOL)
    assert tool.tool_id == ToolIdentifier.VQA_TOOL
    assert "Visual Question Answering" in tool.name


def test_resolve_grounding_tool():
    """Verify Grounding tool resolves properly."""
    tool = default_tool_registry.get(ToolIdentifier.GROUNDING_TOOL)
    assert tool.tool_id == ToolIdentifier.GROUNDING_TOOL
    assert "Grounding" in tool.name


def test_resolve_change_detection_tool():
    """Verify Change Detection tool resolves properly."""
    tool = default_tool_registry.get(ToolIdentifier.CHANGE_DETECTION_TOOL)
    assert tool.tool_id == ToolIdentifier.CHANGE_DETECTION_TOOL
    assert "Change Detection" in tool.name


def test_resolve_comparison_tool():
    """Verify Comparison tool resolves properly."""
    tool = default_tool_registry.get(ToolIdentifier.COMPARISON_TOOL)
    assert tool.tool_id == ToolIdentifier.COMPARISON_TOOL
    assert "Comparison" in tool.name


def test_resolve_clarification_tool():
    """Verify Clarification tool resolves properly."""
    tool = default_tool_registry.get(ToolIdentifier.CLARIFICATION_TOOL)
    assert tool.tool_id == ToolIdentifier.CLARIFICATION_TOOL
    assert "Clarification" in tool.name


def test_unregistered_tool_raises_error():
    """Verify requesting unregistered tool raises ToolNotFoundError."""
    registry = ToolRegistry()
    with pytest.raises(ToolNotFoundError):
        registry.get("NON_EXISTENT_TOOL")


# -----------------------------------------------------------------------------
# 2. Tool Execution Tests
# -----------------------------------------------------------------------------

def test_placeholder_tools_return_not_implemented():
    """Verify specialist placeholder tools return not_implemented rather than fabricated answers."""
    executor = ToolExecutor()

    # Test remaining placeholder tools (Comparison)
    tools_to_test = [
        (ToolIdentifier.COMPARISON_TOOL, QueryIntent.COMPARISON),
    ]

    for tool_id, intent in tools_to_test:
        rd = RoutingDecision(
            selected_tool=tool_id,
            intent=intent,
            routing_confidence=0.90,
            reason="Test routing",
            requires_clarification=False,
            parameters={"test_param": "val"},
        )
        res = asyncio.run(executor.execute(rd))
        assert res.status == ToolStatus.NOT_IMPLEMENTED.value
        assert res.answer is None  # CRITICAL: No fake answers
        assert res.confidence is None  # CRITICAL: No fake confidence
        assert len(res.evidence) == 0  # CRITICAL: No fake evidence
        assert len(res.visualizations) == 0  # CRITICAL: No fake bounding boxes / masks
        assert len(res.warnings) >= 1
        assert "placeholder" in res.warnings[0].lower() or "not yet connected" in res.warnings[0].lower()

    # VQA_TOOL is now a real tool, returning input_required when imagery is omitted
    rd_vqa = RoutingDecision(
        selected_tool=ToolIdentifier.VQA_TOOL,
        intent=QueryIntent.VQA,
        routing_confidence=0.90,
        reason="Test routing",
        requires_clarification=False,
        parameters={},
    )
    res_vqa = asyncio.run(executor.execute(rd_vqa))
    assert res_vqa.status == ToolStatus.INPUT_REQUIRED.value
    assert "requires a satellite image" in res_vqa.answer.lower()

    # GROUNDING_TOOL is now a real tool, returning input_required when imagery is omitted
    rd_grounding = RoutingDecision(
        selected_tool=ToolIdentifier.GROUNDING_TOOL,
        intent=QueryIntent.GROUNDING,
        routing_confidence=0.90,
        reason="Test routing",
        requires_clarification=False,
        parameters={},
    )
    res_grounding = asyncio.run(executor.execute(rd_grounding))
    assert res_grounding.status == ToolStatus.INPUT_REQUIRED.value
    assert "requires a satellite image" in res_grounding.answer.lower()

    # CHANGE_DETECTION_TOOL is a real tool in Block 5, returning input_required when imagery is omitted
    rd_cd = RoutingDecision(
        selected_tool=ToolIdentifier.CHANGE_DETECTION_TOOL,
        intent=QueryIntent.CHANGE_DETECTION,
        routing_confidence=0.90,
        reason="Test routing",
        requires_clarification=False,
        parameters={},
    )
    res_cd = asyncio.run(executor.execute(rd_cd))
    assert res_cd.status == ToolStatus.INPUT_REQUIRED.value
    assert "requires before and after imagery" in res_cd.answer.lower()


def test_clarification_tool_returns_clarification_prompt():
    """Verify Clarification tool returns the designated clarification prompt as its answer."""
    executor = ToolExecutor()
    prompt = "Please specify whether you want single-image or bi-temporal analysis."
    rd = RoutingDecision(
        selected_tool=ToolIdentifier.CLARIFICATION_TOOL,
        intent=QueryIntent.UNKNOWN,
        routing_confidence=0.85,
        reason="Ambiguous instruction",
        requires_clarification=True,
        clarification_prompt=prompt,
    )

    res = asyncio.run(executor.execute(rd))
    assert res.status == ToolStatus.CLARIFICATION_NEEDED.value
    assert res.answer == prompt
    assert res.confidence == 0.85


def test_unknown_tool_identifier_produces_structured_error():
    """Verify unknown tool returns structured ToolResult with status 'error' without crashing."""
    executor = ToolExecutor()
    # Construct RoutingDecision with invalid tool name bypass
    rd = RoutingDecision.model_construct(
        selected_tool="INVALID_UNKNOWN_TOOL",  # type: ignore
        intent=QueryIntent.UNKNOWN,
        routing_confidence=0.5,
        reason="Invalid tool test",
        requires_clarification=False,
        parameters={},
    )

    res = asyncio.run(executor.execute(rd))
    assert res.status == ToolStatus.ERROR.value
    assert res.answer is None
    assert len(res.warnings) >= 1
    assert "not registered" in res.warnings[0] or "unknown" in res.warnings[0].lower()


def test_tool_execution_exception_produces_structured_error():
    """Verify unexpected exception inside tool returns structured ToolResult with status 'error'."""
    class FailingTool(BaseTool):
        tool_id = ToolIdentifier.VQA_TOOL
        name = "Crashing VQA Tool"
        description = "Simulates an unhandled exception"

        async def execute(self, params: Dict[str, Any]) -> ToolResult:
            raise RuntimeError("CUDA device out of memory simulated error")

    registry = ToolRegistry()
    registry.register(FailingTool())
    executor = ToolExecutor(registry=registry)

    rd = RoutingDecision(
        selected_tool=ToolIdentifier.VQA_TOOL,
        intent=QueryIntent.VQA,
        routing_confidence=0.9,
        reason="Test crash handling",
    )

    res = asyncio.run(executor.execute(rd))
    assert res.status == ToolStatus.ERROR.value
    assert "CUDA device out of memory" in res.warnings[0]


# -----------------------------------------------------------------------------
# 3. API Integration & Execution Trace Tests
# -----------------------------------------------------------------------------

def test_api_query_returns_tool_result_and_three_stage_trace():
    """Verify POST /api/query returns tool_result and 3-step execution trace."""
    query = "What changed between 2023 and 2025?"
    response = client.post("/api/query", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    # Block 1 & 2 contract checks
    assert data["received_query"] == query
    assert data["status"] == "received"
    assert data["task"] == "CHANGE_DETECTION"
    assert data["routing_decision"]["selected_tool"] == "CHANGE_DETECTION_TOOL"

    # Block 4 & 5 ToolResult check
    assert "tool_result" in data
    tr = data["tool_result"]
    assert tr["tool_name"] == "CHANGE_DETECTION_TOOL"
    assert tr["status"] == "input_required"
    assert "requires before and after imagery" in tr["answer"].lower()

    # Block 4 Execution Trace (Step 1, Step 2, Step 3)
    trace = data["execution_trace"]
    assert len(trace) == 3

    assert trace[0]["step"] == 1
    assert trace[0]["action"] == "Query Understanding"
    assert trace[0]["status"] == "completed"

    assert trace[1]["step"] == 2
    assert trace[1]["action"] == "Agent Routing"
    assert trace[1]["status"] == "completed"

    assert trace[2]["step"] == 3
    assert trace[2]["action"] == "Tool Execution"
    assert "CHANGE_DETECTION_TOOL" in trace[2]["detail"]
    assert "input_required" in trace[2]["detail"]
    assert trace[2]["status"] == "completed"


def test_api_query_clarification_tool_answer_population():
    """Verify out-of-domain query returns clarification prompt in answer and tool_result."""
    query = "What is the capital of France?"
    response = client.post("/api/query", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    assert data["routing_decision"]["selected_tool"] == "CLARIFICATION_TOOL"
    assert data["tool_result"]["status"] == "clarification_needed"
    assert data["answer"] is not None
    assert "Earth Observation" in data["answer"] or "remote sensing" in data["answer"]
