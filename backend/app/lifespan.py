import os
from contextlib import asynccontextmanager

import asyncpg
import orjson
import structlog
from fastapi import FastAPI

from app.checkpoint import AsyncPostgresCheckpoint

_pg_pool = None

logger = structlog.get_logger(__name__)

# Path to the fixed government documents shipped with the system.
GOVERNMENT_DOCS_DIR = os.environ.get(
    "GOVERNMENT_DOCS_DIR",
    "/govt_docs",
)


def get_pg_pool() -> asyncpg.pool.Pool:
    return _pg_pool


async def _init_connection(conn) -> None:
    await conn.set_type_codec(
        "json",
        encoder=lambda v: orjson.dumps(v).decode(),
        decoder=orjson.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "jsonb",
        encoder=lambda v: orjson.dumps(v).decode(),
        decoder=orjson.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "uuid", encoder=lambda v: str(v), decoder=lambda v: v, schema="pg_catalog"
    )


async def _ingest_government_docs_if_needed() -> None:
    """Ingest fixed government documents into the '__government__' namespace.

    Uses a Postgres advisory lock so only one gunicorn worker performs ingestion
    when multiple workers start simultaneously. Skips if vectors already exist
    (idempotent across restarts).
    """
    from app.tools import GOVERNMENT_NAMESPACE
    from app.upload import get_vectorstore
    from app.ingest import ingest_directory_to_namespace
    from app.parsing import MIMETYPE_BASED_PARSER
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    ADVISORY_LOCK_KEY = 8675309  # arbitrary unique int for this lock

    vstore = get_vectorstore()

    async with get_pg_pool().acquire() as conn:
        acquired = await conn.fetchval(
            "SELECT pg_try_advisory_lock($1)", ADVISORY_LOCK_KEY
        )
        if not acquired:
            logger.info("Another worker is handling government doc ingestion. Skipping.")
            return

        try:
            # Guard: skip if already indexed
            try:
                existing = vstore.similarity_search(
                    "compliance",
                    k=1,
                    filter={"namespace": {"$in": [GOVERNMENT_NAMESPACE]}},
                )
                if existing:
                    logger.info(
                        "Government docs already indexed (%d result(s) found). Skipping.",
                        len(existing),
                    )
                    return
            except Exception as exc:
                logger.warning(
                    "Could not check existing government vectors (%s). Proceeding.", exc
                )

            logger.info("Starting government document ingestion from: %s", GOVERNMENT_DOCS_DIR)
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

            total = await ingest_directory_to_namespace(
                directory=GOVERNMENT_DOCS_DIR,
                namespace=GOVERNMENT_NAMESPACE,
                vectorstore=vstore,
                parser=MIMETYPE_BASED_PARSER,
                text_splitter=text_splitter,
            )
            logger.info(
                "Government document ingestion complete. Total chunks indexed: %d", total
            )
        finally:
            await conn.fetchval("SELECT pg_advisory_unlock($1)", ADVISORY_LOCK_KEY)


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

    global _pg_pool

    _pg_pool = await asyncpg.create_pool(
        database=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.environ["POSTGRES_HOST"],
        port=os.environ["POSTGRES_PORT"],
        init=_init_connection,
    )
    await AsyncPostgresCheckpoint().ensure_setup()

    # Run ingestion with a Postgres advisory lock — only one worker ingests,
    # others return immediately. Health check passes because workers that skip
    # finish startup right away.
    await _ingest_government_docs_if_needed()

    yield
    await _pg_pool.close()
    _pg_pool = None
