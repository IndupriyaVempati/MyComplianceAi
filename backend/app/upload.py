"""File upload and ingestion pipeline using Pinecone + local embeddings."""
from __future__ import annotations

import mimetypes
import os
import tempfile
from pathlib import Path
from typing import BinaryIO, List, Optional

from fastapi import UploadFile
from langchain_core.runnables import (
    ConfigurableField,
    RunnableConfig,
    RunnableSerializable,
)
from pydantic import ConfigDict

from app.ingest import ingest_blob_to_pinecone
from app.parsing import parse_file, parse_url, llama_docs_to_langchain, split_documents
from app.vectorstore import get_vectorstore


# ---------------------------------------------------------------------------
# MIME detection
# ---------------------------------------------------------------------------

def _guess_mimetype(file_name: str, file_bytes: bytes) -> str:
    mime_type, _ = mimetypes.guess_type(file_name)
    if mime_type:
        return mime_type
    if file_bytes.startswith(b"%PDF"):
        return "application/pdf"
    elif file_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
        return "application/vnd.ms-excel" if ext == "xls" else "application/msword"
    try:
        decoded = file_bytes[:1024].decode("utf-8", errors="ignore")
        if all(c in decoded for c in (",", "\n")) or all(c in decoded for c in ("\t", "\n")):
            return "text/csv"
        elif decoded.isprintable() or decoded == "":
            return "text/plain"
    except UnicodeDecodeError:
        pass
    return "application/octet-stream"


def convert_ingestion_input_to_blob(file: UploadFile) -> dict:
    """Read an UploadFile and return a dict with data, name, and mimetype."""
    file_data = file.file.read()
    file_name = file.filename
    if not isinstance(file_name, str):
        raise TypeError(f"Expected string for file name, got {type(file_name)}")
    mimetype = _guess_mimetype(file_name, file_data)
    return {"data": file_data, "name": file_name, "mimetype": mimetype}


# ---------------------------------------------------------------------------
# IngestRunnable
# ---------------------------------------------------------------------------

class IngestRunnable(RunnableSerializable[dict, List[str]]):
    """Runnable for ingesting files into Pinecone."""

    assistant_id: Optional[str] = None
    thread_id: Optional[str] = None

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @property
    def namespace(self) -> str:
        """Resolve the Pinecone namespace for this upload.

        Per-chat KB: thread_id is the primary namespace so every chat
        has its own isolated KB. assistant_id is used only when no
        thread_id is set (e.g. bulk admin uploads at assistant level).
        """
        if self.thread_id:
            return self.thread_id
        if self.assistant_id:
            return self.assistant_id
        raise ValueError("Either thread_id or assistant_id must be provided")

    def invoke(self, blob: dict, config: Optional[RunnableConfig] = None) -> List[str]:
        return ingest_blob_to_pinecone(
            file_data=blob["data"],
            file_name=blob["name"],
            namespace=self.namespace,
        )


# ---------------------------------------------------------------------------
# Singleton vectorstore (Pinecone-backed, used by tools.py retriever)
# ---------------------------------------------------------------------------
vstore = get_vectorstore()

ingest_runnable = IngestRunnable().configurable_fields(
    assistant_id=ConfigurableField(
        id="assistant_id",
        annotation=Optional[str],
        name="Assistant ID",
    ),
    thread_id=ConfigurableField(
        id="thread_id",
        annotation=Optional[str],
        name="Thread ID",
    ),
)
