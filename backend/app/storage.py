import json
from datetime import datetime, timezone
from typing import Any, List, Optional, Sequence, Union

from langchain_core.messages import AnyMessage
from langchain_core.runnables import RunnableConfig

from app.agent import agent
from app.lifespan import get_pg_pool
from app.schema import Assistant, Thread, User, SupportTicket, SupportMessage, SupportTicketStatus


def _json_dumps(v) -> str:
    """Serialise a dict to JSON string for SQLite storage."""
    if isinstance(v, str):
        return v
    return json.dumps(v)


def _json_loads(v) -> dict:
    """Deserialise a JSON string from SQLite."""
    if isinstance(v, dict):
        return v
    if v is None:
        return {}
    return json.loads(v)


async def record_kb_history(
    user_id: str, action: str, assistant_id: Optional[str] = None, file_name: Optional[str] = None
) -> None:
    """Record an action in the knowledge base history."""
    async with get_pg_pool().acquire() as conn:
        if assistant_id:
            await conn.execute(
                "INSERT INTO knowledge_base_history (assistant_id, user_id, action, file_name) VALUES ($1, $2, $3, $4)",
                assistant_id,
                user_id,
                action,
                file_name,
            )
        else:
            await conn.execute(
                "INSERT INTO knowledge_base_history (user_id, action, file_name) VALUES ($1, $2, $3)",
                user_id,
                action,
                file_name,
            )


async def list_all_kb_history() -> List[dict]:
    """Return all knowledge base history for admin view."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            """
            SELECT h.id, h.assistant_id, h.user_id, h.action, h.file_name, h.created_at,
                   a.name AS assistant_name,
                   COALESCE(u.username, h.user_id::text) AS username
            FROM knowledge_base_history h
            LEFT JOIN assistant a ON a.assistant_id = h.assistant_id
            LEFT JOIN "user" u ON u.user_id::text = h.user_id::text
            ORDER BY h.created_at DESC
            """
        )
        return [dict(r) for r in records]

async def list_assistants(user_id: str) -> List[Assistant]:
    """List all assistants (single-tenant: all users see all bots)."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch("SELECT * FROM assistant")
        result = []
        for r in records:
            cfg = _json_loads(r["config"])
            if not cfg.get("deleted"):
                result.append(Assistant(**{**r, "config": cfg}))
        return result


async def get_assistant(user_id: str, assistant_id: str) -> Optional[Assistant]:
    """Get an assistant by ID (single-tenant: any user can access any bot)."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            "SELECT * FROM assistant WHERE assistant_id = $1",
            assistant_id,
        )
        if record is None:
            return None
        return Assistant(**{**record, "config": _json_loads(record["config"])})


async def list_public_assistants() -> List[Assistant]:
    """List all the public assistants."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch("SELECT * FROM assistant WHERE public = 1")
        result = []
        for r in records:
            cfg = _json_loads(r["config"])
            if not cfg.get("deleted"):
                result.append(Assistant(**{**r, "config": cfg}))
        return result


async def put_assistant(
    user_id: str, assistant_id: str, *, name: str, config: dict, public: bool = False
) -> Assistant:
    """Modify an assistant.

    Args:
        user_id: The user ID.
        assistant_id: The assistant ID.
        name: The assistant name.
        config: The assistant config.
        public: Whether the assistant is public.

    Returns:
        return the assistant model if no exception is raised.
    """
    updated_at = datetime.now(timezone.utc)
    async with get_pg_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                (
                    "INSERT INTO assistant (assistant_id, user_id, name, config, updated_at, public) VALUES ($1, $2, $3, $4, $5, $6) "
                    "ON CONFLICT (assistant_id) DO UPDATE SET "
                    "user_id = EXCLUDED.user_id, "
                    "name = EXCLUDED.name, "
                    "config = EXCLUDED.config, "
                    "updated_at = EXCLUDED.updated_at, "
                    "public = EXCLUDED.public;"
                ),
                assistant_id,
                user_id,
                name,
                _json_dumps(config),
                updated_at,
                public,
            )
    return Assistant(
        assistant_id=assistant_id,
        user_id=user_id,
        name=name,
        config=config,
        updated_at=updated_at,
        public=public,
    )


async def delete_assistant(user_id: str, assistant_id: str) -> None:
    """Soft delete an assistant by ID by setting a deleted flag in its config."""
    async with get_pg_pool().acquire() as conn:
        # Get existing config
        record = await conn.fetchrow(
            "SELECT config FROM assistant WHERE assistant_id = $1",
            assistant_id,
        )
        if record is None:
            return
            
        config = _json_loads(record["config"])
        config["deleted"] = True
        
        updated_at = datetime.now(timezone.utc)
        
        await conn.execute(
            "UPDATE assistant SET config = $1, updated_at = $2 WHERE assistant_id = $3",
            _json_dumps(config),
            updated_at,
            assistant_id,
        )


async def delete_assistant_file(user_id: str, assistant_id: str, filename: str) -> None:
    """Delete vectors belonging to a specific file in an assistant's namespace (Pinecone)."""
    from app.vectorstore import get_vectorstore
    vstore = get_vectorstore()
    # Pinecone: delete by metadata filter
    try:
        index = vstore._index  # type: ignore[attr-defined]
        index.delete(filter={"namespace": assistant_id, "source": filename})
    except Exception as exc:
        import structlog as _sl
        _sl.get_logger(__name__).warning("Could not delete vectors for %s/%s: %s", assistant_id, filename, exc)


async def list_threads(user_id: str) -> List[Thread]:
    """List all threads for the given user."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            "SELECT * FROM thread WHERE user_id = $1 ORDER BY updated_at DESC",
            user_id
        )
        return [
            Thread(**{**r, "metadata": _json_loads(r.get("metadata")) if r.get("metadata") else None})
            for r in records
        ]


async def save_feedback(
    thread_id: str, run_id: Optional[str], rating: int
) -> dict:
    """Save a like/dislike rating for an AI reply."""
    async with get_pg_pool().acquire() as conn:
        # Upsert: only one feedback per (thread_id, run_id)
        if run_id:
            await conn.execute(
                """INSERT INTO feedback (thread_id, run_id, rating)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (thread_id, run_id) WHERE run_id IS NOT NULL DO UPDATE SET rating = EXCLUDED.rating""",
                thread_id, run_id, rating,
            )
        else:
            await conn.execute(
                """INSERT INTO feedback (thread_id, rating) VALUES ($1, $2)""",
                thread_id, rating,
            )
    return {"status": "ok"}


async def list_all_feedback() -> List[dict]:
    """Return all feedback rows for admin view."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            "SELECT id, thread_id, run_id, rating, comment, created_at FROM feedback ORDER BY created_at DESC"
        )
        return [dict(r) for r in records]


async def list_feedback_for_thread(thread_id: str) -> List[dict]:
    """Return all feedback rows for a specific thread."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            "SELECT id, thread_id, run_id, rating FROM feedback WHERE thread_id = $1",
            thread_id,
        )
        return [dict(r) for r in records]


async def list_all_threads_for_admin() -> List[dict]:
    """Return all threads with basic info for admin view."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            """
            SELECT t.thread_id, t.name, t.user_id, t.updated_at,
                   a.name AS assistant_name,
                   COALESCE(u.username, t.user_id::text) AS username,
                   COUNT(f.id) AS feedback_count,
                   SUM(CASE WHEN f.rating = 1 THEN 1 ELSE 0 END) AS likes,
                   SUM(CASE WHEN f.rating = -1 THEN 1 ELSE 0 END) AS dislikes
            FROM thread t
            LEFT JOIN assistant a ON a.assistant_id = t.assistant_id
            LEFT JOIN feedback f ON f.thread_id = t.thread_id
            LEFT JOIN "user" u ON u.user_id::text = t.user_id::text
            GROUP BY t.thread_id, a.name, u.username
            ORDER BY t.updated_at DESC
            """
        )
        return [dict(r) for r in records]


async def get_thread(user_id: str, thread_id: str) -> Optional[Thread]:
    """Get a thread by ID."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            "SELECT * FROM thread WHERE thread_id = $1 AND user_id = $2",
            thread_id,
            user_id,
        )
        if record is None:
            return None
        return Thread(**{**record, "metadata": _json_loads(record.get("metadata")) if record.get("metadata") else None})


async def get_thread_by_id(thread_id: str) -> Optional[Thread]:
    """Get a thread by ID without user ownership check (admin use only)."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            "SELECT * FROM thread WHERE thread_id = $1",
            thread_id,
        )
        if record is None:
            return None
        return Thread(**{**record, "metadata": _json_loads(record.get("metadata")) if record.get("metadata") else None})


async def get_thread_state(*, user_id: str, thread_id: str, assistant: Assistant):
    """Get state for a thread."""
    config = {
        "configurable": {
            **assistant.config["configurable"],
            "thread_id": thread_id,
            "assistant_id": assistant.assistant_id,
        }
    }
    try:
        state = await agent.aget_state(config)
        values = state.values if state.values else None
        return {"values": values, "next": state.next}
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "Failed to deserialize checkpoint for thread %s (%s). Trying fallback checkpoint loader.",
            thread_id,
            exc,
        )
        try:
            from app.checkpoint import _AppCheckpointSerializer, _db_path
            import aiosqlite

            serde = _AppCheckpointSerializer()
            async with aiosqlite.connect(_db_path()) as conn:
                conn.row_factory = aiosqlite.Row
                async with conn.execute(
                    """
                    SELECT type, checkpoint
                    FROM checkpoints
                    WHERE thread_id = ?
                    ORDER BY checkpoint_id DESC
                    LIMIT 1
                    """,
                    (thread_id,),
                ) as cur:
                    row = await cur.fetchone()
            if row:
                checkpoint = serde.loads_typed((row["type"], row["checkpoint"]))
                return {
                    "values": checkpoint.get("channel_values", {"messages": []}),
                    "next": [],
                }
        except Exception:
            logging.getLogger(__name__).exception(
                "Failed to load fallback checkpoint for thread %s.", thread_id
            )
        return {"values": {"messages": []}, "next": []}


async def update_thread_state(
    config: RunnableConfig,
    values: Union[Sequence[AnyMessage], dict[str, Any]],
    *,
    user_id: str,
    assistant: Assistant,
):
    """Add state to a thread."""
    # Get the current state to determine the format
    current_state = await agent.aget_state(
        {
            "configurable": {
                **assistant.config["configurable"],
                **config["configurable"],
                "assistant_id": assistant.assistant_id,
            }
        }
    )

    # If current state is a dict (retrieval agent), maintain dict structure
    if current_state.values and isinstance(current_state.values, dict):
        if isinstance(values, dict):
            state_values = values
        else:
            # Update just the messages in the existing state
            state_values = {**current_state.values, "messages": values}
    else:
        # For message-only states (tools_agent, chatbot), just use the messages
        state_values = (
            values if isinstance(values, dict) and "messages" in values else values
        )

    await agent.aupdate_state(
        {
            "configurable": {
                **assistant.config["configurable"],
                **config["configurable"],
                "assistant_id": assistant.assistant_id,
            }
        },
        state_values,
    )


async def get_thread_history(*, user_id: str, thread_id: str, assistant: Assistant):
    """Get the history of a thread."""
    return [
        {
            "values": c.values,
            "next": c.next,
            "config": c.config,
            "parent": c.parent_config,
        }
        async for c in agent.aget_state_history(
            {
                "configurable": {
                    **assistant.config["configurable"],
                    "thread_id": thread_id,
                    "assistant_id": assistant.assistant_id,
                }
            }
        )
    ]


def get_assistant_type(config: dict) -> str:
    """Extract assistant type from config, handling both old and new formats."""
    configurable = config.get("configurable", {})

    # First try direct type key (old format)
    if "type" in configurable:
        return configurable["type"]

    # Default fallback
    return "chatbot"


async def put_thread(
    user_id: str, thread_id: str, *, assistant_id: str, name: str
) -> Thread:
    """Modify a thread."""
    updated_at = datetime.now(timezone.utc)
    assistant = await get_assistant(user_id, assistant_id)
    metadata = (
        {"assistant_type": get_assistant_type(assistant.config)} if assistant else None
    )
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            (
                "INSERT INTO thread (thread_id, user_id, assistant_id, name, updated_at, metadata) VALUES ($1, $2, $3, $4, $5, $6) "
                "ON CONFLICT (thread_id) DO UPDATE SET "
                "user_id = EXCLUDED.user_id,"
                "assistant_id = EXCLUDED.assistant_id, "
                "name = EXCLUDED.name, "
                "updated_at = EXCLUDED.updated_at, "
                "metadata = EXCLUDED.metadata;"
            ),
            thread_id,
            user_id,
            assistant_id,
            name,
            updated_at,
            _json_dumps(metadata) if metadata else None,
        )
        return Thread(
            thread_id=thread_id,
            user_id=user_id,
            assistant_id=assistant_id,
            name=name,
            updated_at=updated_at,
            metadata=metadata,
        )


async def delete_thread(user_id: str, thread_id: str):
    """Delete a thread by ID."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "DELETE FROM thread WHERE thread_id = $1 AND user_id = $2",
            thread_id,
            user_id,
        )


def _row_to_user(r: dict) -> User:
    """Convert a SQLite row dict to a User, coercing types."""
    r = dict(r)
    r["is_admin"] = bool(r.get("is_admin", 0))
    return User(**r)


async def get_or_create_user(sub: str) -> tuple[User, bool]:
    """Returns a tuple of the user and a boolean indicating whether the user was created."""
    async with get_pg_pool().acquire() as conn:
        if record := await conn.fetchrow('SELECT * FROM "user" WHERE sub = $1', sub):
            return _row_to_user(record), False
        await conn.execute('INSERT INTO "user" (sub) VALUES ($1)', sub)
        record = await conn.fetchrow('SELECT * FROM "user" WHERE sub = $1', sub)
        return _row_to_user(record), True


async def get_user_by_username(username: str) -> Optional[User]:
    """Get a user by their username."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            'SELECT * FROM "user" WHERE username = $1', username
        )
        if record is None:
            return None
        return _row_to_user(record)


async def get_user_by_id(sub: str) -> Optional[User]:
    """Get a user by their sub ID (found in JWT)."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            'SELECT * FROM "user" WHERE sub = $1', sub
        )
        if record is None:
            return None
        return _row_to_user(record)


async def create_user_credentials(
    username: str, 
    password_hash: str, 
    name: Optional[str] = None,
    phone: Optional[str] = None,
    is_admin: bool = False
) -> tuple[User, bool]:
    """Create a new user with credentials, or return existing if username taken."""
    async with get_pg_pool().acquire() as conn:
        # Check if username exists
        if record := await conn.fetchrow('SELECT * FROM "user" WHERE username = $1', username):
            return _row_to_user(record), False
            
        # Use a unique sub based on username for local users
        sub = f"local|{username}"
        
        # If sub already exists (e.g. they logged in via OIDC before), update with username
        if record := await conn.fetchrow('SELECT * FROM "user" WHERE sub = $1', sub):
            await conn.execute(
                'UPDATE "user" SET username = $1, password_hash = $2, name = $3, phone = $4, is_admin = $5 WHERE sub = $6',
                username, password_hash, name, phone, is_admin, sub
            )
            record = await conn.fetchrow('SELECT * FROM "user" WHERE sub = $1', sub)
            return _row_to_user(record), True
            
        await conn.execute(
            'INSERT INTO "user" (sub, username, password_hash, name, phone, is_admin) VALUES ($1, $2, $3, $4, $5, $6)',
            sub, username, password_hash, name, phone, is_admin
        )
        record = await conn.fetchrow('SELECT * FROM "user" WHERE sub = $1', sub)
        return _row_to_user(record), True

async def list_all_users() -> list[dict]:
    """Admin function to list all users, including those with pending invites."""
    async with get_pg_pool().acquire() as conn:
        # Get actual users
        user_records = await conn.fetch('SELECT * FROM "user" ORDER BY created_at DESC')
        users = [dict(r) for r in user_records]
        
        # Get pending invites (unregistered)
        invite_records = await conn.fetch(
            '''SELECT t.email, MAX(t.created_at) as created_at
               FROM invite_token t
               LEFT JOIN "user" u ON u.username = t.email
               WHERE u.user_id IS NULL AND t.used = FALSE
               GROUP BY t.email
               ORDER BY created_at DESC'''
        )
        for r in invite_records:
            users.append({
                "user_id": f"invite_{r['email']}",
                "username": r["email"],
                "name": None,
                "phone": None,
                "is_admin": False,
                "created_at": r["created_at"],
                "last_seen": None,
                "is_invite_pending": True,
            })
            
        return users

async def delete_user(user_id: str) -> None:
    """Admin function to delete a user and all their associated data."""
    async with get_pg_pool().acquire() as conn:
        async with conn.transaction():
            threads = await conn.fetch('SELECT thread_id FROM thread WHERE user_id = $1', user_id)
            await conn.execute('DELETE FROM assistant WHERE user_id = $1', user_id)
            await conn.execute('DELETE FROM thread WHERE user_id = $1', user_id)
            await conn.execute('DELETE FROM "user" WHERE user_id = $1', user_id)

async def delete_invite(email: str) -> None:
    """Admin function to delete a pending invite for an email."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute('DELETE FROM invite_token WHERE email = $1', email)

async def update_user(
    user_id: str, 
    username: str, 
    is_admin: bool, 
    name: Optional[str] = None,
    phone: Optional[str] = None,
    password_hash: Optional[str] = None
) -> Optional[User]:
    """Admin function to update a user."""
    async with get_pg_pool().acquire() as conn:
        if password_hash:
            await conn.execute(
                'UPDATE "user" SET username = $1, is_admin = $2, name = $3, phone = $4, password_hash = $5 WHERE user_id = $6',
                username, is_admin, name, phone, password_hash, user_id
            )
        else:
            await conn.execute(
                'UPDATE "user" SET username = $1, is_admin = $2, name = $3, phone = $4 WHERE user_id = $5',
                username, is_admin, name, phone, user_id
            )
        record = await conn.fetchrow('SELECT * FROM "user" WHERE user_id = $1', user_id)
            
        if record:
            return _row_to_user(record)
        return None


# ---------------------------------------------------------------------------
# Invite token helpers
# ---------------------------------------------------------------------------

async def create_invite_token(email: str, token: str) -> None:
    """Insert a new invite token row, invalidating old unused tokens."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute("DELETE FROM invite_token WHERE email = $1 AND used = FALSE", email)
        await conn.execute(
            "INSERT INTO invite_token (token, email) VALUES ($1, $2)",
            token, email,
        )


async def get_invite_token(token: str) -> Optional[dict]:
    """Return the invite token row, or None if not found."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            "SELECT * FROM invite_token WHERE token = $1", token
        )
        return dict(record) if record else None


async def mark_invite_token_used(token: str) -> None:
    """Mark an invite token as used."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "UPDATE invite_token SET used = TRUE WHERE token = $1", token
        )


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------

async def create_otp(email: str, otp: str) -> None:
    """Store a new OTP (invalidates previous ones for same email)."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "UPDATE otp_token SET used = TRUE WHERE email = $1 AND used = FALSE",
            email,
        )
        await conn.execute(
            "INSERT INTO otp_token (email, otp) VALUES ($1, $2)",
            email, otp,
        )


async def get_latest_otp(email: str) -> Optional[dict]:
    """Return the most recent unused OTP for an email, or None."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            """SELECT * FROM otp_token
               WHERE email = $1 AND used = FALSE
               ORDER BY created_at DESC
               LIMIT 1""",
            email,
        )
        return dict(record) if record else None


async def mark_otp_used(otp_id: int) -> None:
    """Mark an OTP row as used."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "UPDATE otp_token SET used = TRUE WHERE id = $1", otp_id
        )


async def update_user_password(user_id: str, password_hash: str) -> bool:
    """Update a user's password hash."""
    async with get_pg_pool().acquire() as conn:
        res = await conn.execute(
            'UPDATE "user" SET password_hash = $1 WHERE user_id = $2',
            password_hash, user_id,
        )
        return res != "UPDATE 0"


# ---------------------------------------------------------------------------
# Support Ticket helpers
# ---------------------------------------------------------------------------

async def create_support_ticket(user_id: str, label: Optional[str] = None) -> SupportTicket:
    """Create a new support ticket for a user."""
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO support_ticket (user_id, label) VALUES ($1, $2)",
            user_id, label
        )
        record = await conn.fetchrow(
            "SELECT * FROM support_ticket WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
            user_id
        )
        user_record = await conn.fetchrow('SELECT username FROM "user" WHERE user_id = $1', user_id)
        return SupportTicket(**record, username=user_record["username"] if user_record else None)


async def get_support_ticket(ticket_id: str) -> Optional[SupportTicket]:
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            """SELECT st.*, u.username as username
               FROM support_ticket st
               LEFT JOIN "user" u ON u.user_id = st.user_id
               WHERE st.id = $1""",
            ticket_id
        )
        if record is None:
            return None
        return SupportTicket(**record)


async def get_support_tickets_for_user(user_id: str) -> List[SupportTicket]:
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            """SELECT st.*, u.username as username
               FROM support_ticket st
               LEFT JOIN "user" u ON u.user_id = st.user_id
               WHERE st.user_id = $1
               ORDER BY st.created_at DESC""",
            user_id
        )
        return [SupportTicket(**r) for r in records]


async def get_all_support_tickets() -> List[SupportTicket]:
    """Admin function: get all support tickets, grouped with the latest update info or just ordered by created_at."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            """
            SELECT st.*, u.username as username
            FROM support_ticket st
            LEFT JOIN "user" u ON u.user_id = st.user_id
            ORDER BY st.created_at DESC
            """
        )
        return [SupportTicket(**r) for r in records]


async def close_support_ticket(ticket_id: str, closed_by: str = "user") -> None:
    async with get_pg_pool().acquire() as conn:
        await conn.execute(
            "UPDATE support_ticket SET status = 'closed', closed_by = $2 WHERE id = $1",
            ticket_id, closed_by
        )


async def add_support_message(ticket_id: str, sender_id: str, content: str) -> SupportMessage:
    """Add a new message to an existing ticket."""
    async with get_pg_pool().acquire() as conn:
        record = await conn.fetchrow(
            """
            INSERT INTO support_message (ticket_id, sender_id, content) 
            VALUES ($1::uuid, $2::uuid, $3)
            RETURNING *
            """,
            ticket_id, sender_id, content
        )
        # Fetch username to attach
        user_record = await conn.fetchrow('SELECT username FROM "user" WHERE user_id = $1::uuid', sender_id)
        return SupportMessage(**record, sender_username=user_record["username"] if user_record else None)


async def get_support_messages(ticket_id: str) -> List[SupportMessage]:
    """Get all messages for a specific ticket, ordered by creation time asc."""
    async with get_pg_pool().acquire() as conn:
        records = await conn.fetch(
            """
            SELECT sm.*, u.username as sender_username
            FROM support_message sm
            LEFT JOIN "user" u ON u.user_id = sm.sender_id
            WHERE sm.ticket_id = $1::uuid
            ORDER BY sm.created_at ASC
            """,
            ticket_id
        )
        return [SupportMessage(**r) for r in records]
