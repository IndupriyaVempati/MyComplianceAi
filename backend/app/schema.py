from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    user_id: str
    """The ID of the user."""
    sub: str
    """The sub of the user (from a JWT token)."""
    username: Optional[str] = None
    """The username for local authentication."""
    name: Optional[str] = None
    """The user's display name."""
    phone: Optional[str] = None
    """The user's phone number."""
    password_hash: Optional[str] = None
    """The hashed password for local authentication."""
    is_admin: bool = False
    """Whether the user is an admin."""
    created_at: datetime
    """The time the user was created."""
    last_seen: Optional[datetime] = None
    """The last time the user logged in."""
    stripe_customer_id: Optional[str] = None
    """The user's Stripe Customer ID."""
    plan_type: str = "freemium"
    """The user's active subscription plan (freemium or premium)."""


class Assistant(BaseModel):
    assistant_id: str
    """The ID of the assistant."""
    user_id: str
    """The ID of the user that owns the assistant."""
    name: str
    """The name of the assistant."""
    config: dict
    """The assistant config."""
    updated_at: datetime
    """The last time the assistant was updated."""
    public: bool = False
    """Whether the assistant is public."""


class Thread(BaseModel):
    thread_id: str
    """The ID of the thread."""
    user_id: str
    """The ID of the user that owns the thread."""
    assistant_id: Optional[str] = None
    """The assistant that was used in conjunction with this thread."""
    name: str
    """The name of the thread."""
    updated_at: datetime
    """The last time the thread was updated."""
    metadata: Optional[dict] = None


class SupportTicketStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class SupportTicket(BaseModel):
    id: str
    """The ID of the ticket."""
    user_id: str
    """The ID of the user who created the ticket."""
    status: SupportTicketStatus
    """The status of the ticket."""
    created_at: datetime
    """When the ticket was created."""
    username: Optional[str] = None
    """The username of the ticket creator (joined from user table)."""
    closed_by: Optional[str] = None
    """Who closed the ticket: 'admin' or 'user'."""
    label: Optional[str] = None
    """A descriptive label for the ticket, e.g. the chat name."""


class SupportMessage(BaseModel):
    id: str
    """The ID of the message."""
    ticket_id: str
    """The ticket ID this message belongs to."""
    sender_id: str
    """The user ID of the sender."""
    content: str
    """The message contents."""
    created_at: datetime
    """When the message was created."""
    sender_username: Optional[str] = None
    """The username of the sender (joined from user table)."""
