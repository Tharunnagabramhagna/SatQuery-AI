"""Frontend-compatible response adapter for SatQuery AI.

Transforms internal orchestrator results (snake_case) into the camelCase
response shape expected by the React frontend AnalysisResponse type.

This module exists ONLY as an API boundary serializer.
Internal backend schemas remain snake_case.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FrontendEvidence(BaseModel):
    """Frontend-compatible evidence item."""

    type: str
    description: str
    source: str


class FrontendVisualization(BaseModel):
    """Frontend-compatible visualization item."""

    type: str
    data: Any = None
    label: str


class FrontendExecutionTraceStep(BaseModel):
    """Frontend-compatible execution trace step.

    Frontend expects `duration` (not `duration_ms`).
    """

    step: int
    action: str
    detail: str
    duration: Optional[float] = None
    status: str = "completed"


class FrontendAnalysisResponse(BaseModel):
    """Exact response shape the React frontend expects.

    All field names use camelCase via Pydantic aliases for JSON serialization.
    Internal attribute names remain snake_case for Python code readability.
    """

    analysis_id: str = Field(..., serialization_alias="analysisId")
    status: str
    task: str
    answer: str
    confidence: float
    evidence: List[FrontendEvidence]
    visualizations: List[FrontendVisualization]
    execution_trace: List[FrontendExecutionTraceStep] = Field(
        ..., serialization_alias="executionTrace"
    )
    warnings: List[str]
    is_demo: bool = Field(..., serialization_alias="isDemo")

    @classmethod
    def from_orchestrator_result(cls, result: Dict[str, Any]) -> "FrontendAnalysisResponse":
        """Transform an orchestrator.process_query() result dict into the frontend shape.

        Mapping rules:
        - analysisId: freshly generated UUID
        - status: derived from tool_result.status, NOT the orchestrator top-level status
        - task: the classified intent (from query understanding)
        - answer: from tool_result.answer (genuine tool output)
        - confidence: from tool_result.confidence (genuine analysis confidence)
        - evidence: from tool_result.evidence (pass-through)
        - visualizations: from tool_result.visualizations (pass-through)
        - executionTrace: from execution_trace with duration_ms → duration
        - warnings: merged warnings from orchestrator
        - isDemo: always False for real backend analysis
        """
        analysis_id = str(uuid.uuid4())

        # Extract tool result for status/confidence/answer
        tool_result = result.get("tool_result")
        tool_result_dict: Dict[str, Any] = {}
        if tool_result is not None:
            if hasattr(tool_result, "model_dump"):
                tool_result_dict = tool_result.model_dump()
            elif isinstance(tool_result, dict):
                tool_result_dict = tool_result
            else:
                tool_result_dict = {}

        tool_status = tool_result_dict.get("status", "error") if tool_result_dict else "error"

        # Map internal tool status → frontend AnalysisStatus
        # Frontend defines: 'idle' | 'validating' | 'uploading' | 'analyzing' | 'completed' | 'error'
        if tool_status == "success":
            frontend_status = "completed"
        elif tool_status == "input_required":
            # Frontend has no 'input_required' status; use 'error' and preserve message in answer/warnings
            frontend_status = "error"
        elif tool_status in ("not_implemented", "clarification_needed"):
            frontend_status = "error"
        else:
            frontend_status = "error"

        # Task: normalized to lowercase to match frontend AnalysisCapability enum
        raw_task = result.get("task", "unknown")
        task = raw_task.lower() if isinstance(raw_task, str) else "unknown"

        # Answer: from tool result (genuine)
        answer = tool_result_dict.get("answer") or ""

        # Confidence: from tool_result.confidence (genuine analysis confidence)
        # NOT routing_confidence, NOT change_percentage
        tool_confidence = tool_result_dict.get("confidence")
        if tool_confidence is not None and isinstance(tool_confidence, (int, float)):
            confidence = float(tool_confidence)
        else:
            # Fallback: if tool has no confidence (e.g. input_required), use 0.0
            confidence = 0.0

        # Evidence: pass through from tool result
        raw_evidence = tool_result_dict.get("evidence", [])
        evidence = [
            FrontendEvidence(
                type=e.get("type", "unknown") if isinstance(e, dict) else getattr(e, "type", "unknown"),
                description=e.get("description", "") if isinstance(e, dict) else getattr(e, "description", ""),
                source=e.get("source", "") if isinstance(e, dict) else getattr(e, "source", ""),
            )
            for e in raw_evidence
        ]

        # Visualizations: pass through from tool result
        raw_viz = tool_result_dict.get("visualizations", [])
        visualizations = [
            FrontendVisualization(
                type=v.get("type", "unknown") if isinstance(v, dict) else getattr(v, "type", "unknown"),
                data=v.get("data") if isinstance(v, dict) else getattr(v, "data", None),
                label=v.get("label", "") if isinstance(v, dict) else getattr(v, "label", ""),
            )
            for v in raw_viz
        ]

        # Execution trace: convert duration_ms → duration
        raw_trace = result.get("execution_trace", [])
        execution_trace = []
        for step in raw_trace:
            if hasattr(step, "model_dump"):
                step_dict = step.model_dump()
            elif isinstance(step, dict):
                step_dict = step
            else:
                continue

            execution_trace.append(
                FrontendExecutionTraceStep(
                    step=step_dict.get("step", 0),
                    action=step_dict.get("action", ""),
                    detail=step_dict.get("detail", ""),
                    duration=step_dict.get("duration_ms"),
                    status=step_dict.get("status", "completed"),
                )
            )

        # Warnings: from orchestrator merged warnings
        warnings = list(result.get("warnings", []))

        # For input_required, ensure the missing-input message is in warnings
        if tool_status == "input_required" and answer and answer not in warnings:
            warnings.insert(0, answer)

        return cls(
            analysis_id=analysis_id,
            status=frontend_status,
            task=task,
            answer=answer,
            confidence=confidence,
            evidence=evidence,
            visualizations=visualizations,
            execution_trace=execution_trace,
            warnings=warnings,
            is_demo=False,
        )
