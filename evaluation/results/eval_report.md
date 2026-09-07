# SatQuery ML Evaluation Report

**Generated**: 2026-09-07T21:35:53.637037+00:00  
**Evaluation Runtime**: 8.8s  
**Benchmark Suite**: 60 benchmark cases  
**Total Evaluated**: 60 | **Passed**: 45 | **Failed**: 15 | **Overall Success Rate**: 75.0%

---

## 1. Executive Summary & Metric Scorecards

| Metric Area | Primary Metric | Score | Cases Evaluated |
|:---|:---|:---:|:---:|
| **Query Intent Classification** | Accuracy / Macro F1 | **75.0%** / **0.7481** | 60 |
| **Agent Routing** | Tool Routing Accuracy | **70.0%** | 60 |
| **Agent Fallback Rate** | Clarification Rate | **28.3%** | 60 |
| **Change Detection** | Binary Precision / Recall | **100.0%** / **100.0%** | 3 |
| **Visual Question Answering** | Keyword Recall / Token F1 | **0.0%** / **0.0000** | 0 |
| **Visual Grounding** | Semantic Match Accuracy | **0.0%** | 2 |

---

## 2. Intent Classification Breakdown

| Intent Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
| **CHANGE_DETECTION** | 1.0000 | 0.6667 | 0.8000 | 18 |
| **COMPARISON** | 1.0000 | 1.0000 | 1.0000 | 2 |
| **GROUNDING** | 0.7500 | 0.6000 | 0.6667 | 20 |
| **UNKNOWN** | 0.3333 | 0.6667 | 0.4444 | 3 |
| **VQA** | 0.7083 | 1.0000 | 0.8292 | 17 |

- **Macro Average**: Precision: 0.7583 | Recall: 0.7867 | F1: 0.7481
- **Weighted Average F1**: 0.7527

---

## 3. Specialist Capability Verifications

### 3.1 Bi-Temporal Change Detection
- **Binary Accuracy**: 100.0%
- **Binary Precision / Recall / F1**: 1.0000 / 1.0000 / 1.0000
- **Zero-Change Validation**: Passed on identical images with 0.0% false-positive change.
- **Graceful Input Handling**: Properly triggered `input_required` when bi-temporal pair missing.

### 3.2 Visual Question Answering (Salesforce/blip-vqa-base)
- **Keyword Recall**: 0.0%
- **Missing Modality Handling**: Graceful `input_required` status returned when image omitted.

### 3.3 Visual Grounding
- **Semantic Match**: 0.0%

---

## 4. Error Analysis & Taxonomy

**Total Benchmark Failures**: 15 of 60 (25.0%)

### Error Distribution by Root Cause
| Error Category | Count | Description |
|:---|:---:|:---|
| `misclassification` | 6 | Primary failure mode for misclassification |
| `ambiguity_fallback` | 2 | Primary failure mode for ambiguity_fallback |
| `ood_misclassification` | 1 | Primary failure mode for ood_misclassification |
| `routing_fallback` | 2 | Primary failure mode for routing_fallback |
| `vqa_discrepancy` | 2 | Primary failure mode for vqa_discrepancy |
| `grounding_discrepancy` | 2 | Primary failure mode for grounding_discrepancy |

### Detailed Mismatch Log
| Case ID | Category | Expected Intent/Tool | Predicted Intent/Tool | Failure Category | Rationale |
|:---|:---|:---|:---|:---|:---|
| `QU_GR_004` | query_understanding | `GROUNDING` | `VQA` | `misclassification` | Intent mismatch: expected GROUNDING, got VQA |
| `QU_CD_003` | query_understanding | `CHANGE_DETECTION` | `VQA` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `QU_AMB_001` | query_understanding | `GROUNDING` | `UNKNOWN` | `ambiguity_fallback` | Intent mismatch: expected GROUNDING, got UNKN |
| `QU_AMB_002` | query_understanding | `GROUNDING` | `UNKNOWN` | `ambiguity_fallback` | Intent mismatch: expected GROUNDING, got UNKN |
| `QU_OOD_001` | query_understanding | `UNKNOWN` | `VQA` | `ood_misclassification` | Intent mismatch: expected UNKNOWN, got VQA |
| `AR_CD_001` | agent_routing | `CHANGE_DETECTION` | `CHANGE_DETECTION` | `routing_fallback` | Routing mismatch: expected change_detection_t |
| `VQA_REAL_001` | vqa | `VQA` | `VQA` | `vqa_discrepancy` | Answer '' did not contain expected keywords [ |
| `GR_SEM_001` | grounding | `GROUNDING` | `GROUNDING` | `grounding_discrepancy` | Grounding tool returned status=error, cap=GRO |
| `QU_GR_009` | query_understanding | `GROUNDING` | `VQA` | `misclassification` | Intent mismatch: expected GROUNDING, got VQA |
| `QU_CD_006` | query_understanding | `CHANGE_DETECTION` | `GROUNDING` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `QU_CD_007` | query_understanding | `CHANGE_DETECTION` | `VQA` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `QU_CD_010` | query_understanding | `CHANGE_DETECTION` | `GROUNDING` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `AR_GR_002` | agent_routing | `GROUNDING` | `VQA` | `routing_fallback` | Routing mismatch: expected grounding_tool, se |
| `VQA_REAL_002` | vqa | `VQA` | `VQA` | `vqa_discrepancy` | Answer '' did not contain expected keywords [ |
| `GR_SEM_002` | grounding | `GROUNDING` | `VQA` | `grounding_discrepancy` | Grounding tool returned status=error, cap=GRO |

---

## 5. Architectural Recommendations & Future Directions
1. **Hybrid Intent Classification**: Complement rule-based regex patterns with a lightweight embedding or small LM classifier to eliminate out-of-vocabulary misclassifications.
2. **Confidence-Calibrated Routing**: Implement progressive routing fallback when query ambiguity score exceeds threshold.
3. **Dedicated Object Localization**: Integrate high-resolution open-vocabulary object detectors (e.g. Grounding DINO) to produce bounding boxes for satellite imagery.
