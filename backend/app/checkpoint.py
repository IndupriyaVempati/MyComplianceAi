"""SQLite-backed LangGraph checkpoint store.

AsyncSqliteSaver requires an open aiosqlite connection for its lifetime,
so we manage it as a long-lived singleton opened during app startup.

At import time (before startup) we use InMemorySaver as a placeholder so
agent.py can build its graph. The lifespan replaces it with the real saver.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, AsyncIterator, Optional, Sequence

import aiosqlite
import structlog
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    RunnableConfig,
)
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langchain_core.load.load import Reviver

logger = structlog.get_logger(__name__)

_DEFAULT_DB = str(Path(__file__).parent.parent / "data" / "checkpoints.db")


def _db_path() -> str:
    return os.environ.get("CHECKPOINT_DB_PATH", _DEFAULT_DB)


class _AppCheckpointSerializer(JsonPlusSerializer):
    """JsonPlus serializer that can read this app's legacy message subclasses."""

    _reviver_allowlist = Reviver(
        allowed_objects="core",
        valid_namespaces=["app"],
        additional_import_mappings={
            ("langchain", "schema", "messages", "LiberalToolMessage"): (
                "app",
                "message_types",
                "LiberalToolMessage",
            ),
            ("langchain", "schema", "messages", "LiberalFunctionMessage"): (
                "app",
                "message_types",
                "LiberalFunctionMessage",
            ),
        },
    )

    def _reviver(self, value: dict[str, Any]) -> Any:
        if value.get("lc") == 1 and value.get("type") == "constructor":
            return self._reviver_allowlist(value)
        return super()._reviver(value)


# ---------------------------------------------------------------------------
# Singleton wrapper — delegates to the real saver once startup completes
# ---------------------------------------------------------------------------

class _DelegatingSaver(BaseCheckpointSaver):
    """Wraps either MemorySaver (pre-startup) or AsyncSqliteSaver (post-startup).

    This lets agent.py build its LangGraph at import time while still getting
    persistent SQLite storage once the app has started.
    """

    def __init__(self):
        super().__init__(serde=_AppCheckpointSerializer())
        self._inner: BaseCheckpointSaver = MemorySaver(serde=self.serde)
        self._conn: aiosqlite.Connection | None = None

    async def upgrade(self) -> None:
        """Switch from MemorySaver to AsyncSqliteSaver. Called by lifespan."""
        db = Path(_db_path())
        db.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(str(db))
        saver = AsyncSqliteSaver(self._conn, serde=self.serde)
        saver.jsonplus_serde = self.serde
        await saver.setup()
        self._inner = saver
        logger.info("SQLite checkpoint store ready at %s", db)

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()

    # ── BaseCheckpointSaver interface ────────────────────────────────────────

    def get(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        return self._inner.get(config)

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        return self._inner.get_tuple(config)

    def list(self, config, *, filter=None, before=None, limit=None):
        return self._inner.list(config, filter=filter, before=before, limit=limit)

    def put(self, config, checkpoint, metadata, new_versions):
        return self._inner.put(config, checkpoint, metadata, new_versions)

    def put_writes(self, config, writes, task_id):
        return self._inner.put_writes(config, writes, task_id)

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        return await self._inner.aget_tuple(config)

    async def alist(self, config, *, filter=None, before=None, limit=None) -> AsyncIterator[CheckpointTuple]:
        async for item in self._inner.alist(config, filter=filter, before=before, limit=limit):
            yield item

    async def aput(self, config, checkpoint, metadata, new_versions) -> RunnableConfig:
        return await self._inner.aput(config, checkpoint, metadata, new_versions)

    async def aput_writes(self, config, writes, task_id) -> None:
        await self._inner.aput_writes(config, writes, task_id)


# Module-level singleton — used by agent.py at import time
_CHECKPOINTER = _DelegatingSaver()


def get_checkpointer() -> _DelegatingSaver:
    return _CHECKPOINTER


async def setup_checkpointer() -> _DelegatingSaver:
    """Upgrade to SQLite. Call once from lifespan startup."""
    await _CHECKPOINTER.upgrade()
    return _CHECKPOINTER


# Backwards-compat: agent.py does  CHECKPOINTER = AsyncPostgresCheckpoint()
AsyncPostgresCheckpoint = lambda: _CHECKPOINTER  # noqa: E731
