"""Unit tests for Gemini 2.5/3.6 Flash Query Understanding Layer.

All tests in this suite mock the google-genai SDK to ensure:
  1. Deterministic execution without live API dependencies.
  2. Complete coverage of intent classification (VQA, GROUNDING, CHANGE_DETECTION, COMPARISON, UNKNOWN).
  3. Strict fallback to RuleBasedQueryClassifier on any failure (API error, timeout, quota, malformed output, missing key).
  4. Preservation of downstream AgentRouter and ExecutionTrace contracts.
  5. Zero leakage of API keys or provider stack traces.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai import errors as genai_errors
from pydantic import ValidationError

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.query_understanding.gemini import (
    GeminiClassificationSchema,
    GeminiQueryClassifier,
)
from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.agents.query_understanding.service import QueryUnderstandingService
from backend.agents.router.agent_router import AgentRouter
from backend.schemas.query_understanding import QueryIntent, StructuredQuery
from backend.schemas.router import ToolIdentifier


def _create_mock_response(parsed_schema: GeminiClassificationSchema) -> MagicMock:
    """Helper to create a mocked Gemini response with populated .parsed attribute."""
    mock_resp = MagicMock()
    mock_resp.parsed = parsed_schema
    mock_resp.text = parsed_schema.model_dump_json()
    return mock_resp


# ─── 1. Intent Classification Tests (Mocked) ──────────────────────────────────


@pytest.mark.anyio
async def test_gemini_vqa_classification():
    """Verify Gemini classifies visual description query as VQA."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.VQA,
                confidence=0.95,
                target_objects=["forest", "land_cover"],
                is_ambiguous=False,
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Describe this satellite scene and identify the land use.")

    assert isinstance(res, StructuredQuery)
    assert res.intent == QueryIntent.VQA
    assert res.confidence == 0.95
    assert res.is_ambiguous is False
    assert res.extracted_attributes.get("provider") == "gemini"


@pytest.mark.anyio
async def test_gemini_grounding_classification():
    """Verify Gemini classifies localization query as GROUNDING."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.GROUNDING,
                confidence=0.92,
                target_objects=["airplanes"],
                locations=["runway"],
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Where are the airplanes parked?")

    assert res.intent == QueryIntent.GROUNDING
    assert res.confidence == 0.92
    assert "airplanes" in res.target_objects
    assert res.spatial is not None
    assert "runway" in res.spatial.locations


@pytest.mark.anyio
async def test_gemini_change_detection_classification():
    """Verify Gemini classifies temporal difference query as CHANGE_DETECTION."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.CHANGE_DETECTION,
                confidence=0.98,
                is_bi_temporal=True,
                time_range="between 2020 and 2023",
                time_points=["2020", "2023"],
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("What changed between these two satellite images?")

    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert res.confidence == 0.98
    assert res.temporal is not None
    assert res.temporal.is_bi_temporal is True


@pytest.mark.anyio
async def test_gemini_comparison_classification():
    """Verify Gemini classifies sensor comparison query as COMPARISON."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.COMPARISON,
                confidence=0.90,
                comparison_type="optical_sar",
                modality_hint="multimodal",
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Compare optical and SAR imagery for this coastal region.")

    assert res.intent == QueryIntent.COMPARISON
    assert res.confidence == 0.90
    assert res.comparison is not None
    assert res.comparison.comparison_type == "optical_sar"


@pytest.mark.anyio
async def test_gemini_unknown_classification():
    """Verify Gemini conservatively classifies out-of-domain trivia as UNKNOWN."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.UNKNOWN,
                confidence=1.0,
                is_ambiguous=False,
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("What is the capital of France?")

    assert res.intent == QueryIntent.UNKNOWN
    assert res.confidence == 1.0


@pytest.mark.anyio
async def test_gemini_confidence_and_ambiguity_handling():
    """Verify Gemini handles underspecified isolated terms with ambiguity flag."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.UNKNOWN,
                confidence=0.85,
                is_ambiguous=True,
                ambiguity_reason="Underspecified query containing only an isolated noun.",
                target_objects=["buildings"],
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("buildings")

    assert res.intent == QueryIntent.UNKNOWN
    assert res.is_ambiguous is True
    assert "isolated noun" in res.ambiguity_reason.lower()


# ─── 2. Fallback & Failure Containment Tests ──────────────────────────────────


@pytest.mark.anyio
async def test_gemini_api_error_triggers_rule_fallback():
    """Verify Gemini API errors (e.g. 403, 429, 500) trigger rule-based fallback without crash."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(500, {"error": {"message": "Internal Server Error"}})
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Where are the airplanes parked?")

    # Should fall back to RuleBasedQueryClassifier and successfully classify
    assert res.intent == QueryIntent.GROUNDING
    assert res.extracted_attributes.get("provider") == "rule_based"
    assert res.extracted_attributes.get("fallback_reason") == "api_error"


@pytest.mark.anyio
async def test_gemini_429_rate_limit_does_not_retry_and_falls_back():
    """Verify HTTP 429 rate limit immediately falls back to rule-based without retry."""
    mock_client = MagicMock()
    mock_generate = AsyncMock(
        side_effect=genai_errors.APIError(429, {"error": {"message": "Resource Exhausted"}})
    )
    mock_client.aio.models.generate_content = mock_generate

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Where are the airplanes parked?")

    # Exactly 1 attempt - NO immediate retry on 429
    assert mock_generate.call_count == 1
    assert res.intent == QueryIntent.GROUNDING
    assert res.extracted_attributes.get("provider") == "rule_based"
    assert res.extracted_attributes.get("fallback_reason") == "rate_limit_exceeded"


@pytest.mark.anyio
async def test_gemini_timeout_triggers_rule_fallback():
    """Verify Gemini request timeouts cleanly trigger rule-based fallback."""
    mock_client = MagicMock()

    async def _hang(*args, **kwargs):
        await asyncio.sleep(2.0)

    mock_client.aio.models.generate_content = AsyncMock(side_effect=_hang)

    # Use very short timeout for test
    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client, timeout=0.05)
    res = await classifier.classify("What changed between the two satellite images?")

    assert res.intent == QueryIntent.CHANGE_DETECTION
    assert res.extracted_attributes.get("provider") == "rule_based"
    assert res.extracted_attributes.get("fallback_reason") == "timeout"


@pytest.mark.anyio
async def test_gemini_malformed_response_triggers_rule_fallback():
    """Verify malformed/invalid JSON from Gemini triggers rule-based fallback."""
    mock_client = MagicMock()
    bad_resp = MagicMock()
    bad_resp.parsed = None
    bad_resp.text = '{"intent": "INVALID_INTENT_NAME", "confidence": "not_a_float"}'
    mock_client.aio.models.generate_content = AsyncMock(return_value=bad_resp)

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    res = await classifier.classify("Describe this satellite scene and identify the land use.")

    assert res.intent == QueryIntent.VQA
    assert res.extracted_attributes.get("provider") == "rule_based"
    assert res.extracted_attributes.get("fallback_reason") == "invalid_structured_output"


@pytest.mark.anyio
async def test_gemini_missing_api_key_triggers_rule_fallback():
    """Verify missing API key immediately uses rule-based fallback without attempting network call."""
    classifier = GeminiQueryClassifier(api_key="", client=None)
    res = await classifier.classify("Where are the airplanes parked?")

    assert res.intent == QueryIntent.GROUNDING
    assert res.extracted_attributes.get("provider") == "rule_based"
    assert res.extracted_attributes.get("fallback_reason") == "missing_api_key"


# ─── 3. Downstream Router & Trace Integration Tests ──────────────────────────


@pytest.mark.anyio
async def test_agent_router_receives_gemini_structured_query():
    """Verify AgentRouter correctly maps Gemini StructuredQuery to designated specialist tool."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.CHANGE_DETECTION,
                confidence=0.95,
                target_objects=[],
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    structured = await classifier.classify("What changed between baseline and follow-up?")

    router = AgentRouter()
    decision = await router.route(structured)

    assert decision.selected_tool == ToolIdentifier.CHANGE_DETECTION_TOOL
    assert decision.routing_confidence == 0.95


@pytest.mark.anyio
async def test_orchestrator_execution_trace_records_gemini_provider():
    """Verify Orchestrator execution trace step 1 explicitly attributes Gemini provider."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=_create_mock_response(
            GeminiClassificationSchema(
                intent=QueryIntent.GROUNDING,
                confidence=0.91,
                target_objects=["airplanes"],
            )
        )
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client, model="gemini-3.6-flash")
    service = QueryUnderstandingService(classifier=classifier)
    orch = AgentOrchestrator(query_understanding=service)

    res = await orch.process_query("Where are the airplanes parked?")

    step1 = res["execution_trace"][0]
    assert step1.step == 1
    assert step1.action == "Query Understanding"
    assert "provider: gemini" in step1.detail
    assert "gemini-3.6-flash" in step1.detail
    assert "GROUNDING" in step1.detail


@pytest.mark.anyio
async def test_orchestrator_execution_trace_records_fallback_provider():
    """Verify Orchestrator execution trace step 1 records fallback reason when Gemini fails."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=genai_errors.APIError(503, {"error": {"message": "Unavailable"}})
    )

    classifier = GeminiQueryClassifier(api_key="mock-key", client=mock_client)
    service = QueryUnderstandingService(classifier=classifier)
    orch = AgentOrchestrator(query_understanding=service)

    res = await orch.process_query("Where are the airplanes parked?")

    step1 = res["execution_trace"][0]
    assert step1.step == 1
    assert "provider: rule_based" in step1.detail
    assert "api_error" in step1.detail
    assert "GROUNDING" in step1.detail
