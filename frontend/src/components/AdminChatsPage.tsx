import { useEffect, useState, useMemo } from "react";
import { MagnifyingGlassIcon, XMarkIcon, UserIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { HandThumbUpIcon as ThumbUpSolid, HandThumbDownIcon as ThumbDownSolid } from "@heroicons/react/24/solid";
import { cn } from "../utils/cn";
import { StringViewer } from "./String";

interface Feedback {
    id: string;
    thread_id: string;
    run_id: string | null;
    rating: number;
}

interface ThreadSummary {
    thread_id: string;
    name: string;
    user_id: string;
    username: string;
    updated_at: string;
    assistant_name: string | null;
    feedback_count: number;
    likes: number;
    dislikes: number;
}

interface StateMessage {
    type: string;
    content: string | { type: string; text?: string }[];
    id: string;
}

/** Normalize LangChain message content to a plain string.
 *  Content can be a string or a list of content blocks. */
function normalizeContent(content: StateMessage["content"]): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((block) => (block.text ?? ""))
            .join("")
            .trim();
    }
    return "";
}

function ThreadRow({ thread, feedbacks }: { thread: ThreadSummary, feedbacks: Feedback[] }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<StateMessage[] | null>(null);
    const [loading, setLoading] = useState(false);

    const loadMessages = async () => {
        if (messages !== null) { setOpen((o) => !o); return; }
        setOpen(true);
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};
            const res = await fetch(`/api/admin/chats/${thread.thread_id}/state`, { headers });
            if (!res.ok) throw new Error("Failed to load messages");
            const data = await res.json();
            // messages are in data.values.messages for chat_retrieval
            const raw: StateMessage[] = data?.values?.messages ?? data?.values ?? [];
            const msgs: StateMessage[] = raw.filter(
                (m: StateMessage) => ["human", "ai"].includes(m.type) && normalizeContent(m.content)
            );
            setMessages(msgs);
        } catch {
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            {/* Header row */}
            <button
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors text-left group"
                onClick={loadMessages}
            >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="pt-0.5 mt-0.5">
                        {open
                            ? <ChevronDownIcon className="h-5 w-5 text-[#94A3B8] group-hover:text-[#00386B] shrink-0 transition-colors" />
                            : <ChevronRightIcon className="h-5 w-5 text-[#94A3B8] group-hover:text-[#00386B] shrink-0 transition-colors" />}
                    </div>
                    <div className="min-w-0">
                        <span className="text-[15px] font-[600] text-[#00386B] block leading-tight mb-1 truncate" title={thread.name}>{thread.name}</span>
                        <span className="text-[12px] text-[#94A3B8] block truncate">
                            Last Active: {new Date(thread.updated_at).toLocaleString()}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-6 shrink-0 ml-4">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-[500] text-[#334155] border border-[#E2E8F0] rounded-full px-3 py-1 bg-[#F1F5F9]">
                        <UserIcon className="h-3.5 w-3.5 text-[#2B93D1]" /> {thread.username}
                    </span>
                    
                    {thread.likes > 0 && (
                        <span className="flex items-center gap-1.5 text-[#22c55e] text-[13px] font-[600]" title="Likes">
                            <ThumbUpSolid className="h-4 w-4" /> {thread.likes}
                        </span>
                    )}
                    {thread.dislikes > 0 && (
                        <span className="flex items-center gap-1.5 text-[#ef4444] text-[13px] font-[600]" title="Dislikes">
                            <ThumbDownSolid className="h-4 w-4" /> {thread.dislikes}
                        </span>
                    )}
                    {thread.likes === 0 && thread.dislikes === 0 && (
                        <span className="text-[#94A3B8] text-[13px]">No feedback</span>
                    )}
                </div>
            </button>

            {/* Expanded messages */}
            {open && (
                <div className="px-8 py-6 bg-gray-50 dark:bg-[#212121] border-t border-gray-200 dark:border-[#3a3a3a] space-y-4">
                    {loading && <p className="text-gray-500 dark:text-[#8e8ea0] text-sm animate-pulse">Loading messages...</p>}
                    {!loading && messages?.length === 0 && (
                        <p className="text-gray-500 dark:text-[#8e8ea0] text-sm">No messages in this thread.</p>
                    )}
                    {!loading && messages?.map((msg, i) => {
                        const fb = feedbacks.find(f => f.run_id === msg.id);
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "text-sm px-4 py-3 rounded-xl max-w-3xl w-fit",
                                    msg.type === "human"
                                        ? "ml-auto bg-gray-200 text-gray-900 border-gray-900 text-right dark:bg-[#2f2f2f] dark:text-[#ececec]"
                                        : "mr-auto bg-gray-100 text-gray-900 dark:bg-[#2f2f2f] dark:text-[#ececec]",
                                )}
                            >
                                <div className={cn("flex items-start mb-2", msg.type === "human" ? "justify-end" : "justify-between")}>
                                    <span className="text-[11px] font-semibold uppercase tracking-widest opacity-50">
                                        {msg.type === "human" ? "User" : "Bot"}
                                    </span>
                                    {fb && (
                                        <div className="shrink-0 ml-4">
                                            {fb.rating === 1 && <ThumbUpSolid className="h-4 w-4 text-green-400" title="Liked" />}
                                            {fb.rating === -1 && <ThumbDownSolid className="h-4 w-4 text-red-400" title="Disliked" />}
                                        </div>
                                    )}
                                </div>
                                {(() => {
                                    const raw = normalizeContent(msg.content);
                                    const citationRegex = /\[Source:\s*([^,\]]+),\s*Page:\s*([^\]]+)\]/g;
                                    const citations: { source: string; page: string }[] = [];
                                    let match: RegExpExecArray | null;
                                    const rx = new RegExp(citationRegex.source, "g");
                                    while ((match = rx.exec(raw)) !== null) {
                                        citations.push({ source: match[1].trim(), page: match[2].trim() });
                                    }
                                    const cleanText = raw.replace(/\[Source:\s*[^,\]]+,\s*Page:\s*[^\]]+\]/g, "").trim();
                                    return (
                                        <>
                                            <StringViewer value={cleanText} markdown={true} className="prose-sm dark:prose-invert leading-relaxed text-[inherit] [&_p:last-child]:mb-0 [&_p:first-child]:mt-0 [&>ul]:list-none [&>ul]:pl-0 [&>ol]:list-none [&>ol]:pl-0" />
                                            {(() => {
                                                if (citations.length === 0 || msg.type !== "ai") return null;

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
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {groupedCitations.map((c, ci) => (
                                                            <span
                                                                key={ci}
                                                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700 dark:bg-[#1e1e1e] dark:border-[#3a3a3a] dark:text-[#8e8ea0]"
                                                                title={`Source: ${c.source}, Page: ${c.pages.join(", ")}`}
                                                            >
                                                                <BookOpenIcon className="h-3 w-3 shrink-0 text-[#2B93D1] dark:text-[#2B93D1]" />
                                                                {c.source}, Page {c.pages.join(", ")}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function AdminChatsPage() {
    const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};

        fetch("/api/admin/chats", { headers })
            .then((r) => {
                if (!r.ok) throw new Error("Failed to fetch chats");
                return r.json();
            })
            .then(setThreads)
            .catch(() => setThreads([]));

        fetch("/api/feedback", { headers })
            .then((r) => {
                if (!r.ok) throw new Error("Failed to fetch feedback");
                return r.json();
            })
            .then(setFeedbacks)
            .catch(() => setFeedbacks([]));
    }, []);

    const filteredThreads = useMemo(() => {
        if (!threads) return null;
        const q = search.trim().toLowerCase();
        if (!q) return threads;
        return threads.filter(
            (t) =>
                t.name?.toLowerCase().includes(q) ||
                t.username?.toLowerCase().includes(q) ||
                t.user_id?.toLowerCase().includes(q),
        );
    }, [threads, search]);

    return (
        <div className="flex-1 overflow-y-auto w-full h-full bg-[#F0F4F8] flex flex-col">
            <div className="w-full max-w-5xl mx-auto px-8 py-10 flex flex-col flex-1">
                {(filteredThreads === null || filteredThreads.length > 0 || search) && (
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-[24px] font-[700] text-[#00386B]">Chat History</h1>
                            <p className="text-[14px] text-[#64748B] mt-1">Review all user conversations and feedback with Bots.</p>
                        </div>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Type to Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-10 py-2.5 text-sm rounded-[10px] bg-white border-[1.5px] border-[#CBD5E1] text-[#1E293B] placeholder:text-[#94A3B8] outline-none transition-all focus:border-[#2B93D1] focus:shadow-[0_0_0_3px_rgba(43,147,209,0.15)] w-72"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#00386B] transition-colors"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {filteredThreads === null && (
                    <div className="flex justify-center py-12">
                        <p className="text-gray-500 text-sm animate-pulse dark:text-[#8e8ea0]">Loading chat history...</p>
                    </div>
                )}
                {filteredThreads?.length === 0 && (
                    <div className="flex flex-col flex-1 items-center justify-center text-center">
                        {search ? (
                            <p className="text-gray-500 text-sm dark:text-[#8e8ea0]">
                                No chats found for &ldquo;{search}&rdquo;.
                            </p>
                        ) : (
                            <>
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-[#2a2a2a]">
                                    <svg className="h-8 w-8 text-gray-400 dark:text-[#8e8ea0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-[#ececec] mb-2">No User Conversations yet</h3>
                                <p className="text-sm text-gray-500 dark:text-[#8e8ea0] max-w-sm leading-relaxed">
                                    User chats and feedback will appear here once users start interacting with Surtn &mdash; the AI assistant.
                                </p>
                            </>
                        )}
                    </div>
                )}
                <div className="space-y-4">
                    {filteredThreads?.map((t) => (
                        <div key={t.thread_id} className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:border-[#2B93D1] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                            <ThreadRow
                                thread={t}
                                feedbacks={feedbacks.filter(f => f.thread_id === t.thread_id)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
