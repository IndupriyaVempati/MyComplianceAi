"""API to deal with file uploads via a runnable.

For now this code assumes that the content is a base64 encoded string.

The details here might change in the future.

For the time being, upload and ingestion are coupled
"""

from __future__ import annotations

import mimetypes
import os
from typing import BinaryIO, List, Optional

from fastapi import UploadFile
from langchain_community.vectorstores.pgvector import PGVector
from langchain_core.document_loaders.blob_loaders import Blob
from langchain_core.runnables import (
    ConfigurableField,
    RunnableConfig,
    RunnableSerializable,
)
from langchain_core.vectorstores import VectorStore
from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter, TextSplitter
from pydantic import ConfigDict

from app.ingest import ingest_blob
from app.parsing import MIMETYPE_BASED_PARSER


def _guess_mimetype(file_name: str, file_bytes: bytes) -> str:
    """Guess the mime-type of a file based on its name or bytes."""
    # Extension-based detection first (most reliable for Office formats)
    mime_type, _ = mimetypes.guess_type(file_name)
    if mime_type:
        return mime_type

    # Signature-based detection for common types (fallback when extension is absent/wrong)
    if file_bytes.startswith(b"%PDF"):
        return "application/pdf"
    elif file_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        # Legacy OLE format — could be .doc or .xls
        ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
        if ext == "xls":
            return "application/vnd.ms-excel"
        return "application/msword"
    elif file_bytes.startswith(b"\x09\x00\xff\x00\x06\x00"):
        return "application/vnd.ms-excel"
    # ZIP-based formats (.docx, .xlsx, .pptx) — cannot distinguish by bytes alone,
    # already handled above by mimetypes.guess_type via the file extension.

    # Check for CSV-like plain text content (commas, tabs, newlines)
    try:
        decoded = file_bytes[:1024].decode("utf-8", errors="ignore")
        if all(char in decoded for char in (",", "\n")) or all(
            char in decoded for char in ("\t", "\n")
        ):
            return "text/csv"
        elif decoded.isprintable() or decoded == "":
            return "text/plain"
    except UnicodeDecodeError:
        pass

    return "application/octet-stream"


def convert_ingestion_input_to_blob(file: UploadFile) -> Blob:
    """Convert ingestion input to blob."""
    file_data = file.file.read()
    file_name = file.filename

    # Check if file_name is a valid string
    if not isinstance(file_name, str):
        raise TypeError(f"Expected string for file name, got {type(file_name)}")

    mimetype = _guess_mimetype(file_name, file_data)
    return Blob.from_data(
        data=file_data,
        path=file_name,
        mime_type=mimetype,
    )


def _determine_azure_or_openai_embeddings() -> PGVector:
    if os.environ.get("OPENAI_API_KEY"):
        return PGVector(
            connection_string=PG_CONNECTION_STRING,
            embedding_function=OpenAIEmbeddings(),
            use_jsonb=True,
        )
    if os.environ.get("AZURE_OPENAI_API_KEY"):
        return PGVector(
            connection_string=PG_CONNECTION_STRING,
            embedding_function=AzureOpenAIEmbeddings(
                azure_endpoint=os.environ.get("AZURE_OPENAI_API_BASE"),
                azure_deployment=os.environ.get(
                    "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME"
                ),
                openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION"),
            ),
            use_jsonb=True,
        )
    raise ValueError(
        "Either OPENAI_API_KEY or AZURE_OPENAI_API_KEY needs to be set for embeddings to work."
    )


class IngestRunnable(RunnableSerializable[BinaryIO, List[str]]):
    """Runnable for ingesting files into a vectorstore."""

    text_splitter: TextSplitter
    vectorstore: VectorStore
    assistant_id: Optional[str] = None
    thread_id: Optional[str] = None
    """Ingested documents will be associated with assistant_id or thread_id.
    
    ID is used as the namespace, and is filtered on at query time.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @property
    def namespace(self) -> str:
        if (self.assistant_id is None and self.thread_id is None) or (
            self.assistant_id is not None and self.thread_id is not None
        ):
            raise ValueError(
                "Exactly one of assistant_id or thread_id must be provided"
            )
        return self.assistant_id if self.assistant_id is not None else self.thread_id

    def invoke(self, blob: Blob, config: Optional[RunnableConfig] = None) -> List[str]:
        out = ingest_blob(
            blob,
            MIMETYPE_BASED_PARSER,
            self.text_splitter,
            self.vectorstore,
            self.namespace,
        )
        return out


PG_CONNECTION_STRING = PGVector.connection_string_from_db_params(
    driver="psycopg2",
    host=os.environ.get("POSTGRES_HOST", "localhost"),
    port=int(os.environ.get("POSTGRES_PORT", "5432")),
    database=os.environ.get("POSTGRES_DB", "opengpts"),
    user=os.environ.get("POSTGRES_USER", "postgres"),
    password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
)
vstore = _determine_azure_or_openai_embeddings()


ingest_runnable = IngestRunnable(
    text_splitter=RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200),
    vectorstore=vstore,
).configurable_fields(
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
