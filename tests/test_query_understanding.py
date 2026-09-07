"""Unit tests for Block 2: Query Understanding Intelligence Layer."""

import asyncio
import pytest
from fastapi.testclient import TestClient

from backend.agents.query_understanding.base import BaseQueryClassifier
from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.agents.query_understanding.service import QueryUnderstandingService
from backend.main import app
from backend.schemas.query_understanding import QueryIntent, StructuredQuery

client = TestClient(app)


@pytest.fixture
def classifier():
    return RuleBasedQueryClassifier()


@pytest.fixture
def service(classifier):
    return QueryUnderstandingService(classifier=classifier)


# -----------------------------------------------------------------------------
# 1. VQA Tests
# -----------------------------------------------------------------------------

def test_vqa_scene_description(classifier):
    """Test scene description queries classify as VQA."""
    query = "Describe this satellite scene and identify the land use."
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.VQA
    assert res.confidence >= 0.7
    assert res.is_ambiguous is False


def test_vqa_object_presence(classifier):
    """Test object existence/presence queries classify as VQA."""
    query = "What objects are present in this satellite image?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.VQA
    assert res.confidence >= 0.7


def test_vqa_count_query(classifier):
    """Test counting queries classify as VQA and extract count attribute."""
    query = "How many ships are docked in the harbor?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.VQA
    assert res.extracted_attributes.get("is_count_query") is True
    assert any(t in res.target_objects for t in ["ships", "vessels", "boat", "vessel"])
    assert res.spatial is not None
    assert "harbor" in res.spatial.locations


def test_vqa_existence_query(classifier):
    """Test existence questions classify as VQA."""
    query = "Is there a runway visible in this airport area?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.VQA
    assert res.extracted_attributes.get("is_existence_query") is True
    assert any(t in res.target_objects for t in ["runway", "runways", "roads_infrastructure"])


# -----------------------------------------------------------------------------
# 2. Grounding Tests
# -----------------------------------------------------------------------------

def test_grounding_where_is(classifier):
    """Test 'where are' queries classify as GROUNDING."""
    query = "Where are the airplanes parked?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.GROUNDING
    assert res.confidence >= 0.7
    assert any(t in res.target_objects for t in ["airplanes", "aircraft", "airplane"])


def test_grounding_locate_entities(classifier):
    """Test 'locate' queries classify as GROUNDING."""
    query = "Locate all storage tanks in the industrial zone"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.GROUNDING
    assert any(t in res.target_objects for t in ["storage tanks", "tanks", "storage_tanks", "tank"])
    assert res.spatial is not None
    assert "industrial zone" in res.spatial.locations


def test_grounding_detect_and_bound(classifier):
    """Test bounding box / detect queries classify as GROUNDING."""
    query = "Detect the buildings and output bounding boxes"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.GROUNDING
    assert any(t in res.target_objects for t in ["buildings", "building"])


def test_grounding_show_me_where(classifier):
    """Test 'show me where' queries classify as GROUNDING."""
    query = "Show me where the water bodies are located in the north"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.GROUNDING
    assert any(t in res.target_objects for t in ["water bodies", "water", "water_bodies"])
    assert res.spatial is not None
    assert "north" in res.spatial.cardinal_directions


# -----------------------------------------------------------------------------
# 3. Change Detection Tests
# -----------------------------------------------------------------------------

def test_change_detection_what_changed(classifier):
    """Test direct 'what changed' query classifies as CHANGE_DETECTION."""
    query = "What changed between the two images?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert res.confidence >= 0.75


def test_change_detection_urban_expansion_dates(classifier):
    """Test urban expansion between year dates."""
    query = "Analyze urban expansion and new buildings built between 2020 and 2023"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert any(t in res.target_objects for t in ["buildings", "building", "urban area"])
    assert res.temporal is not None
    assert res.temporal.is_bi_temporal is True
    assert "2020" in res.temporal.time_points
    assert "2023" in res.temporal.time_points


def test_change_detection_before_after(classifier):
    """Test before and after comparison classifies as CHANGE_DETECTION."""
    query = "Did the forest area decrease before and after the flood?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert any(t in res.target_objects for t in ["forest", "trees", "vegetation"])
    assert res.temporal is not None
    assert res.temporal.is_bi_temporal is True
    assert "before and after" in (res.temporal.raw_time_expression or "")


def test_change_detection_deforestation(classifier):
    """Test deforestation query classifies as CHANGE_DETECTION."""
    query = "Measure deforestation from 2018 to 2022"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert res.temporal is not None
    assert "2018" in res.temporal.time_points
    assert "2022" in res.temporal.time_points


# -----------------------------------------------------------------------------
# 4. Comparison Tests
# -----------------------------------------------------------------------------

def test_comparison_optical_sar(classifier):
    """Test optical vs SAR comparison queries classify as COMPARISON."""
    query = "Compare optical and SAR imagery for this coastal region"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.COMPARISON
    assert res.confidence >= 0.8
    assert res.modality_hint == "multimodal"
    assert res.comparison is not None
    assert res.comparison.comparison_type == "optical_sar"
    assert res.spatial is not None
    assert "coastal" in res.spatial.locations


def test_comparison_vs_syntax(classifier):
    """Test 'optical vs sar' syntax classifies as COMPARISON."""
    query = "What is the difference between optical vs SAR radar backscatter?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.COMPARISON
    assert res.modality_hint == "multimodal"
    assert res.comparison is not None
    assert res.comparison.is_comparison is True


def test_comparison_two_sensors(classifier):
    """Test cross-sensor comparison query."""
    query = "Compare the two sensor images for cloud cover and resolution"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.COMPARISON
    assert res.comparison is not None
    assert res.comparison.is_comparison is True


# -----------------------------------------------------------------------------
# 5. Unknown / Irrelevant Tests
# -----------------------------------------------------------------------------

def test_unknown_general_trivia(classifier):
    """Test non-geospatial trivia query classifies as UNKNOWN."""
    query = "What is the capital of France?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.UNKNOWN
    assert res.confidence >= 0.85


def test_unknown_creative_writing(classifier):
    """Test creative writing request classifies as UNKNOWN."""
    query = "Write a poem about love and sorrow"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.UNKNOWN


def test_unknown_math(classifier):
    """Test math query classifies as UNKNOWN."""
    query = "2 + 2 = ?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.UNKNOWN


def test_unknown_casual_greeting(classifier):
    """Test greeting classifies as UNKNOWN."""
    query = "Hello, how are you doing today?"
    res = asyncio.run(classifier.classify(query))
    assert res.intent == QueryIntent.UNKNOWN


# -----------------------------------------------------------------------------
# 6. Ambiguous & Underspecified Tests
# -----------------------------------------------------------------------------

def test_ambiguous_grounding_and_change(classifier):
    """Test query requesting both grounding and change detection is flagged as ambiguous."""
    query = "Locate all the new buildings built between 2020 and 2023"
    res = asyncio.run(classifier.classify(query))
    assert res.is_ambiguous is True
    assert res.ambiguity_reason is not None
    assert "locate" in res.ambiguity_reason.lower() or "spatial" in res.ambiguity_reason.lower()


def test_underspecified_isolated_entity(classifier):
    """Test isolated entity query is flagged as underspecified/ambiguous."""
    query = "buildings"
    res = asyncio.run(classifier.classify(query))
    assert res.is_ambiguous is True
    assert res.confidence < 0.5
    assert "buildings" in res.target_objects


# -----------------------------------------------------------------------------
# 7. Replaceable Classifier Mechanism Tests
# -----------------------------------------------------------------------------

class MockCustomClassifier(BaseQueryClassifier):
    """Mock classifier verifying engine replaceability (e.g. future LLM classifier)."""

    async def classify(self, query: str) -> StructuredQuery:
        return StructuredQuery(
            original_query=query,
            intent=QueryIntent.VQA,
            confidence=0.99,
            target_objects=["mock_target"],
            extracted_attributes={"engine": "mock_llm_v1"},
        )


def test_service_classifier_swapping():
    """Verify QueryUnderstandingService allows hot-swapping classifier implementations."""
    service = QueryUnderstandingService(classifier=RuleBasedQueryClassifier())
    res1 = asyncio.run(service.analyze("Where are the ships?"))
    assert res1.intent == QueryIntent.GROUNDING

    # Swap with mock custom engine
    service.set_classifier(MockCustomClassifier())
    res2 = asyncio.run(service.analyze("Where are the ships?"))
    assert res2.intent == QueryIntent.VQA
    assert res2.confidence == 0.99
    assert res2.extracted_attributes.get("engine") == "mock_llm_v1"


# -----------------------------------------------------------------------------
# 8. API Endpoint Integration with Query Understanding
# -----------------------------------------------------------------------------

def test_api_query_returns_understanding_metadata():
    """Verify POST /api/query reflects Query Understanding results in response and trace."""
    query = "Locate all airplanes on the runway"
    response = client.post("/api/query", json={"query": query})
    assert response.status_code == 200
    data = response.json()

    assert data["received_query"] == query
    assert data["status"] == "received"
    assert data["task"] == "GROUNDING"
    assert data["confidence"] is not None
    assert data["confidence"] >= 0.7

    # Execution trace verification
    assert len(data["execution_trace"]) >= 1
    step1 = data["execution_trace"][0]
    assert step1["step"] == 1
    assert step1["action"] == "Query Understanding"
    assert "GROUNDING" in step1["detail"]
    assert step1["status"] == "completed"

    # Structured query presence in response
    assert data.get("structured_query") is not None
    assert data["structured_query"]["intent"] == "GROUNDING"
    assert "airplanes" in data["structured_query"]["target_objects"]
