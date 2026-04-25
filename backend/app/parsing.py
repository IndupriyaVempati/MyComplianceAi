"""Module contains logic for parsing binary blobs into text."""
from langchain_community.document_loaders.parsers import BS4HTMLParser, PDFMinerParser, PyMuPDFParser
from langchain_community.document_loaders.parsers.generic import MimeTypeBasedParser
from langchain_community.document_loaders.parsers.msword import MsWordParser
from langchain_community.document_loaders.parsers.txt import TextParser
from langchain_core.documents import Document
from typing import Iterator

class CombinedPDFParser(PDFMinerParser):
    def __init__(self):
        super().__init__(concatenate_pages=False)
        self.pymupdf = PyMuPDFParser()

    def lazy_parse(self, blob) -> Iterator[Document]:
        # Both parsers run lazy_parse per page when concatenate_pages=False
        try:
            mupdf_docs = list(self.pymupdf.lazy_parse(blob))
        except Exception:
            mupdf_docs = []
            
        miner_docs = super().lazy_parse(blob)
        
        for i, doc in enumerate(miner_docs):
            if i < len(mupdf_docs) and "page" in mupdf_docs[i].metadata:
                 doc.metadata["page"] = str(mupdf_docs[i].metadata["page"] + 1)
            else:
                 doc.metadata["page"] = str(i + 1)
            yield doc


HANDLERS = {
    "application/pdf": CombinedPDFParser(),
    "text/plain": TextParser(),
    "text/html": BS4HTMLParser(),
    "application/msword": MsWordParser(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        MsWordParser()
    ),
}

SUPPORTED_MIMETYPES = sorted(HANDLERS.keys())

# PUBLIC API

MIMETYPE_BASED_PARSER = MimeTypeBasedParser(
    handlers=HANDLERS,
    fallback_parser=None,
)
