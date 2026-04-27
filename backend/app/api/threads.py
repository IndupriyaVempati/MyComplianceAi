from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional, Sequence, Union
from uuid import uuid4
import re

from fastapi import APIRouter, HTTPException, Path, UploadFile, Form
from langchain_core.messages import AnyMessage
from pydantic import BaseModel, Field

import app.storage as storage
from app.auth.handlers import AuthedUser
from app.schema import Thread
from app.email_utils import send_pdf_email_safe
from app.pdf_generator import generate_pdf_from_messages
from fastapi.responses import Response

router = APIRouter()


ThreadID = Annotated[str, Path(description="The ID of the thread.")]


class ThreadPutRequest(BaseModel):
    """Payload for creating a thread."""

    name: Annotated[str, Field(description="The name of the thread.")]
    assistant_id: Annotated[str, Field(description="The ID of the assistant to use.")]


class ThreadPostRequest(BaseModel):
    """Payload for adding state to a thread."""

    values: Union[Sequence[AnyMessage], Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None


@router.get("/")
async def list_threads(user: AuthedUser) -> List[Thread]:
    """List all threads for the current user."""
    return await storage.list_threads(user.user_id)


@router.get("/{tid}/state")
async def get_thread_state(
    user: AuthedUser,
    tid: ThreadID,
):
    """Get state for a thread."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
    return await storage.get_thread_state(
        user_id=user.user_id,
        thread_id=tid,
        assistant=assistant,
    )


@router.post("/{tid}/state")
async def add_thread_state(
    user: AuthedUser,
    tid: ThreadID,
    payload: ThreadPostRequest,
):
    """Add state to a thread."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
    return await storage.update_thread_state(
        payload.config or {"configurable": {"thread_id": tid}},
        payload.values,
        user_id=user.user_id,
        assistant=assistant,
    )


@router.get("/{tid}/history")
async def get_thread_history(
    user: AuthedUser,
    tid: ThreadID,
):
    """Get all past states for a thread."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
    return await storage.get_thread_history(
        user_id=user.user_id,
        thread_id=tid,
        assistant=assistant,
    )


@router.get("/{tid}")
async def get_thread(
    user: AuthedUser,
    tid: ThreadID,
) -> Thread:
    """Get a thread by ID."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@router.post("")
async def create_thread(
    user: AuthedUser,
    thread_put_request: ThreadPutRequest,
) -> Thread:
    """Create a thread."""
    return await storage.put_thread(
        user.user_id,
        str(uuid4()),
        assistant_id=thread_put_request.assistant_id,
        name=thread_put_request.name,
    )


@router.put("/{tid}")
async def upsert_thread(
    user: AuthedUser,
    tid: ThreadID,
    thread_put_request: ThreadPutRequest,
) -> Thread:
    """Update a thread."""
    return await storage.put_thread(
        user.user_id,
        tid,
        assistant_id=thread_put_request.assistant_id,
        name=thread_put_request.name,
    )


@router.delete("/{tid}")
async def delete_thread(
    user: AuthedUser,
    tid: ThreadID,
):
    """Delete a thread by ID."""
    await storage.delete_thread(user.user_id, tid)
    return {"status": "ok"}


@router.get("/{tid}/pdf")
async def download_thread_pdf(
    user: AuthedUser,
    tid: ThreadID,
):
    """Generate and download a PDF of the thread history."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
        
    state = await storage.get_thread_state(
        user_id=user.user_id,
        thread_id=tid,
        assistant=assistant,
    )
    
    values = state["values"] if state else {}
    messages = values if isinstance(values, list) else values.get("messages", [])
    
    # Generate the PDF mapping the state values
    pdf_bytes = generate_pdf_from_messages(thread.name, messages)
    
    _now = datetime.now(timezone.utc).strftime("%Y%m%d_%I%M%S%p")
    _safe_name = re.sub(r'[^\w\-]', '_', thread.name or "chat").strip('_') or "chat"
    pdf_filename = f"{_safe_name}_{_now}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{pdf_filename}"'})


@router.post("/{tid}/email-pdf")
async def email_thread_pdf(
    user: AuthedUser,
    tid: ThreadID,
    email: str = Form(...),
):
    """Email a generated PDF of the thread to the given address."""
    thread = await storage.get_thread(user.user_id, tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
        
    state = await storage.get_thread_state(
        user_id=user.user_id,
        thread_id=tid,
        assistant=assistant,
    )
        
    values = state["values"] if state else {}
    messages = values if isinstance(values, list) else values.get("messages", [])
    
    pdf_bytes = generate_pdf_from_messages(thread.name, messages)
    
    # Send email
    subject = f"Your chat transcript: {thread.name}"
    body = f"<p>Attached is the PDF transcript of your chat <strong>{thread.name}</strong>.</p>"
    
    _now = datetime.now(timezone.utc).strftime("%Y%m%d_%I%M%S%p")
    _safe_name = re.sub(r'[^\w\-]', '_', thread.name or "chat").strip('_') or "chat"
    pdf_filename = f"{_safe_name}_{_now}.pdf"
    error = send_pdf_email_safe(email, subject, body, pdf_bytes, pdf_filename)
    if error:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {error}")
        
    return {"status": "ok"}
