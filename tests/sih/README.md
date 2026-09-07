# SIH 2026 End-to-End Acceptance Test Harness

## Purpose

This harness validates the **complete SatQuery-AI backend pipeline** against the
5 official SIH 2026 representative queries (SIH26167).

```
Natural-language query
  → Query Understanding (Gemini / RuleBased classifier)
  → Agent Router
  → Specialist Tool (VQA / Grounding / Change Detection / Comparison)
  → Model / Provider
  → Structured result validation
```

> **DISCLAIMER**: This harness tests *functional pipeline behavior only*. It does
> **NOT** claim satisfaction of remote-sensing model adaptation/fine-tuning
> requirements (e.g. BigEarthNet). That is a separate model-training concern.

## Test Cases

| ID | Name | Intent | Tool | Provider | Qwen Fallback |
|--------|-------------------------------|------------------|------------------------|-------------------------|----------------|
| SIH-01 | Land-Cover VQA | VQA | VQA_TOOL | Gemini | Eligible |
| SIH-02 | Water Body Grounding | GROUNDING | GROUNDING_TOOL | Gemini | NEVER |
| SIH-03 | Bi-temporal Change Detection | CHANGE_DETECTION | CHANGE_DETECTION_TOOL | Local Change Detection | NEVER |
| SIH-04 | Optical + SAR Cross-Modal | COMPARISON | COMPARISON_TOOL | Gemini | Eligible |
| SIH-05 | Built-up Area Change | CHANGE_DETECTION | CHANGE_DETECTION_TOOL | Local Change Detection | NEVER |

### Test 04 Status: BLOCKED

Test SIH-04 is **BLOCKED** because no real SAR fixture exists in `tests/data/`.
An optical image cannot be relabeled as SAR. This test will remain blocked until
a genuine SAR image is added to `tests/data/`.

### Test 05 Note

The current Change Detection tool reports pixel-level change metrics
(`change_percentage`, `changed_pixels`). It does **NOT** compute built-up-area
hectares, coordinates, or land-class percentages. The test validates honest
results from actual capabilities without fabricating unsupported measurements.

## Fixtures

| File | Type | Purpose |
|------|------|---------|
| `tests/data/sat_before.jpg` | Optical satellite | Baseline (T1) image |
| `tests/data/sat_after.jpg` | Optical satellite | Follow-up (T2) image |
| SAR image | — | **NOT AVAILABLE** |

## Usage

```bash
# Normal run (Gemini primary, no Ollama required)
python tests/sih/run_sih_tests.py

# Verbose output with answer text
python tests/sih/run_sih_tests.py --verbose

# Machine-readable JSON scorecard
python tests/sih/run_sih_tests.py --json
```

## Requirements

- **Gemini API key** configured in `.env` or environment variable `GEMINI_API_KEY`
- **Ollama is NOT required** for normal SIH test execution
- No production code modifications required
- No database or authentication required

## What This Harness Verifies

### Per-Test Reporting
- Exact query sent
- Input files used
- Expected vs detected intent
- Selected tool
- Provider used
- Fallback true/false with reason
- Tool execution status
- Latency (ms)
- Answer text
- Confidence score
- Warnings
- Evidence items and types
- Visualization count
### Verdict Classifications

- **PASS**: Pipeline routing AND tool execution both succeeded as expected.
- **FAIL**: Pipeline routing or tool logic is broken.
- **BLOCKED**: Test cannot execute due to missing prerequisite fixture (e.g., real SAR image for SIH-04).
- **ENVIRONMENT_BLOCKED**: Routing was correct, but external provider was unavailable (e.g. Gemini HTTP 429 rate limit).
- **LIMITATION**: Routing was correct, but the query requires semantic capabilities (e.g. built-up area direction in SIH-05) that exceed the current pixel-level Change Detection engine.

### Routing Assertions
- **RA-01**: Primary Success → Qwen NOT Contacted
- **RA-02**: Grounding → Qwen NEVER (holds even during Gemini rate limits)
- **RA-03**: Bi-temporal CD → CD Tool Only (never Comparison/VQA, Qwen NEVER)
- **RA-04**: Ollama Is Optional / Lazy Fallback Verified (only engaged after eligible Gemini failure)
- **RA-05**: Qwen Fallback Isolation (Deterministic Coverage delegated to `tests/test_qwen_fallback.py`)

### Scorecard Categories
- Total / Passed / Failed / Blocked / Environment Blocked / Limitation
- VQA, Grounding, Change Detection, Optical-SAR breakdown
- Built-up change analysis (honest limitation reporting)
- Agentic routing assertions
- Primary provider integrity verification
- Qwen fallback isolation verification

## Relationship to Existing Tests

This harness does **NOT** duplicate existing unit/regression tests:

| Existing Test Suite | Coverage |
|---------------------|----------|
| `test_vqa_tool.py` | Deterministic VQA tool tests (mocked Gemini) |
| `test_grounding_tool.py` | Deterministic Grounding tests (mocked Gemini) |
| `test_change_detection_tool.py` | Change Detection with real images |
| `test_comparison_tool.py` | Comparison tool (mocked Gemini) |
| `test_query_understanding.py` | Rule-based classifier |
| `test_gemini_query_understanding.py` | Gemini classifier |
| `test_agent_router.py` | Agent routing logic |
| `test_tool_execution.py` | Tool executor dispatch |
| `test_qwen_fallback.py` | Deterministic Qwen fallback (28 tests) |
| `test_frontend_api.py` | `/api/analysis` endpoint |
| `test_auth.py` / `test_oauth.py` | Authentication |

The SIH harness focuses on **end-to-end pipeline integration** using the
official SIH representative queries, exercising the real API without mocks.

## Files

```
tests/sih/
├── sih_queries.json     # Test definitions (queries, expected intents, fixtures)
├── run_sih_tests.py     # Test runner script
└── README.md            # This file
```
