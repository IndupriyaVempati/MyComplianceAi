from enum import Enum
from typing import Any, Dict, Mapping, Optional, Sequence, Union

from langchain_core.messages import AnyMessage
from langchain_core.runnables import ConfigurableField, RunnableBinding
from langgraph.graph.message import Messages
from langgraph.pregel import Pregel

from app.agent_types.tools_agent import get_tools_agent_executor
from app.agent_types.xml_agent import get_xml_agent_executor
from app.chatbot import get_chatbot_executor
from app.checkpoint import AsyncPostgresCheckpoint
from app.llms import get_local_llm, get_gemma_llm, get_qwen_llm, get_glm_llm
from app.retrieval import get_retrieval_executor, get_dual_retrieval_executor
from app.tools import (
    RETRIEVAL_DESCRIPTION,
    TOOLS,
    ActionServer,
    Arxiv,
    AvailableTools,
    Connery,
    DallE,
    DDGSearch,
    PressReleases,
    PubMed,
    Retrieval,
    SecFilings,
    Tavily,
    TavilyAnswer,
    Wikipedia,
    YouSearch,
    get_retrieval_tool,
    get_retriever,
    get_government_retriever,
)

Tool = Union[
    ActionServer, Connery, DDGSearch, Arxiv, YouSearch, SecFilings,
    PressReleases, PubMed, Wikipedia, Tavily, TavilyAnswer, Retrieval, DallE,
]


class AgentType(str, Enum):
    QWEN   = "Qwen 3 (Local)"
    GEMMA  = "Gemma 3 (Local)"
    GLM    = "GLM 4 (Local)"


class LLMType(str, Enum):
    QWEN   = "Qwen 3 (Local)"
    GEMMA  = "Gemma 3 (Local)"
    GLM    = "GLM 4 (Local)"


DEFAULT_SYSTEM_MESSAGE = "You are a helpful assistant."
CHECKPOINTER = AsyncPostgresCheckpoint()


def _llm_for_agent(agent: AgentType):
    if agent == AgentType.GEMMA:
        return get_gemma_llm()
    if agent == AgentType.GLM:
        return get_glm_llm()
    return get_qwen_llm()   # default


def _llm_for_type(llm_type: LLMType):
    if llm_type == LLMType.GEMMA:
        return get_gemma_llm()
    if llm_type == LLMType.GLM:
        return get_glm_llm()
    return get_qwen_llm()   # default


def get_agent_executor(tools, agent: AgentType, system_message, interrupt_before_action):
    llm = _llm_for_agent(agent)
    return get_tools_agent_executor(tools, llm, system_message, interrupt_before_action, CHECKPOINTER)


# ── ConfigurableAgent ────────────────────────────────────────────────────────

class ConfigurableAgent(RunnableBinding):
    tools: Sequence[Tool]
    agent: AgentType
    system_message: str = DEFAULT_SYSTEM_MESSAGE
    retrieval_description: str = RETRIEVAL_DESCRIPTION
    interrupt_before_action: bool = False
    assistant_id: Optional[str] = None
    thread_id: Optional[str] = ""
    user_id: Optional[str] = None

    def __init__(self, *, tools, agent=AgentType.QWEN, system_message=DEFAULT_SYSTEM_MESSAGE,
                 assistant_id=None, thread_id="", retrieval_description=RETRIEVAL_DESCRIPTION,
                 interrupt_before_action=False, kwargs=None, config=None, **others):
        others.pop("bound", None)
        _tools = []
        for _tool in tools:
            if _tool["type"] == AvailableTools.RETRIEVAL:
                if assistant_id is None or thread_id is None:
                    raise ValueError("Both assistant_id and thread_id must be provided if Retrieval tool is used")
                _tools.append(get_retrieval_tool(assistant_id, thread_id, retrieval_description))
            else:
                tool_config = _tool.get("config", {})
                _returned_tools = TOOLS[_tool["type"]](**tool_config)
                if isinstance(_returned_tools, list):
                    _tools.extend(_returned_tools)
                else:
                    _tools.append(_returned_tools)
        _agent = get_agent_executor(_tools, agent, system_message, interrupt_before_action)
        super().__init__(
            tools=tools, agent=agent, system_message=system_message,
            retrieval_description=retrieval_description,
            bound=_agent.with_config({"recursion_limit": 50}),
            kwargs=kwargs or {}, config=config or {},
        )


# ── ConfigurableChatBot ──────────────────────────────────────────────────────

def get_chatbot(llm_type: LLMType, system_message: str):
    return get_chatbot_executor(_llm_for_type(llm_type), system_message, CHECKPOINTER)


class ConfigurableChatBot(RunnableBinding):
    llm: LLMType
    system_message: str = DEFAULT_SYSTEM_MESSAGE
    user_id: Optional[str] = None

    def __init__(self, *, llm=LLMType.QWEN, system_message=DEFAULT_SYSTEM_MESSAGE,
                 kwargs=None, config=None, **others):
        others.pop("bound", None)
        super().__init__(
            llm=llm, system_message=system_message,
            bound=get_chatbot(llm, system_message),
            kwargs=kwargs or {}, config=config or {},
        )


chatbot = (
    ConfigurableChatBot(llm=LLMType.QWEN)
    .configurable_fields(
        llm=ConfigurableField(id="llm_type", name="LLM Type"),
        system_message=ConfigurableField(id="system_message", name="Instructions"),
    )
    .with_types(input_type=Messages, output_type=Sequence[AnyMessage])
)


# ── ConfigurableRetrieval ────────────────────────────────────────────────────

class ConfigurableRetrieval(RunnableBinding):
    llm_type: LLMType
    system_message: str = DEFAULT_SYSTEM_MESSAGE
    assistant_id: Optional[str] = None
    thread_id: Optional[str] = ""
    user_id: Optional[str] = None

    def __init__(self, *, llm_type=LLMType.QWEN, system_message=DEFAULT_SYSTEM_MESSAGE,
                 assistant_id=None, thread_id="", kwargs=None, config=None, **others):
        others.pop("bound", None)
        gov_retriever = get_government_retriever()
        company_retriever = get_retriever(assistant_id, thread_id)
        llm = _llm_for_type(llm_type)
        super().__init__(
            llm_type=llm_type, system_message=system_message,
            bound=get_dual_retrieval_executor(llm, gov_retriever, company_retriever, system_message, CHECKPOINTER),
            kwargs=kwargs or {}, config=config or {},
        )


chat_retrieval = (
    ConfigurableRetrieval(llm_type=LLMType.QWEN)
    .configurable_fields(
        llm_type=ConfigurableField(id="llm_type", name="LLM Type"),
        system_message=ConfigurableField(id="system_message", name="Instructions"),
        assistant_id=ConfigurableField(id="assistant_id", name="Assistant ID", is_shared=True),
        thread_id=ConfigurableField(id="thread_id", name="Thread ID", annotation=str, is_shared=True),
    )
    .with_types(input_type=Dict[str, Any], output_type=Dict[str, Any])
)


# ── Main agent ───────────────────────────────────────────────────────────────

agent: Pregel = (
    ConfigurableAgent(agent=AgentType.QWEN, tools=[], system_message=DEFAULT_SYSTEM_MESSAGE,
                      retrieval_description=RETRIEVAL_DESCRIPTION, assistant_id=None, thread_id="")
    .configurable_fields(
        agent=ConfigurableField(id="agent_type", name="Agent Type"),
        system_message=ConfigurableField(id="system_message", name="Instructions"),
        interrupt_before_action=ConfigurableField(
            id="interrupt_before_action", name="Tool Confirmation",
            description="If Yes, you'll be prompted to continue before each tool is executed.\nIf No, tools will be executed automatically by the agent.",
        ),
        assistant_id=ConfigurableField(id="assistant_id", name="Assistant ID", is_shared=True),
        thread_id=ConfigurableField(id="thread_id", name="Thread ID", annotation=str, is_shared=True),
        tools=ConfigurableField(id="tools", name="Tools"),
        retrieval_description=ConfigurableField(id="retrieval_description", name="Retrieval Description"),
    )
    .configurable_alternatives(
        ConfigurableField(id="type", name="Bot Type"),
        default_key="agent",
        prefix_keys=True,
        chatbot=chatbot,
        chat_retrieval=chat_retrieval,
    )
    .with_types(input_type=Messages, output_type=Sequence[AnyMessage])
)
