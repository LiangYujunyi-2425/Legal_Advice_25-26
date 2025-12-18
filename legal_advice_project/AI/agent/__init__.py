from .lawyer import router as lawyer_router
from .contract import router as contract_router
from .assistant import router as assistant_router
from .Summarizer import router as summarizer_router
from .summarizesreviewer import router as summarizesreviewer_router

__all__ = ["lawyer_router", "contract_router", "assistant_router", "summarizer_router", "summarizesreviewer_router"]
