import { memo, useState, useCallback } from "react";
import { MessageDocument, Message as MessageType } from "../types";
import { str } from "../utils/str";
import { cn } from "../utils/cn";
import { SparklesIcon, HandThumbUpIcon, HandThumbDownIcon, BookOpenIcon, ClipboardIcon, ShareIcon, DocumentTextIcon, StopCircleIcon } from "@heroicons/react/24/outline";
import { HandThumbUpIcon as ThumbUpSolid, HandThumbDownIcon as ThumbDownSolid } from "@heroicons/react/24/solid";
import { DocumentList } from "./Document";
import { omit } from "lodash";
import { StringViewer } from "./String";
import { getAuthHeaders } from "../utils/auth";

function isDocumentContent(
  content: MessageType["content"],
): content is MessageDocument[] {
  return (
    Array.isArray(content) &&
    content.every((d) => typeof d === "object" && !!d && !!d.page_content)
  );
}

export function MessageContent(props: { content: MessageType["content"]; className?: string }) {
  if (typeof props.content === "string") {
    if (!props.content.trim()) {
      return null;
    }
    return <StringViewer value={props.content} markdown className={props.className} />;
  } else if (isDocumentContent(props.content)) {
    return <DocumentList documents={props.content} />;
  } else if (
    Array.isArray(props.content) &&
    props.content.every(
      (it) => typeof it === "object" && !!it && typeof it.content === "string",
    )
  ) {
    return (
      <DocumentList
        markdown
        documents={props.content.map((it) => ({
          page_content: it.content,
          metadata: omit(it, "content"),
        }))}
      />
    );
  } else {
    let content = props.content;
    if (Array.isArray(content)) {
      content = content.filter((it) =>
        typeof it === "object" && !!it && "type" in it
          ? it.type !== "tool_use"
          : true,
      );
    }
    if (
      Array.isArray(content)
        ? content.length === 0
        : Object.keys(content).length === 0
    ) {
      return null;
    }
    return <div className={cn("prose max-w-none", props.className)}>{str(content)}</div>;
  }
}

function FeedbackButtons(props: { threadId: string; runId?: string; initialRating?: 1 | -1 | null }) {
  const [rating, setRating] = useState<1 | -1 | null>(props.initialRating ?? null);
  const [saving, setSaving] = useState(false);

  const sendFeedback = useCallback(async (value: 1 | -1) => {
    if (saving) return;
    const next = rating === value ? null : value; // toggle off if same
    setRating(next);
    if (next === null) return;
    setSaving(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          thread_id: props.threadId,
          run_id: props.runId ?? null,
          rating: next,
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [rating, saving, props.threadId, props.runId]);

  const iconClasses = "h-[15px] w-[15px]";
  const buttonClasses = (active: boolean) => cn(
    "p-1.5 rounded-md transition-all text-[#94A3B8] hover:text-[#2B93D1]",
    active ? "text-[#2B93D1]" : "bg-transparent",
    "duration-150 ease-in-out"
  );

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => sendFeedback(1)}
        title="Good response"
        className={buttonClasses(rating === 1)}
      >
        {rating === 1 ? <ThumbUpSolid className={iconClasses} /> : <HandThumbUpIcon className={iconClasses} />}
      </button>
      <button
        onClick={() => sendFeedback(-1)}
        title="Bad response"
        className={buttonClasses(rating === -1)}
      >
        {rating === -1 ? <ThumbDownSolid className={iconClasses} /> : <HandThumbDownIcon className={iconClasses} />}
      </button>
    </div>
  );
}

export const MessageViewer = memo(function (
  props: MessageType & {
    runId?: string;
    threadId?: string;
    startEditing?: () => void;
    alwaysShowControls?: boolean;
    initialRating?: 1 | -1 | null;
    noResponse?: boolean;
  },
) {
  const isHuman = props.type === "human";
  const isAI = props.type === "ai";
  const isTool = ["function", "tool"].includes(props.type);
  const contentIsDocuments = isTool && isDocumentContent(props.content);
  const showContent = isTool && !contentIsDocuments ? false : true;
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 1500);
  };

  // Hide tool / retrieval steps from users — internal pipeline details
  if (isTool) {
    return null;
  }

  // Tool call requests inside AI messages — hide from users
  if (!isHuman && !isAI && props.tool_calls?.length) {
    return null;
  }

  // Human message — right-aligned bubble
  if (isHuman) {
    const attachedFiles = (props.additional_kwargs?.attached_files as string[]) ?? [];
    return (
      <>
        <div className="flex flex-col items-end mb-6 group" data-chat-role="human" data-raw-content={encodeURIComponent(typeof props.content === 'string' ? props.content : JSON.stringify(props.content))}>

          <div className="relative max-w-[70%]">
            <div
              className="rounded-[16px_16px_4px_16px] text-white shadow-sm prose-invert"
              style={{
                background: '#00386B',
                padding: '12px 18px',
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: '1.6'
              }}
            >
              <MessageContent className="prose-invert" content={props.content} />
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-300 dark:border-[#4a4a4a]">
                  {attachedFiles.map((name: string) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#4a4a4a] text-gray-600 dark:text-[#8e8ea0]"
                      title={name}
                    >
                      <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-[#2B93D1]" />
                      <span className="max-w-[140px] truncate">{name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {props.noResponse && (
          <div className="flex gap-3 mb-6 group" data-chat-role="ai">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: '#CFECFB' }}
            >
              <SparklesIcon className="h-4 w-4 text-[#00386B]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-gray-900 dark:text-[#ececec] text-sm leading-relaxed prose max-w-none flex items-center gap-1.5">
                <StopCircleIcon className="h-4 w-4 text-gray-500" />
                No response generated
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // AI message — skip bubble if no visible content (tool-only messages)
  const rawText = typeof props.content === "string" ? props.content.trim() : null;
  const hasVisibleContent = rawText !== null
    ? rawText.length > 0
    : Array.isArray(props.content) ? props.content.length > 0 : !!props.content;
  if (!hasVisibleContent) return null;

  const citationRegex = /\[Source:\s*([^,\]]+),\s*Page:\s*([^\]]+)\]/g;
  let cleanText = rawText ?? "";
  const citations: { source: string; page: string }[] = [];

  if (rawText) {
    let parsedJson: { answer?: string; citations?: any[] } | null = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (e) {
      // Ignore parse errors (common during streaming)
    }

    if (parsedJson && parsedJson.answer) {
      // Full complete JSON
      cleanText = parsedJson.answer;
      if (Array.isArray(parsedJson.citations)) {
        citations.push(
          ...parsedJson.citations.map((c: any) => ({
            source: String(c.source || ""),
            page: String(c.page || "")
          }))
        );
      }
    } else {
      // Streaming or partial JSON handling
      let extracted = false;
      const answerMatch = rawText.match(/"answer"\s*:\s*"([^]*)/);
      if (answerMatch) {
        let content = answerMatch[1];
        // If it starts seeing the citations part, trim it off
        const endMatch = content.match(/",\s*"citations"/);
        if (endMatch) {
          content = content.substring(0, endMatch.index);
        }
        // Unescape double quotes and newlines for markdown rendering
        cleanText = content.replace(/\\n/g, "\n").replace(/\\"/g, '"');
        extracted = true;
      } else if (rawText.trim().startsWith("{") && rawText.includes('"answer"')) {
        // We're at the very beginning of standard JSON streaming before the value starts
        cleanText = "";
        extracted = true;
      }

      // Legacy extraction (also works during fallback)
      let match: RegExpExecArray | null;
      while ((match = citationRegex.exec(rawText)) !== null) {
        citations.push({ source: match[1].trim(), page: match[2].trim() });
      }

      if (!extracted) {
        cleanText = rawText.replace(/\[Source:\s*[^,\]]+,\s*Page:\s*[^\]]+\]/g, "").trim();
      }
    }
  }

  // Determine the content to pass to MessageContent (cleaned if string, original otherwise)
  const displayContent = rawText !== null ? cleanText : props.content;

  return (
    <div className="flex flex-col w-full mb-6 group" data-chat-role="ai" data-raw-content={encodeURIComponent(typeof props.content === 'string' ? props.content : JSON.stringify(props.content))}>
      {/* Header Row: Avatar + Text parallel */}
      <div className="flex flex-row items-start gap-[12px] w-full">
        {/* Avatar */}
        <div
          className="flex items-center justify-center shrink-0 transition-all border-none"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#CFECFB',
            flexShrink: 0
          }}
        >
          <SparklesIcon className="h-[18px] w-[18px] text-[#00386B]" />
        </div>

        {/* Content Section */}
        <div
          className="text-[#1E293B] flex-1 min-w-0"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            borderRadius: '0',
            padding: '0',
            fontSize: '15px',
            fontWeight: 400,
            lineHeight: '1.7',
            color: '#1E293B'
          }}
        >
          {showContent && (() => {
            if (typeof displayContent === "string" && displayContent === "") return null;
            return (
              <div className="prose prose-sm max-w-none prose-slate !text-[#1E293B] [&_strong]:font-[700] [&_strong]:text-[#1E293B] [&>*:first-child]:mt-0 [&_*:first-child>*:first-child]:mt-0 [&_p:first-child]:mt-0">
                <MessageContent 
                  content={displayContent} 
                  className="[&>ul]:list-none [&>ul]:pl-0 [&>ol]:list-none [&>ol]:pl-0"
                />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Footer Section: Citations & Feedback (Aligned under the text) */}
      <div className="pl-[48px] space-y-2"> {/* 36px avatar + 12px gap = 48px indentation */}
        {/* Citations */}
        {(() => {
          if (citations.length === 0) return null;
          
          const groupedCitations: { source: string; pages: string[] }[] = [];
          citations.forEach((c) => {
            const existing = groupedCitations.find((g) => g.source === c.source);
            if (existing) {
              if (!existing.pages.includes(c.page)) {
                existing.pages.push(c.page);
                existing.pages.sort((a, b) => {
                  const numA = parseInt(a, 10);
                  const numB = parseInt(b, 10);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  return a.localeCompare(b);
                });
              }
            } else {
              groupedCitations.push({ source: c.source, pages: [c.page] });
            }
          });

          return (
            <div className="flex flex-wrap gap-2">
              {groupedCitations.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-[12px] font-[500] px-3 py-1.5 rounded-[6px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]"
                  title={`Source: ${c.source}, Page: ${c.pages.join(", ")}`}
                >
                  <BookOpenIcon className="h-[13px] w-[13px] shrink-0 text-[#2B93D1]" />
                  {c.source}, Page {c.pages.join(", ")}
                </span>
              ))}
            </div>
          );
        })()}

        <div className="flex items-center gap-1">
          {/* Like / Dislike feedback */}
          {props.threadId && (
            <FeedbackButtons
              threadId={props.threadId}
              runId={props.id}
              initialRating={props.initialRating}
            />
          )}

          {/* Feedback & Actions Divider */}
          {props.threadId && (
            <div className="h-[14px] w-[1px] bg-[#CBD5E1] mx-0.5" />
          )}

          {/* Copy button */}
          <button
            onClick={() => handleCopy(cleanText || (typeof props.content === "string" ? props.content : ""))}
            title="Copy message"
            className="p-1.5 rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out text-[#94A3B8] hover:text-[#2B93D1]"
          >
            <ClipboardIcon className="h-[15px] w-[15px]" />
            {copied && <span className="text-xs font-medium text-[#1E293B] dark:text-white">Copied</span>}
          </button>

          {/* Share button — copies current page URL */}
          <button
            onClick={handleShare}
            title="Copy link to this chat"
            className="p-1.5 rounded-md flex items-center gap-1 transition-all duration-150 ease-in-out text-[#94A3B8] hover:text-[#2B93D1]"
          >
            <ShareIcon className="h-[15px] w-[15px]" />
            {shared && <span className="text-xs font-medium text-[#1E293B] dark:text-white">Copied</span>}
          </button>
        </div>
      </div>
    </div>
  );
});
