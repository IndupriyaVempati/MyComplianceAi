"""Document parsing using LlamaIndex SimpleDirectoryReader + optional LlamaParse."""
import os
from pathlib import Path
from typing import Iterator

import httpx
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from llama_index.core import SimpleDirectoryReader
from llama_index.core import Document as LlamaDocument
from llama_index.core.node_parser import SentenceSplitter


# ---------------------------------------------------------------------------
# Splitter config (mirrors rag-saas defaults)
# ---------------------------------------------------------------------------
CHUNK_SIZE = 650
CHUNK_OVERLAP = 80

_splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)


# ---------------------------------------------------------------------------
# LlamaParse (optional)
# ---------------------------------------------------------------------------

def _parse_with_llamaparse(path: Path) -> list[LlamaDocument]:
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    if not api_key:
        raise ValueError("LLAMA_CLOUD_API_KEY is required when USE_LLAMA_PARSE=true")
    from llama_parse import LlamaParse
    parser = LlamaParse(api_key=api_key, result_type="markdown")
    return parser.load_data(str(path))


# ---------------------------------------------------------------------------
# Core parse helpers
# ---------------------------------------------------------------------------

def parse_file(path: Path) -> list[LlamaDocument]:
    """Parse a file using LlamaParse (if enabled) or SimpleDirectoryReader."""
    use_llama = os.environ.get("USE_LLAMA_PARSE", "false").lower() == "true"
    if use_llama:
        return _parse_with_llamaparse(path)
    reader = SimpleDirectoryReader(input_files=[str(path)])
    return reader.load_data()


def parse_url(url: str) -> list[LlamaDocument]:
    """Fetch a URL and return a single LlamaDocument."""
    response = httpx.get(url, follow_redirects=True, timeout=30.0)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = "\n".join(line.strip() for line in soup.get_text(separator="\n").splitlines() if line.strip())
    return [LlamaDocument(text=text, metadata={"source": url})]


def llama_docs_to_langchain(llama_docs: list[LlamaDocument], source: str = "") -> list[Document]:
    """Convert LlamaIndex Documents → LangChain Documents with page metadata."""
    lc_docs = []
    for i, doc in enumerate(llama_docs):
        meta = dict(doc.metadata or {})
        meta.setdefault("source", source or meta.get("file_name", "unknown"))
        meta.setdefault("page", str(i + 1))
        lc_docs.append(Document(page_content=doc.text or "", metadata=meta))
    return lc_docs


def split_documents(lc_docs: list[Document]) -> list[Document]:
    """Chunk LangChain Documents using the LlamaIndex SentenceSplitter."""
    llama_docs = [
        LlamaDocument(text=d.page_content, metadata=d.metadata)
        for d in lc_docs
    ]
    nodes = _splitter.get_nodes_from_documents(llama_docs)
    chunks = []
    for node in nodes:
        content = node.get_content(metadata_mode="none").strip()
        if content:
            chunks.append(Document(page_content=content, metadata=dict(node.metadata or {})))
    return chunks


# ---------------------------------------------------------------------------
# Supported MIME types (kept for compatibility with upload.py)
# ---------------------------------------------------------------------------
SUPPORTED_MIMETYPES = [
    "application/pdf",
    "text/plain",
    "text/html",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
