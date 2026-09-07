# SatQuery ML Evaluation Report

**Generated**: 2026-09-07T10:24:39.070700+00:00  
**Evaluation Runtime**: 17.44s  
**Benchmark Suite**: 60 benchmark cases  
**Total Evaluated**: 60 | **Passed**: 50 | **Failed**: 10 | **Overall Success Rate**: 83.3%

---

## 1. Executive Summary & Metric Scorecards

| Metric Area | Primary Metric | Score | Cases Evaluated |
|:---|:---|:---:|:---:|
| **Query Intent Classification** | Accuracy / Macro F1 | **78.3%** / **0.7710** | 60 |
| **Agent Routing** | Tool Routing Accuracy | **71.7%** | 60 |
| **Agent Fallback Rate** | Clarification Rate | **28.3%** | 60 |
| **Change Detection** | Binary Precision / Recall | **100.0%** / **100.0%** | 3 |
| **Visual Question Answering** | Keyword Recall / Token F1 | **33.3%** / **0.0000** | 2 |
| **Visual Grounding** | Semantic Match Accuracy | **0.0%** | 2 |

---

## 2. Intent Classification Breakdown

| Intent Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
| **CHANGE_DETECTION** | 1.0000 | 0.7778 | 0.8750 | 18 |
| **COMPARISON** | 1.0000 | 1.0000 | 1.0000 | 2 |
| **GROUNDING** | 0.8000 | 0.6000 | 0.6857 | 20 |
| **UNKNOWN** | 0.3333 | 0.6667 | 0.4444 | 3 |
| **VQA** | 0.7391 | 1.0000 | 0.8500 | 17 |

- **Macro Average**: Precision: 0.7745 | Recall: 0.8089 | F1: 0.7710
- **Weighted Average F1**: 0.7875

---

## 3. Specialist Capability Verifications

### 3.1 Bi-Temporal Change Detection
- **Binary Accuracy**: 100.0%
- **Binary Precision / Recall / F1**: 1.0000 / 1.0000 / 1.0000
- **Zero-Change Validation**: Passed on identical images with 0.0% false-positive change.
- **Graceful Input Handling**: Properly triggered `input_required` when bi-temporal pair missing.

### 3.2 Visual Question Answering (Salesforce/blip-vqa-base)
- **Keyword Recall**: 33.3%
- **Missing Modality Handling**: Graceful `input_required` status returned when image omitted.

### 3.3 Visual Grounding
- **Semantic Match**: 0.0%

---

## 4. Error Analysis & Taxonomy

**Total Benchmark Failures**: 10 of 60 (16.7%)

### Error Distribution by Root Cause
| Error Category | Count | Description |
|:---|:---:|:---|
| `misclassification` | 5 | Primary failure mode for misclassification |
| `ambiguity_fallback` | 2 | Primary failure mode for ambiguity_fallback |
| `ood_misclassification` | 1 | Primary failure mode for ood_misclassification |
| `routing_fallback` | 2 | Primary failure mode for routing_fallback |

### Detailed Mismatch Log
| Case ID | Category | Expected Intent/Tool | Predicted Intent/Tool | Failure Category | Rationale |
|:---|:---|:---|:---|:---|:---|
| `QU_GR_004` | query_understanding | `GROUNDING` | `VQA` | `misclassification` | Intent mismatch: expected GROUNDING, got VQA |
| `QU_AMB_001` | query_understanding | `GROUNDING` | `UNKNOWN` | `ambiguity_fallback` | Intent mismatch: expected GROUNDING, got UNKN |
| `QU_AMB_002` | query_understanding | `GROUNDING` | `UNKNOWN` | `ambiguity_fallback` | Intent mismatch: expected GROUNDING, got UNKN |
| `QU_OOD_001` | query_understanding | `UNKNOWN` | `VQA` | `ood_misclassification` | Intent mismatch: expected UNKNOWN, got VQA |
| `AR_CD_001` | agent_routing | `CHANGE_DETECTION` | `CHANGE_DETECTION` | `routing_fallback` | Routing mismatch: expected change_detection_t |
| `QU_GR_009` | query_understanding | `GROUNDING` | `VQA` | `misclassification` | Intent mismatch: expected GROUNDING, got VQA |
| `QU_CD_006` | query_understanding | `CHANGE_DETECTION` | `GROUNDING` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `QU_CD_007` | query_understanding | `CHANGE_DETECTION` | `VQA` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `QU_CD_010` | query_understanding | `CHANGE_DETECTION` | `GROUNDING` | `misclassification` | Intent mismatch: expected CHANGE_DETECTION, g |
| `AR_GR_002` | agent_routing | `GROUNDING` | `VQA` | `routing_fallback` | Routing mismatch: expected grounding_tool, se |

---

## 5. Architectural Recommendations & Future Directions
1. **Hybrid Intent Classification**: Complement rule-based regex patterns with a lightweight embedding or small LM classifier to eliminate out-of-vocabulary misclassifications.
2. **Confidence-Calibrated Routing**: Implement progressive routing fallback when query ambiguity score exceeds threshold.
3. **Dedicated Object Localization**: Integrate high-resolution open-vocabulary object detectors (e.g. Grounding DINO) to produce bounding boxes for satellite imagery.
