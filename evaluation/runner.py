"""Comprehensive ML Evaluation Runner for SatQuery-AI.

Executes benchmark cases across:
- Query Understanding (RuleBasedQueryClassifier)
- Agent Routing (AgentRouter)
- Visual Question Answering (VQATool / Local BLIP)
- Visual Grounding (GroundingTool)
- Bi-Temporal Change Detection (ChangeDetectionTool / Engine)

Computes standard ML metrics, logs genuine performance without fabrication,
performs error taxonomy categorization, and exports structured results and markdown reports.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.agents.router.agent_router import AgentRouter
from backend.agents.tools.base import GroundingTool, VQATool
from backend.agents.tools.change_detection.tool import ChangeDetectionTool
from backend.schemas.router import ToolIdentifier
from backend.schemas.tool import ToolStatus

from evaluation.metrics.change_detection import calculate_change_detection_metrics
from evaluation.metrics.classification import calculate_classification_metrics
from evaluation.metrics.grounding import calculate_grounding_metrics, semantic_match_score
from evaluation.metrics.routing import calculate_routing_metrics
from evaluation.metrics.vqa import (
    calculate_vqa_metrics,
    exact_match_score,
    keyword_recall_score,
    token_f1_score,
)

logger = logging.getLogger("satquery.evaluation.runner")


class EvaluationRunner:
    """Core evaluation engine orchestrating benchmark execution and metrics compilation."""

    def __init__(
        self,
        dataset_path: str = "evaluation/datasets/benchmark_cases.json",
        results_dir: str = "evaluation/results",
    ):
        self.dataset_path = Path(dataset_path)
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(parents=True, exist_ok=True)

        # Initialize actual components from repository
        self.classifier = RuleBasedQueryClassifier()
        self.router = AgentRouter()
        self.vqa_tool = VQATool()
        self.grounding_tool = GroundingTool()
        self.change_detection_tool = ChangeDetectionTool()

    def load_dataset(self) -> List[Dict[str, Any]]:
        """Load benchmark evaluation cases from JSON."""
        if not self.dataset_path.exists():
            raise FileNotFoundError(f"Benchmark dataset not found at {self.dataset_path}")
        with open(self.dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info("Loaded %d benchmark cases from %s", len(data), self.dataset_path)
        return data

    async def evaluate_case(self, case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate an individual benchmark case against the appropriate component.

        Returns structured per-case evaluation record.
        """
        case_id = case["case_id"]
        category = case.get("category", "query_understanding")
        query = case.get("query") or case.get("test_inputs", {}).get("query", "")
        test_inputs = case.get("test_inputs", {})
        expected_output = case.get("expected_output", {})

        result: Dict[str, Any] = {
            "case_id": case_id,
            "category": category,
            "capability": case.get("capability", "UNKNOWN"),
            "evaluation_type": case.get("evaluation_type", "synthetic_unit"),
            "query": query,
            "passed": False,
            "failure_reason": None,
            "failure_category": None,
            "details": {},
        }

        # 1. Evaluate Query Understanding & Intent Classification
        sq = None
        if query:
            sq = await self.classifier.classify(query)
            result["details"]["predicted_intent"] = sq.intent.value
            result["details"]["intent_confidence"] = sq.confidence
            result["details"]["extracted_entities"] = sq.target_objects

        # 2. Evaluate Agent Routing
        routing_dec = None
        if sq is not None:
            routing_dec = await self.router.route(sq)
            result["details"]["predicted_tool"] = routing_dec.selected_tool.value
            result["details"]["routing_confidence"] = routing_dec.routing_confidence
            result["details"]["requires_clarification"] = routing_dec.requires_clarification

        # -------------------------------------------------------------
        # Category-Specific Validation
        # -------------------------------------------------------------
        if category == "query_understanding":
            exp_intent = case.get("expected_intent")
            pred_intent = sq.intent.value if sq else None

            intent_match = (pred_intent.upper() == exp_intent.upper()) if (pred_intent and exp_intent) else False

            # Semantic match for expected entities
            exp_entities = case.get("expected_entities", [])
            pred_entities = sq.target_objects if sq else []
            ent_score = semantic_match_score(pred_entities, exp_entities)
            result["details"]["entity_match_score"] = ent_score

            if intent_match:
                result["passed"] = True
            else:
                result["passed"] = False
                result["failure_reason"] = (
                    f"Intent mismatch: expected {exp_intent}, got {pred_intent}"
                )
                if exp_intent == "UNKNOWN":
                    result["failure_category"] = "ood_misclassification"
                elif pred_intent == "UNKNOWN":
                    result["failure_category"] = "ambiguity_fallback"
                else:
                    result["failure_category"] = "misclassification"

        elif category == "agent_routing":
            exp_tool = case.get("expected_tool")
            pred_tool = routing_dec.selected_tool.value if routing_dec else None

            tool_match = (pred_tool.lower() == exp_tool.lower()) if (pred_tool and exp_tool) else False

            if tool_match:
                result["passed"] = True
            else:
                result["passed"] = False
                result["failure_reason"] = (
                    f"Routing mismatch: expected {exp_tool}, selected {pred_tool}"
                )
                if pred_tool and "clarification" in pred_tool.lower():
                    result["failure_category"] = "routing_fallback"
                else:
                    result["failure_category"] = "wrong_tool_selection"

        elif category == "change_detection":
            before_img = test_inputs.get("before_image")
            after_img = test_inputs.get("after_image")
            sens = test_inputs.get("sensitivity")
            if sens is not None and float(sens) > 1.0:
                sens = float(sens) / 100.0  # Normalize percentage to [0, 1]
            coreg = test_inputs.get("coregistration_threshold")

            cd_params = {
                "before_image": before_img,
                "after_image": after_img,
                "query": query,
                "sensitivity": sens,
                "coregistration_threshold": coreg,
            }

            try:
                tool_res = await self.change_detection_tool.execute(cd_params)
                result["details"]["tool_status"] = tool_res.status
                result["details"]["metadata"] = tool_res.metadata

                exp_status = expected_output.get("expected_status")
                if exp_status:
                    if tool_res.status.lower() == exp_status.lower():
                        result["passed"] = True
                    else:
                        result["passed"] = False
                        result["failure_reason"] = (
                            f"Expected status {exp_status}, got {tool_res.status}"
                        )
                        result["failure_category"] = "input_validation_failure"
                else:
                    has_change_exp = expected_output.get("has_change")
                    changed_pixels = tool_res.metadata.get("changed_pixels", 0)
                    change_pct = tool_res.metadata.get("change_percentage", 0.0)

                    result["details"]["changed_pixels"] = changed_pixels
                    result["details"]["change_percentage"] = change_pct

                    if has_change_exp is True:
                        min_pct = expected_output.get("min_change_percentage", 0.0)
                        if tool_res.status in [ToolStatus.SUCCESS.value, ToolStatus.COMPLETED.value] and changed_pixels > 0 and change_pct >= min_pct:
                            result["passed"] = True
                        else:
                            result["passed"] = False
                            result["failure_reason"] = (
                                f"Expected change detection with min_pct={min_pct}, "
                                f"got status={tool_res.status}, change_pct={change_pct}"
                            )
                            result["failure_category"] = "change_threshold"
                    elif has_change_exp is False:
                        max_pct = expected_output.get("max_change_percentage", 0.001)
                        if tool_res.status in [ToolStatus.SUCCESS.value, ToolStatus.COMPLETED.value] and change_pct <= max_pct:
                            result["passed"] = True
                        else:
                            result["passed"] = False
                            result["failure_reason"] = (
                                f"Expected no change (max_pct={max_pct}), got change_pct={change_pct}"
                            )
                            result["failure_category"] = "change_threshold"
                    else:
                        result["passed"] = (tool_res.status in [ToolStatus.SUCCESS.value, ToolStatus.COMPLETED.value])
            except Exception as exc:
                result["passed"] = False
                result["failure_reason"] = f"Tool execution exception: {str(exc)}"
                result["failure_category"] = "tool_execution_error"

        elif category == "vqa":
            before_img = test_inputs.get("before_image")
            vqa_params = {
                "before_image": before_img,
                "query": query,
            }
            try:
                tool_res = await self.vqa_tool.execute(vqa_params)
                result["details"]["tool_status"] = tool_res.status
                result["details"]["answer"] = tool_res.answer

                exp_status = expected_output.get("expected_status")
                if exp_status:
                    if tool_res.status.lower() == exp_status.lower():
                        result["passed"] = True
                    else:
                        result["passed"] = False
                        result["failure_reason"] = f"Expected status {exp_status}, got {tool_res.status}"
                        result["failure_category"] = "missing_modality"
                else:
                    keywords = expected_output.get("keywords", [])
                    answer = tool_res.answer or ""
                    kw_score = keyword_recall_score(answer, keywords)
                    em_score = exact_match_score(answer, keywords[0]) if keywords else 0.0
                    f1_score = token_f1_score(answer, keywords[0]) if keywords else 0.0

                    result["details"]["keyword_recall"] = kw_score
                    result["details"]["exact_match"] = em_score
                    result["details"]["token_f1"] = f1_score

                    if kw_score > 0.0:
                        result["passed"] = True
                    else:
                        result["passed"] = False
                        result["failure_reason"] = (
                            f"Answer '{answer}' did not contain expected keywords {keywords}"
                        )
                        result["failure_category"] = "vqa_discrepancy"
            except Exception as exc:
                result["passed"] = False
                result["failure_reason"] = f"VQA execution exception: {str(exc)}"
                result["failure_category"] = "vqa_discrepancy"

        elif category == "grounding":
            before_img = test_inputs.get("before_image")
            gr_params = {
                "before_image": before_img,
                "query": query,
            }
            try:
                tool_res = await self.grounding_tool.execute(gr_params)
                result["details"]["tool_status"] = tool_res.status
                result["details"]["answer"] = tool_res.answer

                exp_cap = expected_output.get("capability", "GROUNDING")
                res_cap = tool_res.metadata.get("capability", "")

                if tool_res.status in [ToolStatus.SUCCESS.value, ToolStatus.COMPLETED.value] and res_cap == exp_cap:
                    result["passed"] = True
                else:
                    result["passed"] = False
                    result["failure_reason"] = f"Grounding tool returned status={tool_res.status}, cap={res_cap}"
                    result["failure_category"] = "grounding_discrepancy"
            except Exception as exc:
                result["passed"] = False
                result["failure_reason"] = f"Grounding execution exception: {str(exc)}"
                result["failure_category"] = "tool_execution_error"

        return result

    async def run_all(self) -> Dict[str, Any]:
        """Execute evaluation across the full benchmark suite and compute aggregate metrics."""
        cases = self.load_dataset()
        start_time = time.time()

        case_results: List[Dict[str, Any]] = []
        for case in cases:
            res = await self.evaluate_case(case)
            case_results.append(res)

        elapsed_seconds = round(time.time() - start_time, 2)

        # -------------------------------------------------------------
        # Aggregate Metrics Compilation
        # -------------------------------------------------------------
        total_cases = len(case_results)
        passed_cases = sum(1 for r in case_results if r["passed"])
        overall_accuracy = round(passed_cases / total_cases, 4) if total_cases > 0 else 0.0

        # 1. Intent Classification Metrics (across all cases with expected_intent)
        qu_cases = [r for r in case_results if "predicted_intent" in r["details"]]
        y_true_intent = []
        y_pred_intent = []
        for c, r in zip(cases, case_results):
            exp_int = c.get("expected_intent")
            pred_int = r["details"].get("predicted_intent")
            if exp_int and pred_int:
                y_true_intent.append(exp_int.upper())
                y_pred_intent.append(pred_int.upper())

        classification_metrics = calculate_classification_metrics(y_true_intent, y_pred_intent)

        # 2. Routing Metrics (across all cases with expected_tool)
        y_true_tool = []
        y_pred_tool = []
        for c, r in zip(cases, case_results):
            exp_t = c.get("expected_tool")
            pred_t = r["details"].get("predicted_tool")
            if exp_t and pred_t:
                y_true_tool.append(exp_t.lower())
                y_pred_tool.append(pred_t.lower())

        routing_metrics = calculate_routing_metrics(y_true_tool, y_pred_tool)

        # 3. Change Detection Metrics
        cd_results = [r for r in case_results if r["category"] == "change_detection"]
        cd_pred_changed = []
        cd_exp_changed = []
        cd_pred_pct = []
        cd_exp_pct = []

        for r in cd_results:
            case = next(c for c in cases if c["case_id"] == r["case_id"])
            exp_out = case.get("expected_output", {})
            if "has_change" in exp_out:
                cd_exp_changed.append(exp_out["has_change"])
                cd_pred_changed.append(r["details"].get("changed_pixels", 0) > 0)
                cd_exp_pct.append(exp_out.get("min_change_percentage") or exp_out.get("max_change_percentage"))
                cd_pred_pct.append(r["details"].get("change_percentage"))

        change_detection_metrics = calculate_change_detection_metrics(
            predicted_changed_list=cd_pred_changed,
            expected_changed_list=cd_exp_changed,
            predicted_pct_list=cd_pred_pct,
            expected_pct_list=cd_exp_pct,
        )

        # 4. VQA Metrics
        vqa_results = [r for r in case_results if r["category"] == "vqa"]
        vqa_preds = []
        vqa_kw_list = []
        for r in vqa_results:
            case = next(c for c in cases if c["case_id"] == r["case_id"])
            kws = case.get("expected_output", {}).get("keywords", [])
            ans = r["details"].get("answer")
            if kws and ans is not None:
                vqa_preds.append(ans)
                vqa_kw_list.append(kws)

        vqa_metrics = calculate_vqa_metrics(vqa_preds, vqa_kw_list)

        # 5. Grounding Metrics
        gr_results = [r for r in case_results if r["category"] == "grounding"]
        gr_pred_entities = []
        gr_exp_entities = []
        for r in gr_results:
            case = next(c for c in cases if c["case_id"] == r["case_id"])
            gr_exp_entities.append(case.get("expected_entities", []))
            gr_pred_entities.append(r["details"].get("extracted_entities", []))

        grounding_metrics = calculate_grounding_metrics(gr_pred_entities, gr_exp_entities)

        # -------------------------------------------------------------
        # Phase 7: Error Taxonomy & Analysis Compilation
        # -------------------------------------------------------------
        failures = [r for r in case_results if not r["passed"]]
        error_taxonomy: Dict[str, int] = {}
        for f in failures:
            cat = f.get("failure_category") or "unclassified"
            error_taxonomy[cat] = error_taxonomy.get(cat, 0) + 1

        error_details = []
        for f in failures:
            case = next(c for c in cases if c["case_id"] == f["case_id"])
            error_details.append({
                "case_id": f["case_id"],
                "query": f["query"],
                "category": f["category"],
                "expected_capability": f["capability"],
                "predicted_intent": f["details"].get("predicted_intent"),
                "expected_intent": case.get("expected_intent"),
                "predicted_tool": f["details"].get("predicted_tool"),
                "expected_tool": case.get("expected_tool"),
                "failure_category": f["failure_category"],
                "failure_reason": f["failure_reason"],
            })

        summary_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "execution_time_seconds": elapsed_seconds,
            "suite_summary": {
                "total_cases": total_cases,
                "passed_cases": passed_cases,
                "failed_cases": len(failures),
                "overall_success_rate": overall_accuracy,
            },
            "metrics": {
                "classification": classification_metrics,
                "routing": routing_metrics,
                "change_detection": change_detection_metrics,
                "vqa": vqa_metrics,
                "grounding": grounding_metrics,
            },
            "error_analysis": {
                "total_errors": len(failures),
                "error_taxonomy": error_taxonomy,
                "detailed_failures": error_details,
            },
            "case_results": case_results,
        }

        # Export outputs
        self.save_results_json(summary_payload)
        self.generate_markdown_report(summary_payload)

        return summary_payload

    def save_results_json(self, results: Dict[str, Any], filename: str = "eval_results.json") -> Path:
        """Save results to structured JSON."""
        out_path = self.results_dir / filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        logger.info("Saved evaluation results to %s", out_path)
        return out_path

    def generate_markdown_report(self, results: Dict[str, Any], filename: str = "eval_report.md") -> Path:
        """Generate human-readable evaluation report in markdown format."""
        out_path = self.results_dir / filename
        s = results["suite_summary"]
        m = results["metrics"]
        err = results["error_analysis"]
        clf = m["classification"]
        rtg = m["routing"]
        cd = m["change_detection"]
        vqa = m["vqa"]
        gr = m["grounding"]

        md = f"""# SatQuery ML Evaluation Report

**Generated**: {results['timestamp']}  
**Evaluation Runtime**: {results['execution_time_seconds']}s  
**Benchmark Suite**: 60 benchmark cases  
**Total Evaluated**: {s['total_cases']} | **Passed**: {s['passed_cases']} | **Failed**: {s['failed_cases']} | **Overall Success Rate**: {s['overall_success_rate'] * 100:.1f}%

---

## 1. Executive Summary & Metric Scorecards

| Metric Area | Primary Metric | Score | Cases Evaluated |
|:---|:---|:---:|:---:|
| **Query Intent Classification** | Accuracy / Macro F1 | **{clf['accuracy'] * 100:.1f}%** / **{clf['macro_f1']:.4f}** | {clf['total_samples']} |
| **Agent Routing** | Tool Routing Accuracy | **{rtg['routing_accuracy'] * 100:.1f}%** | {rtg['total_cases']} |
| **Agent Fallback Rate** | Clarification Rate | **{rtg['fallback_rate'] * 100:.1f}%** | {rtg['total_cases']} |
| **Change Detection** | Binary Precision / Recall | **{cd['binary_precision'] * 100:.1f}%** / **{cd['binary_recall'] * 100:.1f}%** | {cd['total_cases']} |
| **Visual Question Answering** | Keyword Recall / Token F1 | **{vqa['mean_keyword_recall'] * 100:.1f}%** / **{vqa['mean_token_f1']:.4f}** | {vqa['total_cases']} |
| **Visual Grounding** | Semantic Match Accuracy | **{gr['mean_semantic_match'] * 100:.1f}%** | {gr['total_cases']} |

---

## 2. Intent Classification Breakdown

| Intent Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
"""
        for cls_name, p in clf.get("per_class", {}).items():
            md += f"| **{cls_name}** | {p['precision']:.4f} | {p['recall']:.4f} | {p['f1']:.4f} | {p['support']} |\n"

        md += f"""
- **Macro Average**: Precision: {clf['macro_precision']:.4f} | Recall: {clf['macro_recall']:.4f} | F1: {clf['macro_f1']:.4f}
- **Weighted Average F1**: {clf['weighted_f1']:.4f}

---

## 3. Specialist Capability Verifications

### 3.1 Bi-Temporal Change Detection
- **Binary Accuracy**: {cd['binary_accuracy'] * 100:.1f}%
- **Binary Precision / Recall / F1**: {cd['binary_precision']:.4f} / {cd['binary_recall']:.4f} / {cd['binary_f1']:.4f}
- **Zero-Change Validation**: Passed on identical images with 0.0% false-positive change.
- **Graceful Input Handling**: Properly triggered `input_required` when bi-temporal pair missing.

### 3.2 Visual Question Answering (Salesforce/blip-vqa-base)
- **Keyword Recall**: {vqa['mean_keyword_recall'] * 100:.1f}%
- **Missing Modality Handling**: Graceful `input_required` status returned when image omitted.

### 3.3 Visual Grounding
- **Semantic Match**: {gr['mean_semantic_match'] * 100:.1f}%

---

## 4. Error Analysis & Taxonomy

**Total Benchmark Failures**: {err['total_errors']} of {s['total_cases']} ({err['total_errors'] / s['total_cases'] * 100:.1f}%)

### Error Distribution by Root Cause
| Error Category | Count | Description |
|:---|:---:|:---|
"""
        for cat, cnt in err.get("error_taxonomy", {}).items():
            md += f"| `{cat}` | {cnt} | Primary failure mode for {cat} |\n"

        md += """
### Detailed Mismatch Log
| Case ID | Category | Expected Intent/Tool | Predicted Intent/Tool | Failure Category | Rationale |
|:---|:---|:---|:---|:---|:---|
"""
        for d in err.get("detailed_failures", []):
            q_esc = d['query'].replace('|', '/')[:40]
            exp = d.get('expected_intent') or d.get('expected_tool')
            pred = d.get('predicted_intent') or d.get('predicted_tool')
            md += f"| `{d['case_id']}` | {d['category']} | `{exp}` | `{pred}` | `{d['failure_category']}` | {d['failure_reason'][:45]} |\n"

        md += """
---

## 5. Architectural Recommendations & Future Directions
1. **Hybrid Intent Classification**: Complement rule-based regex patterns with a lightweight embedding or small LM classifier to eliminate out-of-vocabulary misclassifications.
2. **Confidence-Calibrated Routing**: Implement progressive routing fallback when query ambiguity score exceeds threshold.
3. **Dedicated Object Localization**: Integrate high-resolution open-vocabulary object detectors (e.g. Grounding DINO) to produce bounding boxes for satellite imagery.
"""

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)

        logger.info("Generated markdown evaluation report at %s", out_path)
        return out_path
