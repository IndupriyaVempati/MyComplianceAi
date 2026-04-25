from typing import List, Optional

from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel

import app.storage as storage
from app.auth.handlers import AuthedUser
from app.schema import SupportTicket, SupportMessage

router = APIRouter()


class CreateTicketRequest(BaseModel):
    initial_message: Optional[str] = None
    label: Optional[str] = None


@router.post("/ticket", response_model=SupportTicket)
async def create_ticket(
    user: AuthedUser,
    request: CreateTicketRequest,
):
    """Create a new support ticket."""
    ticket = await storage.create_support_ticket(user.user_id, label=request.label)
    
    # If the user provided an initial message (like context from current chat), save it
    if request.initial_message:
        await storage.add_support_message(ticket.id, user.user_id, request.initial_message)
        
    return ticket


@router.get("/ticket", response_model=List[SupportTicket])
async def list_tickets(user: AuthedUser):
    """List tickets (all if admin, else just those belonging to user)."""
    if user.is_admin:
        return await storage.get_all_support_tickets()
    return await storage.get_support_tickets_for_user(user.user_id)


@router.get("/ticket/{ticket_id}/messages", response_model=List[SupportMessage])
async def list_ticket_messages(user: AuthedUser, ticket_id: str):
    """Get messages for a specific ticket."""
    ticket = await storage.get_support_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Check authorization
    if not user.is_admin and ticket.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return await storage.get_support_messages(ticket_id)


class SupportMessageRequest(BaseModel):
    content: str


@router.post("/ticket/{ticket_id}/message", response_model=SupportMessage)
async def add_message(user: AuthedUser, ticket_id: str, request: SupportMessageRequest):
    """Add a new message to a ticket."""
    ticket = await storage.get_support_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Ticket is closed")
        
    if not user.is_admin and ticket.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return await storage.add_support_message(ticket_id, user.user_id, request.content)


@router.patch("/ticket/{ticket_id}/close")
async def close_ticket(user: AuthedUser, ticket_id: str):
    """Close a ticket."""
    ticket = await storage.get_support_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if not user.is_admin and ticket.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    closed_by = "admin" if user.is_admin else "user"
    await storage.close_support_ticket(ticket_id, closed_by=closed_by)
    return {"status": "ok"}
