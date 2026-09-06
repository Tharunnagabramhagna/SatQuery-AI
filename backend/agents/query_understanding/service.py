"""Query Understanding Service.

Serves as the intelligence layer between API and agent orchestration.
Allows dynamic pluggability of different classification engines (rule-based, ML, LLM).
"""

from __future__ import annotations

import logging
from typing import Optional

from backend.agents.query_understanding.base import BaseQueryClassifier
from backend.agents.query_understanding.gemini import GeminiQueryClassifier
from backend.agents.query_understanding.rules import RuleBasedQueryClassifier
from backend.schemas.query_understanding import StructuredQuery

logger = logging.getLogger("satquery.query_understanding")


class QueryUnderstandingService:
    """
    Main entry point for query analysis and intent extraction.
    Decoupled from specific classifier implementation via BaseQueryClassifier.
    Defaults to GeminiQueryClassifier with automatic RuleBasedQueryClassifier fallback.
    """

    def __init__(self, classifier: Optional[BaseQueryClassifier] = None):
        self.classifier = classifier or GeminiQueryClassifier()

    def set_classifier(self, classifier: BaseQueryClassifier) -> None:
        """Dynamically replace the underlying classifier engine."""
        logger.info("Replacing classifier with %s", classifier.__class__.__name__)
        self.classifier = classifier

    async def analyze(self, query: str) -> StructuredQuery:
        """
        Analyze incoming natural-language query.

        Args:
            query: Validated user query string.

        Returns:
            StructuredQuery containing intent, confidence, targets, and metadata.
        """
        logger.debug("Analyzing query: %s", query)
        structured = await self.classifier.classify(query=query)
        logger.info(
            "Query classified as %s (confidence=%.2f, ambiguous=%s)",
            structured.intent.value,
            structured.confidence,
            structured.is_ambiguous,
        )
        return structured


# Default singleton service for application-wide injection
default_query_understanding = QueryUnderstandingService()
