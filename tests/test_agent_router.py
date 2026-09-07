"""Unit tests for Block 3: Agent Router and Tool Selection."""

import asyncio
import pytest
from fastapi.testclient import TestClient

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.agents.router.agent_router import AgentRouter
from backend.agents.router.base import BaseRouter
from backend.main import app
from backend.schemas.query_understanding import (
    ComparisonInfo,
    QueryIntent,
    SpatialInfo,
    StructuredQuery,
    TemporalInfo,
)
from backend.schemas.router import RoutingDecision, ToolIdentifier

client = TestClient(app)


@pytest.fixture
def classifier():
    return RuleBasedQueryClassifier()


@pytest.fixture
def router():
    return AgentRouter()


# -----------------------------------------------------------------------------
# 1. Standard Intent to Specialist Tool Mappings
# -----------------------------------------------------------------------------

def test_route_vqa_to_vqa_tool(classifier, router):
    """Verify VQA intent maps to VQA_TOOL."""
    query = "Describe this satellite scene and identify the land use."
    sq = asyncio.run(classifier.classify(query))
    assert sq.intent == QueryIntent.VQA

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.VQA_TOOL
    assert decision.intent == QueryIntent.VQA
    assert decision.requires_clarification is False
    assert decision.routing_confidence >= 0.7
    assert "visual question answering" in decision.reason.lower()


def test_route_grounding_to_grounding_tool(classifier, router):
    """Verify GROUNDING intent maps to GROUNDING_TOOL."""
    query = "Where are the airplanes parked?"
    sq = asyncio.run(classifier.classify(query))
    assert sq.intent == QueryIntent.GROUNDING

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.GROUNDING_TOOL
    assert decision.intent == QueryIntent.GROUNDING
    assert decision.requires_clarification is False
    assert "localization" in decision.reason.lower()
    assert "airplanes" in decision.parameters["target_objects"]


def test_route_change_detection_to_change_detection_tool(classifier, router):
    """Verify CHANGE_DETECTION intent maps to CHANGE_DETECTION_TOOL."""
    query = "What changed between 2023 and 2025?"
    sq = asyncio.run(classifier.classify(query))
    assert sq.intent == QueryIntent.CHANGE_DETECTION

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.CHANGE_DETECTION_TOOL
    assert decision.intent == QueryIntent.CHANGE_DETECTION
    assert decision.requires_clarification is False
    assert "between 2023 and 2025" in decision.parameters.get("time_range", "")


def test_route_comparison_to_comparison_tool(classifier, router):
    """Verify COMPARISON intent maps to COMPARISON_TOOL."""
    query = "Compare optical and SAR imagery for this coastal region"
    sq = asyncio.run(classifier.classify(query))
    assert sq.intent == QueryIntent.COMPARISON

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.COMPARISON_TOOL
    assert decision.intent == QueryIntent.COMPARISON
    assert decision.requires_clarification is False
    assert decision.parameters["modality_hint"] == "multimodal"


# -----------------------------------------------------------------------------
# 2. Fallback & Clarification Handlers
# -----------------------------------------------------------------------------

def test_route_unknown_to_clarification_tool(classifier, router):
    """Verify UNKNOWN/out-of-domain intent maps to CLARIFICATION_TOOL."""
    query = "What is the capital of France?"
    sq = asyncio.run(classifier.classify(query))
    assert sq.intent == QueryIntent.UNKNOWN

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL
    assert decision.requires_clarification is True
    assert decision.clarification_prompt is not None
    assert "unknown" in decision.reason.lower()


def test_route_ambiguous_query_to_clarification_tool(classifier, router):
    """Verify ambiguous queries (e.g. grounding + change) map to CLARIFICATION_TOOL."""
    query = "Locate all the new buildings built between 2020 and 2023"
    sq = asyncio.run(classifier.classify(query))
    assert sq.is_ambiguous is True

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL
    assert decision.requires_clarification is True
    assert "ambiguous" in decision.reason.lower()
    assert decision.clarification_prompt is not None


def test_route_underspecified_query_to_clarification_tool(classifier, router):
    """Verify isolated entity query maps to CLARIFICATION_TOOL."""
    query = "buildings"
    sq = asyncio.run(classifier.classify(query))
    assert sq.is_ambiguous is True

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL
    assert decision.requires_clarification is True
    assert "underspecified" in decision.reason.lower()
    assert "buildings" in decision.clarification_prompt.lower()


def test_route_low_confidence_to_clarification_tool(router):
    """Verify queries below the confidence threshold route to CLARIFICATION_TOOL."""
    low_conf_sq = StructuredQuery(
        original_query="vague feature in image",
        intent=QueryIntent.VQA,
        confidence=0.45,  # Below default 0.60 threshold
        target_objects=[],
        is_ambiguous=False,
    )

    decision = asyncio.run(router.route(low_conf_sq))
    assert decision.selected_tool == ToolIdentifier.CLARIFICATION_TOOL
    assert decision.requires_clarification is True
    assert "below the operational routing threshold" in decision.reason


# -----------------------------------------------------------------------------
# 3. Metadata Preservation Tests
# -----------------------------------------------------------------------------

def test_routing_preserves_structured_query_metadata(classifier, router):
    """Verify that routing decision preserves target entities, temporal, spatial, and modality."""
    query = "Analyze urban expansion and new buildings built between 2020 and 2023 in the north"
    sq = asyncio.run(classifier.classify(query))

    decision = asyncio.run(router.route(sq))
    assert decision.selected_tool == ToolIdentifier.CHANGE_DETECTION_TOOL

    # Parameters preservation
    params = decision.parameters
    assert "buildings" in params["target_objects"]
    assert "between 2020 and 2023" in params["time_range"]
    assert params["temporal"]["is_bi_temporal"] is True
    assert "2020" in params["temporal"]["time_points"]
    assert "2023" in params["temporal"]["time_points"]
    assert params["spatial"]["has_spatial"] is True
    assert "north" in params["spatial"]["cardinal_directions"]

    # Full structured query preservation
    assert decision.structured_query is not None
    assert decision.structured_query.original_query == query


# -----------------------------------------------------------------------------
# 4. Router Pluggability Test
# -----------------------------------------------------------------------------

class MockCustomRouter(BaseRouter):
    """Custom router verifying the router interface can be replaced."""

    async def route(self, structured_query: StructuredQuery) -> RoutingDecision:
        return RoutingDecision(
            selected_tool=ToolIdentifier.VQA_TOOL,
            intent=structured_query.intent,
            routing_confidence=1.0,
            reason="Custom router override",
            requires_clarification=False,
            parameters={"custom": True},
        )


def test_orchestrator_custom_router_swapping():
    """Verify AgentOrchestrator accepts custom BaseRouter implementations."""
    custom_router = MockCustomRouter()
    orchestrator = AgentOrchestrator(router=custom_router)

    res = asyncio.run(orchestrator.process_query("What changed between 2020 and 2023?"))
    decision = res["routing_decision"]
    assert decision.selected_tool == ToolIdentifier.VQA_TOOL
    assert decision.reason == "Custom router override"
    assert decision.parameters.get("custom") is True


# -----------------------------------------------------------------------------
# 5. API Endpoint Integration with Routing & Execution Trace
# -----------------------------------------------------------------------------

def test_api_query_returns_routing_decision_and_trace():
    """Verify POST /api/query returns both Query Understanding and Agent Routing in execution trace."""
    query = "What changed between 2023 and 2025?"
    response = client.post("/api/query", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    # Block 1 contract preservation
    assert data["received_query"] == query
    assert data["status"] == "received"

    # Block 3 Routing decision presence
    assert "routing_decision" in data
    rd = data["routing_decision"]
    assert rd["selected_tool"] == "CHANGE_DETECTION_TOOL"
    assert rd["intent"] == "CHANGE_DETECTION"
    assert rd["routing_confidence"] >= 0.8
    assert rd["requires_clarification"] is False
    assert "between 2023 and 2025" in rd["parameters"].get("time_range", "")

    # Execution trace verification (both Step 1 and Step 2 must be present)
    trace = data["execution_trace"]
    assert len(trace) >= 2

    step1 = trace[0]
    assert step1["step"] == 1
    assert step1["action"] == "Query Understanding"
    assert "CHANGE_DETECTION" in step1["detail"]
    assert step1["status"] == "completed"

    step2 = trace[1]
    assert step2["step"] == 2
    assert step2["action"] == "Agent Routing"
    assert "CHANGE_DETECTION_TOOL" in step2["detail"]
    assert step2["status"] == "completed"


def test_api_query_clarification_trace():
    """Verify POST /api/query with out-of-domain query routes to CLARIFICATION_TOOL in trace."""
    query = "What is the capital of France?"
    response = client.post("/api/query", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    rd = data["routing_decision"]
    assert rd["selected_tool"] == "CLARIFICATION_TOOL"
    assert rd["requires_clarification"] is True

    step2 = data["execution_trace"][1]
    assert step2["action"] == "Agent Routing"
    assert "CLARIFICATION_TOOL" in step2["detail"]
