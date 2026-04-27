"""Pinecone vector store with local sentence-transformer embeddings.

Uses the synchronous Pinecone client for all operations to avoid the
`RuntimeError: Session is closed` that occurs when the async aiohttp
session inside PineconeVectorStore is reused across requests.

LangChain's retriever calls `ainvoke` which runs the sync query in a
thread-pool executor — this is safe and avoids the session lifecycle issue.
"""
from __future__ import annotations

import os
import time
from functools import lru_cache

import structlog
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Embeddings (local, CPU, no API key)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    model_name = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    logger.info("Loading embedding model: %s", model_name)
    return HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


# ---------------------------------------------------------------------------
# Pinecone sync client + index (singleton)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_pinecone_client() -> Pinecone:
    api_key = os.environ.get("PINECONE_API_KEY", "")
    if not api_key:
        raise ValueError("PINECONE_API_KEY is required")
    return Pinecone(api_key=api_key)


@lru_cache(maxsize=1)
def _ensure_pinecone_index() -> str:
    pc = _get_pinecone_client()
    index_name = os.environ.get("PINECONE_INDEX_NAME", "compliance-ai")
    dimension = int(os.environ.get("EMBEDDING_DIMENSION", "384"))
    cloud = os.environ.get("PINECONE_CLOUD", "aws")
    region = os.environ.get("PINECONE_REGION", "us-east-1")

    existing = {idx.name for idx in pc.list_indexes()}
    if index_name not in existing:
        logger.info("Creating Pinecone index '%s' (dim=%d)", index_name, dimension)
        pc.create_index(
            name=index_name,
            dimension=dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud=cloud, region=region),
        )
        deadline = time.time() + 120
        while time.time() < deadline:
            desc = pc.describe_index(index_name)
            if getattr(desc.status, "ready", False):
                break
            time.sleep(3)
        else:
            raise TimeoutError(f"Pinecone index '{index_name}' not ready in time")
        logger.info("Pinecone index '%s' is ready", index_name)
    else:
        logger.info("Pinecone index '%s' already exists", index_name)

    return index_name


# ---------------------------------------------------------------------------
# VectorStore — built on the SYNC Pinecone index
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_vectorstore() -> PineconeVectorStore:
    """Return a PineconeVectorStore using the sync Pinecone client.

    Passing the pre-built sync index object prevents langchain-pinecone from
    spinning up its own async aiohttp session, which would get closed between
    requests and raise RuntimeError: Session is closed.
    """
    index_name = _ensure_pinecone_index()
    pc = _get_pinecone_client()
    index = pc.Index(index_name)          # sync Index object
    embeddings = get_embeddings()

    return PineconeVectorStore(
        index=index,                       # pass sync index directly
        embedding=embeddings,
        pinecone_api_key=os.environ.get("PINECONE_API_KEY", ""),
    )
