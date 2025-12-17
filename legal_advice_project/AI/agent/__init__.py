from .lawyer import router as lawyer_router
from .contract import router as contract_router
from .assistant import router as assistant_router
from .reviewer import router as reviewer_router

__all__ = ["lawyer_router", "contract_router", "assistant_router", "reviewer_router"]
