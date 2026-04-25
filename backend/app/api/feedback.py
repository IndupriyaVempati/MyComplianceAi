from typing import Annotated, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

import app.storage as storage
from app.auth.handlers import AuthedUser

router = APIRouter()


class FeedbackRequest(BaseModel):
    thread_id: str
    run_id: Optional[str] = None
    rating: int  # 1 = like, -1 = dislike


@router.post("")
async def create_feedback(
    user: AuthedUser,
    payload: FeedbackRequest,
):
    """Save like/dislike feedback for an AI reply."""
    if payload.rating not in (1, -1):
        return {"error": "rating must be 1 or -1"}
    return await storage.save_feedback(
        thread_id=payload.thread_id,
        run_id=payload.run_id,
        rating=payload.rating,
    )


@router.get("")
async def get_feedback(
    user: AuthedUser,
    thread_id: Optional[str] = Query(default=None),
):
    """Get feedback. Pass thread_id query param to filter by thread."""
    if thread_id:
        return await storage.list_feedback_for_thread(thread_id)
    return await storage.list_all_feedback()
