import os
from functools import lru_cache

import structlog
from langchain_openai import ChatOpenAI

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=4)
def get_local_llm(model: str = None):
    """Connect to a self-hosted model via OpenAI-compatible API (Ollama / vLLM / TGI).

    Works with any model pulled into Ollama or served via vLLM on AWS.
    """
    base_url = os.environ.get("AWS_LLM_URL", "http://host.docker.internal:11434/v1")
    api_key = os.environ.get("AWS_LLM_KEY", "empty")
    model_name = model or os.environ.get("AWS_LLM_MODEL", "qwen3:14b")

    llm = ChatOpenAI(
        model=model_name,
        temperature=0,
        base_url=base_url,
        api_key=api_key,
    )
    return llm
