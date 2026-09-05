"""Base abstract classifier interface for Query Understanding."""

from abc import ABC, abstractmethod

from backend.schemas.query_understanding import StructuredQuery


class BaseQueryClassifier(ABC):
    """
    Abstract interface for SatQuery intent classifiers.

    Allows plugging in either deterministic rule-based classifiers,
    fine-tuned models, or LLM-based classifiers without altering
    the orchestrator, router, or API contracts.
    """

    @abstractmethod
    async def classify(self, query: str) -> StructuredQuery:
        """
        Classify a natural-language query and extract structured parameters.

        Args:
            query: Sanitized user query text.

        Returns:
            StructuredQuery containing intent, confidence, targets, temporal,
            spatial, and comparison metadata.
        """
        pass
