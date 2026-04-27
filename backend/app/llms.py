"""LLM factory — uses Ollama's OpenAI-compatible API so tool-calling works properly."""
import os
from functools import lru_cache

import structlog
from langchain_openai import ChatOpenAI

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=8)
def get_local_llm(model: str = None) -> ChatOpenAI:
    """Return a ChatOpenAI client pointed at the local Ollama instance.

    Env vars:
      OLLAMA_BASE_URL  – base URL of Ollama (default: http://localhost:11434)
      OLLAMA_MODEL     – default model key (default: qwen3:8b)

    Individual model overrides:
      GEMMA_MODEL, QWEN_MODEL, GLM_MODEL
    """
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    # Ollama's OpenAI-compatible endpoint lives at /v1
    if not base_url.endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"

    model_name = model or os.environ.get("OLLAMA_MODEL", "qwen3:8b")
    logger.info("Loading local LLM: %s via %s", model_name, base_url)

    return ChatOpenAI(
        model=model_name,
        temperature=0,
        base_url=base_url,
        api_key="ollama",          # Ollama ignores the key but langchain requires one
    )


# Convenience helpers for each named model
def get_gemma_llm() -> ChatOpenAI:
    return get_local_llm(os.environ.get("GEMMA_MODEL", "gemma3:4b"))

def get_qwen_llm() -> ChatOpenAI:
    return get_local_llm(os.environ.get("QWEN_MODEL", "qwen3:8b"))

def get_glm_llm() -> ChatOpenAI:
    return get_local_llm(os.environ.get("GLM_MODEL", "glm4:9b"))


# ── Legacy stubs kept so any remaining imports don't break ──────────────────
def get_openai_llm(model: str = "gpt-3.5-turbo", azure: bool = False):
    return get_local_llm()

def get_anthropic_llm(bedrock: bool = False):
    return get_local_llm()

def get_google_llm():
    return get_local_llm()

def get_mixtral_fireworks():
    return get_local_llm()

def get_ollama_llm(model_key: str = "default"):
    model_map = {
        "default": os.environ.get("OLLAMA_MODEL", "qwen3:8b"),
        "gemma":   os.environ.get("GEMMA_MODEL", "gemma3:4b"),
        "qwen":    os.environ.get("QWEN_MODEL", "qwen3:8b"),
        "glm":     os.environ.get("GLM_MODEL", "glm4:9b"),
    }
    return get_local_llm(model_map.get(model_key, os.environ.get("OLLAMA_MODEL", "qwen3:8b")))
