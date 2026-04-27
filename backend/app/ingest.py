"""Ingestion pipeline: parse → chunk → embed → upsert to Pinecone."""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import List

import structlog

from app.parsing import parse_file, parse_url, llama_docs_to_langchain, split_documents

logger = structlog.get_logger(__name__)


def _sanitize(text: str) -> str:
    return text.replace("\x00", "x")


def ingest_blob_to_pinecone(
    file_data: bytes,
    file_name: str,
    namespace: str,
) -> List[str]:
    """Parse raw file bytes, chunk, embed, and upsert into Pinecone.

    Returns a list of Pinecone vector IDs.
    """
    from app.vectorstore import get_vectorstore

    # Write bytes to a temp file so LlamaIndex can read it
    suffix = Path(file_name).suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_data)
        tmp_path = Path(tmp.name)

    try:
        llama_docs = parse_file(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    lc_docs = llama_docs_to_langchain(llama_docs, source=file_name)
    chunks = split_documents(lc_docs)

    if not chunks:
        logger.warning("No chunks extracted from %s", file_name)
        return []

    # Attach namespace metadata to every chunk
    for doc in chunks:
        doc.page_content = _sanitize(doc.page_content)
        doc.metadata["namespace"] = namespace
        doc.metadata.setdefault("source", file_name)

    vstore = get_vectorstore()
    ids = vstore.add_documents(chunks)
    logger.info("Ingested %s → %d chunks (namespace=%s)", file_name, len(ids), namespace)
    return ids


async def ingest_directory_to_namespace(
    directory: str,
    namespace: str,
    vectorstore,          # kept for API compatibility with lifespan.py
    parser,               # kept for API compatibility (unused — we use parse_file)
    text_splitter,        # kept for API compatibility (unused — we use split_documents)
    *,
    extensions: tuple = (".pdf",),
    batch_size: int = 100,
) -> int:
    """Walk *directory* and ingest every matched file into *namespace*.

    Returns total chunks indexed.
    """
    total = 0
    path = Path(directory)
    if not path.exists():
        logger.warning("Government docs directory not found: %s", directory)
        return 0

    files = [
        p for p in path.rglob("*")
        if p.suffix.lower() in extensions
        and p.is_file()
        and "__MACOSX" not in p.parts
        and not p.name.startswith("._")
    ]
    logger.info("Found %d government document(s) to ingest from %s", len(files), directory)

    loop = asyncio.get_running_loop()
    for file_path in files:
        try:
            file_bytes = file_path.read_bytes()
            ids = await loop.run_in_executor(
                None,
                lambda b=file_bytes, n=file_path.name: ingest_blob_to_pinecone(b, n, namespace),
            )
            total += len(ids)
            logger.info("Ingested %s → %d chunks (namespace=%s)", file_path.name, len(ids), namespace)
        except Exception as exc:
            logger.error("Failed to ingest %s: %s", file_path, exc)

    return total
