"""App lifespan: SQLite-backed storage, Pinecone vector store, government doc ingestion."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI

from app.checkpoint import setup_checkpointer

logger = structlog.get_logger(__name__)

GOVERNMENT_DOCS_DIR = os.environ.get("GOVERNMENT_DOCS_DIR", "")


# ---------------------------------------------------------------------------
# SQLite helpers (replaces asyncpg pool)
# ---------------------------------------------------------------------------

_sqlite_db: "aiosqlite.Connection | None" = None  # type: ignore[name-defined]


def get_pg_pool():
    """Returns the SQLite connection wrapped in a thin compatibility shim."""
    return _SqliteShim(_sqlite_db)


class _SqliteShim:
    """Minimal asyncpg-compatible shim so storage.py works without changes."""

    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        return _SqliteContext(self._conn)


class _SqliteContext:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return _SqliteConn(self._conn)

    async def __aexit__(self, *args):
        pass


class _SqliteConn:
    """Wraps aiosqlite to mimic asyncpg's fetch/fetchrow/execute interface."""

    def __init__(self, conn):
        self._conn = conn

    async def execute(self, query: str, *args):
        await self._conn.execute(self._pg_to_sqlite(query), args)
        await self._conn.commit()

    async def fetch(self, query: str, *args) -> list[dict]:
        async with self._conn.execute(self._pg_to_sqlite(query), args) as cur:
            rows = await cur.fetchall()
            cols = [d[0] for d in cur.description] if cur.description else []
            return [dict(zip(cols, row)) for row in rows]

    async def fetchrow(self, query: str, *args) -> dict | None:
        async with self._conn.execute(self._pg_to_sqlite(query), args) as cur:
            row = await cur.fetchone()
            if row is None:
                return None
            cols = [d[0] for d in cur.description] if cur.description else []
            return dict(zip(cols, row))

    async def fetchval(self, query: str, *args):
        async with self._conn.execute(self._pg_to_sqlite(query), args) as cur:
            row = await cur.fetchone()
            return row[0] if row else None

    def transaction(self):
        return _NullContext()

    @staticmethod
    def _pg_to_sqlite(query: str) -> str:
        """Convert Postgres SQL to SQLite-compatible SQL."""
        import re
        # $1, $2 ... → ?
        query = re.sub(r"\$\d+", "?", query)
        # Remove Postgres type casts: ::uuid, ::text, ::boolean, etc.
        query = re.sub(r"::[a-zA-Z_]+", "", query)
        # NOW() → datetime('now')
        query = re.sub(r"\bNOW\(\)", "datetime('now')", query, flags=re.IGNORECASE)
        return query


class _NullContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


# ---------------------------------------------------------------------------
# SQLite schema bootstrap
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS "user" (
    user_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sub         TEXT UNIQUE NOT NULL,
    username    TEXT,
    name        TEXT,
    phone       TEXT,
    password_hash TEXT,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen   TEXT,
    stripe_customer_id TEXT,
    plan_type   TEXT NOT NULL DEFAULT 'freemium'
);

CREATE TABLE IF NOT EXISTS assistant (
    assistant_id TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    config       TEXT NOT NULL DEFAULT '{}',
    updated_at   TEXT NOT NULL,
    public       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS thread (
    thread_id    TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    assistant_id TEXT,
    name         TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    metadata     TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id   TEXT NOT NULL,
    run_id      TEXT,
    rating      INTEGER NOT NULL,
    comment     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(thread_id, run_id)
);

CREATE TABLE IF NOT EXISTS knowledge_base_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    assistant_id TEXT,
    user_id      TEXT NOT NULL,
    action       TEXT NOT NULL,
    file_name    TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_token (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL,
    email      TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_token (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL,
    otp        TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_ticket (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_by  TEXT,
    label      TEXT
);

CREATE TABLE IF NOT EXISTS support_message (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ticket_id  TEXT NOT NULL,
    sender_id  TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def _init_sqlite(db_path: str):
    import aiosqlite
    global _sqlite_db
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    _sqlite_db = await aiosqlite.connect(db_path)
    _sqlite_db.row_factory = aiosqlite.Row
    await _sqlite_db.executescript(_SCHEMA)
    await _sqlite_db.commit()
    logger.info("SQLite app database ready at %s", db_path)


# ---------------------------------------------------------------------------
# Government doc ingestion
# ---------------------------------------------------------------------------

async def _ingest_government_docs_if_needed() -> None:
    if not GOVERNMENT_DOCS_DIR or not Path(GOVERNMENT_DOCS_DIR).exists():
        logger.info("GOVERNMENT_DOCS_DIR not set or missing — skipping gov doc ingestion")
        return

    from app.vectorstore import get_vectorstore
    from app.ingest import ingest_directory_to_namespace
    from app.tools import GOVERNMENT_NAMESPACE

    vstore = get_vectorstore()

    # Skip if already indexed
    try:
        existing = vstore.similarity_search("compliance", k=1, filter={"namespace": GOVERNMENT_NAMESPACE})
        if existing:
            logger.info("Government docs already indexed — skipping")
            return
    except Exception as exc:
        logger.warning("Could not check existing vectors (%s) — proceeding with ingestion", exc)

    logger.info("Ingesting government docs from: %s", GOVERNMENT_DOCS_DIR)
    total = await ingest_directory_to_namespace(
        directory=GOVERNMENT_DOCS_DIR,
        namespace=GOVERNMENT_NAMESPACE,
        vectorstore=vstore,
        parser=None,
        text_splitter=None,
    )
    logger.info("Government doc ingestion complete — %d chunks indexed", total)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.render_to_log_kwargs,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # SQLite app DB
    db_url = os.environ.get("APP_DATABASE_URL", "sqlite:///data/app.db")
    db_path = db_url.replace("sqlite:///", "")
    await _init_sqlite(db_path)

    # LangGraph checkpoint (SQLite)
    await setup_checkpointer()

    # Pinecone + government doc ingestion
    await _ingest_government_docs_if_needed()

    yield

    # Cleanup
    if _sqlite_db:
        await _sqlite_db.close()
