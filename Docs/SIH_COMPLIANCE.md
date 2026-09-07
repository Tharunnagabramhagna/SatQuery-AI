# SIH 2026 Problem Statement Compliance Matrix

## Problem Statement Summary
- **Hackathon**: Smart India Hackathon (SIH) 2026
- **Problem ID**: 26167
- **Title**: Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries
- **Organization**: Ministry of Earth Sciences / ISRO / National Remote Sensing Center (NRSC)

---

## 1. Official Requirements & Compliance Verdict Matrix

| Requirement ID | SIH Capability Description | Implementation Status | Verdict | Verification & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Natural-Language Query Understanding & Routing**<br>Accurately parse user queries into structured intents (VQA, Grounding, Change Detection, Comparison) with explicit confidence scoring. | Fully implemented via `QueryUnderstandingService` (Gemini + RuleBased fallback) and `AgentRouter`. | **PASS** | `tests/test_query_understanding.py`<br>`tests/test_agent_router.py` (25/25 passed) |
| **REQ-02** | **Single-Image Optical VQA**<br>Describe land-cover, identify objects, and analyze optical satellite imagery. | Fully implemented in `VQATool`. Primary: Gemini 3.6 Flash. Fallback: Local Qwen2.5-VL via Ollama upon eligible Gemini failures (429, timeout, missing key). | **PASS** | `tests/test_vqa_tool.py`<br>`tests/test_qwen_fallback.py`<br>SIH-01 in acceptance harness |
| **REQ-03** | **Visual Grounding / Object Localization**<br>Detect and localize queried objects (water bodies, roads, structures) using normalized 2D bounding boxes `[ymin, xmin, ymax, xmax]`. | Fully implemented in `GroundingTool` using Gemini multimodal bounding box coordinates. **Strict Rule**: Qwen is NEVER invoked for Grounding. | **PASS** | `tests/test_grounding_tool.py`<br>RA-02 in SIH acceptance harness (zero Qwen calls) |
| **REQ-04** | **Bi-Temporal Change Detection**<br>Analyze co-registered Before (T1) and After (T2) satellite imagery, localize physical changes, and semantically attribute alterations. | Fully implemented via **Two-Stage Architecture**:<br>1. Deterministic Stage 1 OpenCV/NumPy engine (pixel deltas, edge co-registration, bounding boxes).<br>2. Stage 2 Gemini multimodal semantic interpreter (`[OBSERVED]`, `[INTERPRETED]`, `[UNCERTAIN]`). | **PASS** | `tests/test_change_detection_tool.py`<br>`tests/test_semantic_change.py`<br>SIH-03 & SIH-05 in acceptance harness |
| **REQ-05** | **Optical + SAR Cross-Modal Comparison**<br>Simultaneously ingest optical (RGB) and SAR (radar backscatter) imagery to resolve cloud penetration, surface roughness, and double-bounce reflection. | Capability implemented in `ComparisonTool` with cross-modal evidence schemas and radar limitations. **Strict Rule**: Blocked until an authentic Sentinel-1/SAR GeoTIFF fixture is provided. No synthetic image substitution. | **BLOCKED** | `tests/data/sar/README.md`<br>SIH-04 in acceptance harness correctly reports `BLOCKED` |
| **REQ-06** | **Remote-Sensing Domain Adaptation (e.g. BigEarthNet)**<br>Adapt vision-language representations to satellite image domains using benchmark datasets. | Complete adaptation framework implemented (`BigEarthNetIndexReader`, CORINE 19-class taxonomy mapping, LoRA training pipeline, reproducible CLI, and inference adapter). Without GPU training execution, adapter honestly reports `TRAINING_REQUIRED`. Zero fake checkpoints. | **TRAINING_REQUIRED** | `Docs/REMOTE_SENSING_ADAPTATION.md`<br>`tests/test_remote_sensing_adaptation.py` (8/8 passed) |
| **REQ-07** | **Input & Modality Validation**<br>Validate raster formats, inspect GeoTIFF tags (`ModelPixelScale`, `ModelTiepoint`) without coordinate fabrication, enforce strict modality precedence, and support differing Optical+SAR dimensions. | Fully implemented in `InputValidator`. Strict precedence: explicit declaration $\rightarrow$ documented benchmark $\rightarrow$ `UNKNOWN`. Never infers optical from RGB/JPEG alone; never infers SAR from filename. | **PASS** | `tests/test_input_validation.py` (12/12 passed) |
| **REQ-08** | **Auditable Execution Summary & Privacy**<br>Provide observable execution summaries for compliance auditing with zero chain-of-thought or internal system prompt leakage. | Fully implemented in `ExecutionSummary` schema and `AgentOrchestrator`. Populated with observable tools, models, calibrated confidence, evidence, and warnings. | **PASS** | `tests/test_execution_summary.py` (3/3 passed) |

---

## 2. Verdict Definitions & Classification Criteria

SatQuery-AI adheres to rigorous, non-greenwashed evaluation standards:

- **`PASS`**: Requirement is completely fulfilled in code and validated with passing automated test suites.
- **`PARTIAL`**: Requirement is functional with documented, non-critical scope boundaries.
- **`BLOCKED`**: The algorithmic capability is fully implemented in the engine, but test execution is deliberately halted because physical domain data (e.g., authentic SAR raster data) is absent. Synthetic or fake data is strictly prohibited as a substitute.
- **`TRAINING_REQUIRED`**: The software engineering pipeline, data loader, loss function, and training scripts are complete and verifiable, but model weights require execution on GPU/TPU cluster hardware. The system refuses to claim un-trained base models are adapted.
- **`ENVIRONMENT_BLOCKED`**: The pipeline and routing logic functioned correctly, but an external commercial API provider returned a temporary environmental error (e.g. Google Gemini HTTP 429 quota exhaustion).
- **`LIMITATION`**: The query requests real-world metrics (such as exact square hectares or geographical coordinates) that cannot be mathematically derived without verified Geospatial Tiepoint and Ground Sampling Distance (GSD) tags. The system honestly refuses to invent numbers.

---

## 3. Strict Operational Integrity Guarantees

1. **Gemini Primary / Qwen Fallback Only**:
   - Google Gemini remains the primary multimodal intelligence provider.
   - Local Qwen2.5-VL via Ollama operates strictly as a lazy fallback for VQA and Comparison when Gemini experiences runtime failure (HTTP 429, timeout, missing API key).
   - Qwen is **never** contacted when Gemini succeeds.
   - Qwen is **never** used for Grounding (which requires specialized coordinate geometry).
   - Qwen is **never** used for Change Detection (which is grounded in deterministic computer vision).

2. **Zero Metric & Coordinate Fabrication**:
   - Generic pixel difference percentages are **never** converted into built-up growth percentages without visual verification.
   - Hectares, acres, and square kilometers are **never** fabricated without authenticated geospatial tags.
   - Latitude and longitude are **never** invented from ordinary consumer JPEG/PNG images.

3. **Authentic Radar Handling**:
   - SAR imagery must never be fabricated from grayscale optical pictures or synthetic noise.
   - Optical + SAR pair validation explicitly allows differing dimensions, aspect ratios, and band counts (RGB 3-band vs single/dual-band radar), acknowledging real-world sensor differences.
