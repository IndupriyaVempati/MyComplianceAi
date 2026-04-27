import { useEffect, useRef, useState } from "react";
import { StreamStateProps } from "../hooks/useStreamState";
import { useChatMessages } from "../hooks/useChatMessages";
import TypingBox from "./TypingBox";
import { MessageViewer } from "./Message";
import {
  ArrowDownCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageWithFiles } from "../utils/formTypes.ts";
import { useParams } from "react-router-dom";
import { useThreadAndAssistant } from "../hooks/useThreadAndAssistant.ts";
import { useMessageEditing } from "../hooks/useMessageEditing.ts";
import { useTrialStatus } from "../hooks/useTrialStatus.ts";
import { MessageEditor } from "./MessageEditor.tsx";
import { Message } from "../types.ts";
import { getAuthHeaders } from "../utils/auth.ts";

// Map of run_id -> rating loaded from backend
type FeedbackMap = Record<string, 1 | -1>;


interface ChatProps extends Pick<StreamStateProps, "stream" | "stopStream"> {
  startStream: (
    message: MessageWithFiles | null,
    thread_id: string,
    assistantType: string,
  ) => Promise<void>;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

function CommitEdits(props: {
  editing: Record<string, Message>;
  commitEdits: () => Promise<void>;
}) {
  const [inflight, setInflight] = useState(false);
  return (
    <div className="bg-white text-gray-900 rounded-xl border border-gray-300 flex flex-row h-9 items-center max-w-3xl mx-auto w-full dark:bg-[#2f2f2f] dark:text-[#ececec] dark:border-[#3a3a3a]">
      <div className="flex-1 rounded-l-xl pl-4 text-sm">
        {Object.keys(props.editing).length} message(s) edited.
      </div>
      <button
        onClick={async () => {
          setInflight(true);
          await props.commitEdits();
          setInflight(false);
        }}
        className="self-stretch -ml-px inline-flex items-center gap-x-1.5 rounded-r-xl px-3 text-sm font-semibold border-l border-gray-300 hover:bg-gray-100 transition-colors dark:border-[#3a3a3a] dark:hover:bg-[#3a3a3a]"
      >
        <CheckCircleIcon className="w-4 h-4 text-[#00386B]" />
        {inflight ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

export function Chat(props: ChatProps) {
  const { chatId } = useParams();
  const { messages, next, refreshMessages } = useChatMessages(
    chatId ?? null,
    props.stream,
    props.stopStream,
  );
  const { currentChat, assistantConfig } = useThreadAndAssistant();
  const { isExpired, isLoading: isTrialLoading } = useTrialStatus();
  const { editing, recordEdits, commitEdits, abandonEdits } = useMessageEditing(
    chatId,
    refreshMessages,
  );

  // Load feedback for this thread to restore like/dislike state
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});
  useEffect(() => {
    if (!chatId) return;
    fetch(`/api/feedback?thread_id=${chatId}`, { headers: getAuthHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((items: { run_id?: string; rating: number }[]) => {
        const map: FeedbackMap = {};
        for (const fb of items) {
          if (fb.run_id) map[fb.run_id] = fb.rating as 1 | -1;
        }
        setFeedbackMap(map);
      })
      .catch(() => { });
  }, [chatId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessages = usePrevious(messages);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior:
        prevMessages && prevMessages?.length === messages?.length
          ? "smooth"
          : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);


  if (!currentChat || !assistantConfig)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-[#8e8ea0] text-sm">
        No data.
      </div>
    );

  const isLoadedEmpty =
    messages !== null &&
    messages.length === 0 &&
    props.stream?.status !== "inflight";

  return (
    <div id="chat-container" className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto w-full px-5 py-6">
          {isLoadedEmpty && (
            <div className="min-h-[calc(100vh-260px)] flex items-center justify-center text-sm text-slate-400">
              No messages yet.
            </div>
          )}

          {messages?.map((msg, i) =>
            editing[msg.id] ? (
              <MessageEditor
                key={msg.id}
                message={editing[msg.id]}
                onUpdate={recordEdits}
                abandonEdits={() => abandonEdits(msg)}
              />
            ) : (
              <MessageViewer
                {...msg}
                key={msg.id}
                threadId={chatId}
                runId={
                  i === messages.length - 1 && props.stream?.status === "done"
                    ? props.stream?.run_id
                    : undefined
                }
                initialRating={feedbackMap[msg.id] ?? null}
                startEditing={() => recordEdits(msg)}
                alwaysShowControls={i === messages.length - 1}
                noResponse={
                  msg.type === "human" &&
                  (() => {
                    const nextVisible = messages.slice(i + 1).find((m) => {
                      if (m.type === "human") return true;
                      if (["tool", "function"].includes(m.type)) return false;
                      const raw = typeof m.content === "string" ? m.content.trim() : null;
                      const hasContent = raw !== null ? raw.length > 0 : (Array.isArray(m.content) ? m.content.length > 0 : !!m.content);
                      return hasContent;
                    });
                    if (nextVisible) {
                      return nextVisible.type === "human";
                    }
                    return props.stream?.status !== "inflight";
                  })()
                }
              />
            ),
          )}

          {/* Streaming indicator */}
          {(props.stream?.status === "inflight" || messages === null) && (
            <div className="flex gap-3 mb-6">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#CFECFB', color: '#00386B' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#00386B' }}>
                  <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
                  <path d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z" opacity="0.7" />
                  <path d="M5 3L5.5 4.5L7 5L5.5 5.5L5 7L4.5 5.5L3 5L4.5 4.5L5 3Z" opacity="0.7" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: '#2B93D1' }} />
                <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: '#2B93D1' }} />
                <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#2B93D1' }} />
              </div>
            </div>
          )}

          {/* Error */}
          {props.stream?.status === "error" && (
            <div className="flex items-center gap-2 rounded-xl bg-red-900/20 border border-red-800/30 px-3 py-2 text-sm text-red-400 mb-4">
              <XCircleIcon className="h-4 w-4 shrink-0" />
              An error occurred. Please try again.
            </div>
          )}

          {/* Continue button */}
          {next.length > 0 &&
            props.stream?.status !== "inflight" &&
            Object.keys(editing).length === 0 && (
              <button
                className="flex items-center gap-2 rounded-xl bg-gray-100 border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 mb-4 transition-colors dark:bg-[#2f2f2f] dark:border-[#3a3a3a] dark:text-[#c5c5d2] dark:hover:bg-[#3a3a3a]"
                onClick={() =>
                  props.startStream(
                    null,
                    currentChat.thread_id,
                    assistantConfig.config.configurable?.type as string,
                  )
                }
              >
                <ArrowDownCircleIcon className="h-4 w-4" />
                Click to continue
              </button>
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed input bar at bottom */}
      <div className="shrink-0 w-full max-w-[720px] mx-auto px-4 pb-4 pt-2">
        {assistantConfig.config.deleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-[#8e8ea0]">
            This knowledge base is deleted by admin.
          </div>
        ) : commitEdits && Object.keys(editing).length > 0 ? (
          <CommitEdits editing={editing} commitEdits={commitEdits} />
        ) : (
          <TypingBox
            onSubmit={(msg) =>
              props.startStream(
                msg,
                currentChat.thread_id,
                assistantConfig.config.configurable?.type as string,
              )
            }
            onInterrupt={
              props.stream?.status === "inflight" ? props.stopStream : undefined
            }
            inflight={props.stream?.status === "inflight"}
            isDisabled={isExpired && !isTrialLoading}
            currentConfig={assistantConfig}
            currentChat={currentChat}
          />
        )}
      </div>
    </div>
  );
}
