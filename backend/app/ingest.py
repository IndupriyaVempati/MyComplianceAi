"""Code to ingest blob into a vectorstore.

Code is responsible for taking binary data, parsing it and then indexing it
into a vector store.

This code should be agnostic to how the blob got generated; i.e., it does not
know about server/uploading etc.
"""
import asyncio
import structlog
import os
from pathlib import Path
from typing import List

from langchain.text_splitter import TextSplitter
from langchain_community.document_loaders import Blob
from langchain_community.document_loaders.base import BaseBlobParser
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore

logger = structlog.get_logger(__name__)


def _update_document_metadata(document: Document, namespace: str) -> None:
    """Mutation in place that adds a namespace to the document metadata."""
    document.metadata["namespace"] = namespace


def _sanitize_document_content(document: Document) -> Document:
    """Sanitize the document."""
    # Without this, PDF ingestion fails with
    # "A string literal cannot contain NUL (0x00) characters".
    document.page_content = document.page_content.replace("\x00", "x")


# PUBLIC API


def ingest_blob(
    blob: Blob,
    parser: BaseBlobParser,
    text_splitter: TextSplitter,
    vectorstore: VectorStore,
    namespace: str,
    *,
    batch_size: int = 100,
) -> List[str]:
    """Ingest a document into the vectorstore."""
    docs_to_index = []
    ids = []
    for document in parser.lazy_parse(blob):
        docs = text_splitter.split_documents([document])
        for doc in docs:
            _sanitize_document_content(doc)
            _update_document_metadata(doc, namespace)
        docs_to_index.extend(docs)

        if len(docs_to_index) >= batch_size:
            ids.extend(vectorstore.add_documents(docs_to_index))
            docs_to_index = []

    if docs_to_index:
        ids.extend(vectorstore.add_documents(docs_to_index))

    return ids


async def ingest_directory_to_namespace(
    directory: str,
    namespace: str,
    vectorstore: VectorStore,
    parser: BaseBlobParser,
    text_splitter: TextSplitter,
    *,
    extensions: tuple = (".pdf",),
    batch_size: int = 100,
) -> int:
    """Walk *directory* recursively, ingesting every matched file into *namespace*.

    Returns the total number of vector chunks indexed.
    Runs the sync ingestion in a thread executor so the event loop is not blocked.
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
        and "__MACOSX" not in p.parts          # skip macOS zip artifacts
        and not p.name.startswith("._")         # skip macOS resource fork files
    ]
    logger.info("Found %d government document(s) to ingest from %s", len(files), directory)

    loop = asyncio.get_running_loop()

    for file_path in files:
        try:
            file_bytes = file_path.read_bytes()
            blob = Blob.from_data(
                data=file_bytes,
                path=str(file_path),
                mime_type="application/pdf",
            )
            ids = await loop.run_in_executor(
                None,
                lambda b=blob: ingest_blob(
                    b, parser, text_splitter, vectorstore, namespace, batch_size=batch_size
                ),
            )
            total += len(ids)
            logger.info("Ingested %s → %d chunks (namespace=%s)", file_path.name, len(ids), namespace)
        except Exception as exc:
            logger.error("Failed to ingest %s: %s", file_path, exc)

    return total
