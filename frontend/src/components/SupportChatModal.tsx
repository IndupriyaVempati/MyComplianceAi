import { Fragment, useState, useEffect, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, PaperAirplaneIcon, PlusIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { Button } from "./Button";
import { MessageContent } from "./Message";

interface SupportTicket {
  id: string;
  status: "open" | "closed";
  created_at: string;
  closed_by?: string | null;
  label?: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_username?: string;
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
  ticketId?: string;
  ticketLabel?: string;
  onRequestCloseTicket: () => void;
  onTicketCreated?: (ticketId: string) => void;
}

function formatRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export function SupportChatModal({
  isOpen,
  onClose,
  initialContext,
  ticketId,
  ticketLabel,
  onRequestCloseTicket,
  onTicketCreated,
}: SupportChatModalProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isNewRequest, setIsNewRequest] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const isNew = isNewRequest || (!activeTicket && tickets.length === 0);
  const draftKey = isNew ? "new" : (activeTicket?.id || "empty");
  const inputValue = drafts[draftKey] || "";
  
  const setInputValue = (val: string) => {
    setDrafts((prev) => ({ ...prev, [draftKey]: val }));
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const forceScrollRef = useRef(false);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Consider "at bottom" if within 80px of the end
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  };

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/support/ticket", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data: SupportTicket[] = await res.json();
        setTickets(data);
        // Keep active ticket status in sync
        // Keep active ticket status in sync using functional update to bypass stale closures
        setActiveTicket((prev) => {
          if (!prev) return prev;
          const updated = data.find((t) => t.id === prev.id);
          return updated ? updated : prev;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (tId: string, isInitial = false) => {
    if (isInitial) setIsLoadingMessages(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/support/ticket/${tId}/messages`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) setMessages(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      if (isInitial) setIsLoadingMessages(false);
    }
  };

  // ─── Effects ──────────────────────────────────────────────────────────────

  const initializedTicketId = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      setInputValue("");
    } else {
      setActiveTicket(null);
      setMessages([]);
      setIsNewRequest(false);
      initializedTicketId.current = null;
    }
  }, [isOpen]);

  // Poll tickets list
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(fetchTickets, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  // When ticketId prop provided (from right sidebar), pre-select that ticket
  useEffect(() => {
    if (isOpen && ticketId && tickets.length > 0 && initializedTicketId.current !== ticketId) {
      const t = tickets.find((x) => x.id === ticketId);
      if (t) {
        setActiveTicket(t);
        initializedTicketId.current = ticketId;
      }
    }
  }, [isOpen, ticketId, tickets]);

  // Poll messages for active ticket — force-scroll on first load of a ticket
  useEffect(() => {
    if (!isOpen || !activeTicket?.id) return;
    forceScrollRef.current = true; // snap to bottom when switching tickets
    isAtBottom.current = true;
    setMessages([]);  // clear stale messages immediately so spinner shows
    fetchMessages(activeTicket.id, true); // isInitial=true → shows spinner
    const id = setInterval(() => fetchMessages(activeTicket.id!), 5000);
    return () => clearInterval(id);
  }, [isOpen, activeTicket?.id]);

  // Scroll to bottom only when user is already at the bottom, or a force-scroll was requested
  useEffect(() => {
    if (forceScrollRef.current || isAtBottom.current) {
      scrollToBottom();
      forceScrollRef.current = false;
    }
  }, [messages]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const doSend = async () => {
    if (!inputValue.trim()) return;
    forceScrollRef.current = true; // always snap after sending
    setIsSending(true);
    try {
      const token = localStorage.getItem("auth_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (!activeTicket) {
        // Create new ticket
        const fullMessage = initialContext ? `Context:\n${initialContext}` : inputValue;
        const createRes = await fetch("/api/support/ticket", {
          method: "POST",
          headers,
          body: JSON.stringify({ initial_message: fullMessage, label: ticketLabel }),
        });
        if (createRes.ok) {
          const newTicket: SupportTicket = await createRes.json();
          setActiveTicket(newTicket);
          setTickets((prev) => [newTicket, ...prev]);
          setIsNewRequest(false);
          if (onTicketCreated) onTicketCreated(newTicket.id);
          await fetch(`/api/support/ticket/${newTicket.id}/message`, {
            method: "POST",
            headers,
            body: JSON.stringify({ content: inputValue }),
          });
          setInputValue("");
          await fetchMessages(newTicket.id);
        }
      } else {
        const res = await fetch(`/api/support/ticket/${activeTicket.id}/message`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: inputValue }),
        });
        if (res.ok) {
          setInputValue("");
          await fetchMessages(activeTicket.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };


  // ─── Render ───────────────────────────────────────────────────────────────

  const showNewRequest = isNewRequest || (!activeTicket && tickets.length === 0);

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* Wide panel matching admin layout */}
              <Dialog.Panel className="relative w-full max-w-4xl h-[80vh] max-h-[700px] flex overflow-hidden rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] bg-white dark:bg-[#171717]">

                {/* ── Left sidebar: ticket list ── */}
                <div className="w-72 shrink-0 border-r border-gray-200 dark:border-[#3a3a3a] flex flex-col">
                  <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between">
                    <h2 className="text-[16px] font-[700] text-[#00386B] dark:text-[#ececec]">
                      Support Chats
                    </h2>
                    <button
                      onClick={() => {
                        setActiveTicket(null);
                        setMessages([]);
                        setIsNewRequest(true);
                      }}
                      title="New request"
                      className="p-1 rounded-md text-[#64748B] hover:text-[#00386B] hover:bg-[#F0F4F8] dark:hover:bg-[#00295A]/20 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {tickets.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center mt-8 px-4">
                        No support requests yet.
                      </p>
                    ) : (
                      tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => {
                            setActiveTicket(ticket);
                            setIsNewRequest(false);
                            fetchMessages(ticket.id);
                          }}
                          className={`w-full text-left p-3 hover:bg-[#F8FAFC] dark:hover:bg-[#2a2a2a] transition-colors border-l-[3px] ${
                            activeTicket?.id === ticket.id && !isNewRequest
                              ? "bg-[#EFF6FF] border-l-[#2B93D1] dark:bg-[#00386B]/30"
                              : "border-l-transparent"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="text-[13px] font-[600] text-[#1E293B] dark:text-[#ececec] break-words flex-1 min-w-0 pr-2"
                              title={ticket.label || "Support Chat"}
                            >
                              {ticket.label || "Support Chat"}
                            </span>
                            <span className="text-[11px] text-[#94A3B8] whitespace-nowrap shrink-0">
                              {formatRelativeTime(ticket.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#94A3B8] truncate pr-2" title={ticket.id}>
                              ID: {ticket.id}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-[10px] py-[2px] text-[11px] font-semibold ${
                                ticket.status === "open"
                                  ? "bg-[#D1FAE5] text-[#065F46]"
                                  : "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-500/10 dark:bg-[#2a2a2a] dark:text-[#8e8ea0] dark:ring-[#4a4a4a]"
                              }`}
                            >
                              {ticket.status.toUpperCase()}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Right panel: chat ── */}
                <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#1a1a1a] min-w-0">
                  {/* Close button */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={onClose}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-[#00386B] dark:hover:text-gray-200 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {showNewRequest ? (
                    /* ── New Request panel ── */
                    <>
                      <div className="px-5 py-4 bg-white border-b border-gray-200 dark:bg-[#171717] dark:border-[#3a3a3a]">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececec]">
                          New Support Request
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Describe your issue and we'll get back to you.
                        </p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5">
                        {initialContext && (
                          <div className="mb-4 border border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] p-3 rounded-lg text-xs text-gray-400 space-y-1 opacity-70">
                            <span className="block font-semibold text-[10px] text-gray-400 dark:text-[#6a6a6a] mb-1 uppercase tracking-wider">
                              Attached Context
                            </span>
                            <p className="whitespace-pre-wrap">{initialContext}</p>
                          </div>
                        )}
                        <p className="text-sm text-gray-400 dark:text-[#8e8ea0] text-center mt-6">
                          Type your message below to start a conversation.
                        </p>
                      </div>

                      <div className="p-4 border-t border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#171717]">
                        <form
                          onSubmit={(e) => { e.preventDefault(); doSend(); }}
                          className="flex gap-3 items-end"
                        >
                          <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type your issue..."
                            autoFocus
                            rows={3}
                            className="flex-1 resize-none rounded-[10px] border-[1.5px] border-[#CBD5E1] py-2.5 text-[14px] text-[#1E293B] dark:text-[#ececec] dark:bg-[#333333] placeholder:text-[#94A3B8] focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15 focus:outline-none px-3 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                doSend();
                              }
                            }}
                          />
                           <button
                            type="submit"
                            disabled={isSending || !inputValue.trim()}
                            className="mb-1 inline-flex items-center justify-center rounded-[10px] bg-[#FFC20E] p-2.5 text-[#00386B] shadow-[0_2px_8px_rgba(255,194,14,0.3)] hover:bg-[#E6AE00] disabled:opacity-50 transition-all border-none"
                          >
                            <PaperAirplaneIcon className="h-5 w-5 text-[#00386B]" />
                          </button>
                        </form>
                      </div>
                    </>
                  ) : activeTicket ? (
                    /* ── Active ticket chat ── */
                    <>
                      <div className="pl-5 pr-14 py-4 bg-white border-b border-gray-200 flex justify-between items-center dark:bg-[#171717] dark:border-[#3a3a3a]">
                        <div className="min-w-0 flex-1 mr-4">
                          <h3 
                            className="text-[16px] font-[700] text-[#00386B] dark:text-[#ececec] truncate"
                            title={activeTicket.label || "Support Chat"}
                          >
                            {activeTicket.label || "Support Chat"}
                          </h3>
                          <p className="text-[13px] text-[#64748B] mt-0.5 truncate">
                            Started {formatRelativeTime(activeTicket.created_at)}
                          </p>
                        </div>
                        {activeTicket.status === "open" && (
                          <button
                            onClick={onRequestCloseTicket}
                            className="shrink-0 px-4 py-2 text-[13px] font-[700] bg-[#059669] text-white hover:bg-[#047857] border-none rounded-[10px] transition-all"
                          >
                            Mark as Resolved
                          </button>
                        )}
                      </div>

                      {/* Messages */}
                      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 p-5 overflow-y-auto space-y-4">
                        {isLoadingMessages ? (
                          <div className="flex flex-col items-center justify-center mt-10 gap-3">
                            <svg className="animate-spin h-6 w-6 text-[#2B93D1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-[13px] text-[#94A3B8]">Loading messages…</span>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm mt-10">
                            No messages yet.
                          </div>
                        ) : (
                          messages.map((msg) => {
                            const isAdmin = msg.sender_username?.toLowerCase().includes("admin");
                            const isContext = msg.content.startsWith("Context:\n");
                            const contextBody = isContext
                              ? msg.content.replace(/^Context:\n/, "")
                              : null;
                            return (
                              <div key={msg.id} className="space-y-4">
                                {isContext && contextBody ? (
                                  <div className="space-y-3">

                                    {contextBody.split("\n\n").map((part, i) => {
                                      const isPartUser = part.trim().startsWith("User:");
                                      let cleanPart = part
                                        .replace(/^(User:|Agent:)\s*/, "")
                                        .replace("Authorized User", "")
                                        .replace("Surtn IntelligenceVerified", "")
                                        .trim();
                                      
                                      if (!cleanPart) return null;
                                      
                                      const citationRegex = /\[Source:\s*([^,\]]+),\s*Page:\s*([^\]]+)\]/g;
                                      const citations: { source: string; page: string }[] = [];
                                      let match: RegExpExecArray | null;
                                      
                                      // Extract citations
                                      while ((match = citationRegex.exec(cleanPart)) !== null) {
                                        citations.push({ source: match[1].trim(), page: match[2].trim() });
                                      }
                                      
                                      if (citations.length > 0) {
                                        cleanPart = cleanPart.replace(/\[Source:\s*[^,\]]+,\s*Page:\s*[^\]]+\]/g, "").trim();
                                      }

                                      // Group and sort citations
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
                                        <div
                                          key={i}
                                          className={`flex flex-col ${isPartUser ? "items-end" : "items-start"}`}
                                        >
                                          <div
                                            className={`max-w-[85%] ${
                                              isPartUser
                                                ? "rounded-[16px_16px_4px_16px] px-4 py-3 text-sm shadow-sm bg-[#00386B] text-white"
                                                : "rounded-[16px_16px_16px_4px] px-4 py-[14px] text-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white border border-[#E2E8F0] text-[#1E293B]"
                                            }`}
                                          >
                                            <div
                                              className="text-[10px] font-[600] mb-1 tracking-[0.08em] uppercase text-[#64748B] dark:text-[#8e8ea0]"
                                              style={{ display: 'none' }}
                                            >
                                              {isPartUser ? "USER" : "AGENT"} • CONTEXT
                                            </div>
                                            <div className={
                                              isPartUser 
                                                ? "prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&_*:first-child>*:first-child]:mt-0 [&_p:first-child]:mt-0 text-white" 
                                                : "prose prose-sm max-w-none prose-slate !text-[#1E293B] [&_strong]:font-[700] [&>*:first-child]:mt-0 [&_*:first-child>*:first-child]:mt-0 [&_p:first-child]:mt-0"
                                            }>
                                              <MessageContent content={cleanPart} className={isPartUser ? "prose-invert" : ""} />
                                            </div>
                                          </div>
                                          
                                          {/* Render parsed citations seamlessly */}
                                          {groupedCitations.length > 0 && (
                                            <div className={`flex flex-wrap gap-2 mt-2 ${isPartUser ? "justify-end" : "justify-start"} max-w-[85%]`}>
                                              {groupedCitations.map((c, idx) => (
                                                <span
                                                  key={idx}
                                                  className="inline-flex items-center gap-1.5 text-[12px] font-[500] px-3 py-1.5 rounded-[6px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]"
                                                  title={`Source: ${c.source}, Page: ${c.pages.join(", ")}`}
                                                >
                                                  <BookOpenIcon className="h-[13px] w-[13px] shrink-0 text-[#2B93D1]" />
                                                  {c.source}, Page {c.pages.join(", ")}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div
                                    className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                                  >
                                    <div
                                      className={`max-w-[85%] ${
                                        isAdmin
                                          ? "rounded-[16px_16px_16px_4px] px-4 py-[14px] text-[14px] leading-[1.6] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white border border-[#E2E8F0] text-[#1E293B]"
                                          : "rounded-[16px_16px_4px_16px] px-4 py-3 text-sm shadow-sm bg-[#00386B] text-white"
                                      }`}
                                    >
                                      <div
                                        className={`text-[10px] font-[600] mb-1 tracking-[0.08em] ${
                                          isAdmin
                                            ? "uppercase text-[#64748B] dark:text-[#8e8ea0]"
                                            : "text-white/70"
                                        }`}
                                      >
                                        {msg.sender_username || (isAdmin ? "AGENT" : "YOU")} •{" "}
                                        {formatRelativeTime(msg.created_at)}
                                      </div>
                                      <div className="whitespace-pre-wrap leading-relaxed">
                                        {msg.content.split("\n").map((line, i) => {
                                          const cleanLine = line
                                            .replace(/^(User:|Agent:)\s*/, "")
                                            .replace("Authorized User", "")
                                            .replace("Surtn IntelligenceVerified", "")
                                            .trim();
                                          
                                          if (!cleanLine) return null;
                                          return <span key={i} className="block">{cleanLine}</span>;
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />

                        {/* Closure attribution */}
                        {activeTicket.status === "closed" && (
                          <p className="text-center text-xs text-gray-400 dark:text-[#8e8ea0] mt-3 mb-1">
                            ✅{" "}
                            {activeTicket.closed_by === "admin"
                              ? "Resolved by Support (Admin)."
                              : "This issue was marked as resolved by you."}
                          </p>
                        )}
                      </div>

                      {/* Input */}
                      <div className="p-4 border-t border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#171717]">
                        <form
                          onSubmit={(e) => { e.preventDefault(); doSend(); }}
                          className="flex gap-3 items-end"
                        >
                          <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={
                              activeTicket.status === "closed"
                                ? "This ticket is closed."
                                : "Type your reply..."
                            }
                            disabled={activeTicket.status === "closed" || isSending}
                            rows={3}
                            className="flex-1 resize-none rounded-[10px] border-[1.5px] border-[#CBD5E1] py-2.5 text-[14px] text-[#1E293B] dark:text-[#ececec] dark:bg-[#333333] placeholder:text-[#94A3B8] focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15 focus:outline-none px-3 disabled:opacity-50 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                doSend();
                              }
                            }}
                          />
                          <button
                            type="submit"
                            disabled={
                              activeTicket.status === "closed" ||
                              isSending ||
                              !inputValue.trim()
                            }
                            className="mb-1 inline-flex items-center justify-center rounded-[10px] bg-[#FFC20E] p-2.5 text-[#00386B] shadow-[0_2px_8px_rgba(255,194,14,0.3)] hover:bg-[#E6AE00] disabled:opacity-50 transition-all border-none"
                          >
                            <PaperAirplaneIcon className="h-5 w-5 text-[#00386B]" />
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    /* ── Empty state ── */
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-8">
                      <p className="text-[14px] text-[#94A3B8]">
                        Select a chat from the left, or start a new support request.
                      </p>
                      <Button
                        onClick={() => setIsNewRequest(true)}
                        variant="primary"
                        className="gap-2 !bg-[#FFC20E] !text-[#00386B] !font-[700] !rounded-[10px] !border-none hover:!bg-[#E6AE00]"
                      >
                        <PlusIcon className="h-4 w-4 text-[#00386B]" />
                        New Request
                      </Button>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}
