"""Base abstract router interface for SatQuery."""

from abc import ABC, abstractmethod

from backend.schemas.query_understanding import StructuredQuery
from backend.schemas.router import RoutingDecision


class BaseRouter(ABC):
    """
    Abstract interface for Agent Routers.
    Decouples query routing decisions from specific heuristics or ML models.
    """

    @abstractmethod
    async def route(self, structured_query: StructuredQuery) -> RoutingDecision:
        """
        Evaluate a StructuredQuery and decide which tool should execute it.

        Args:
            structured_query: Result produced by Query Understanding layer.

        Returns:
            RoutingDecision specifying the selected tool, confidence, and metadata.
        """
        pass
