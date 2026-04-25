import { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "./Toast";
import { MessageContent } from "./Message";

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

interface SupportTicket {
  id: string;
  user_id: string;
  status: "open" | "closed";
  created_at: string;
  username?: string;
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

export function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const inputValue = activeTicketId ? (drafts[activeTicketId] || "") : "";
  
  const setInputValue = (val: string) => {
    if (activeTicketId) {
      setDrafts((prev) => ({ ...prev, [activeTicketId]: val }));
    }
  };
  const [isSending, setIsSending] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isClosingTicket, setIsClosingTicket] = useState(false);
  const { show: showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const forceScrollRef = useRef(false);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  };

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/support/ticket", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data: SupportTicket[] = await res.json();
        setTickets(data);
        // Keep active ticket status in sync using functional update to bypass stale closures
        setActiveTicketId((prev) => {
          if (!prev) return prev;
          const updated = data.find((t) => t.id === prev);
          return updated ? updated.id : prev;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/support/ticket/${ticketId}/messages`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 5000); // Poll for new tickets
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTicketId) {
      forceScrollRef.current = true; // snap to bottom when switching tickets
      isAtBottom.current = true;
      fetchMessages(activeTicketId);
      const interval = setInterval(() => fetchMessages(activeTicketId), 5000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [activeTicketId]);

  // Scroll to bottom only when user is already at the bottom, or a force-scroll was requested
  useEffect(() => {
    if (forceScrollRef.current || isAtBottom.current) {
      scrollToBottom();
      forceScrollRef.current = false;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeTicketId) return;
    forceScrollRef.current = true; // always snap after sending
    setIsSending(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/support/ticket/${activeTicketId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: inputValue }),
      });
      if (res.ok) {
        setInputValue("");
        await fetchMessages(activeTicketId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseTicket = () => {
    if (!activeTicketId) return;
    setShowCloseConfirm(true);
  };

  const confirmCloseTicket = async () => {
    if (!activeTicketId) return;
    setIsClosingTicket(true);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/support/ticket/${activeTicketId}/close`, {
        method: "PATCH",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        await fetchTickets();
        // Update local state without waiting for poll
        setTickets(tickets.map(t => t.id === activeTicketId ? { ...t, status: 'closed' } : t));
        setShowCloseConfirm(false);
        showToast("Ticket resolved successfully");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClosingTicket(false);
    }
  };

  const activeTicket = tickets.find(t => t.id === activeTicketId);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#F0F4F8]">
      {/* Left Sidebar - Tickets List */}
      <div className="w-1/3 bg-white border-r border-[#E2E8F0] flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-[#E2E8F0]">
          <h2 className="text-lg font-bold text-[#00386B]">Support Tickets</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tickets.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center mt-10">No support tickets found.</div>
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {tickets.map(ticket => (
                <li
                  key={ticket.id}
                  onClick={() => setActiveTicketId(ticket.id)}
                  className={`p-4 cursor-pointer transition-all ${activeTicketId === ticket.id ? 'bg-[#EFF6FF] border-l-[3px] border-[#2B93D1]' : 'hover:bg-[#F8FAFC]'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span 
                        className="font-medium text-[13px] text-[#1E293B] dark:text-[#ececec] break-words"
                        title={ticket.label || "Support Chat"}
                      >
                        {ticket.label || "Support Chat"}
                      </span>
                      <span className="text-xs text-gray-500 truncate" title={ticket.username}>
                        {ticket.username || "Unknown User"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0 ml-2">
                      {formatRelativeTime(ticket.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate pr-2" title={ticket.id}>
                      ID: {ticket.id}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-[10px] py-[2px] text-[11px] font-[600] tracking-[0.02em] ${
                      ticket.status === 'open' 
                        ? 'bg-[#059669]/10 text-[#059669] border border-[#059669]/20' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Content - Chat Interface */}
      <div className="flex-1 flex flex-col bg-[#F0F4F8]">
        {activeTicket ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-[#E2E8F0] flex justify-between items-center">
              <div>
                <h3 className="text-md font-bold text-[#00386B]">
                  Chat with {activeTicket.username || "User"}
                </h3>
                <p className="text-[11px] text-[#64748B]">Started {formatRelativeTime(activeTicket.created_at)}</p>
              </div>
              {activeTicket.status === 'open' && (
                <button
                  onClick={handleCloseTicket}
                  className="px-4 py-2 rounded-[10px] bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-sm border-none shadow-[0_2px_8px_rgba(5,150,105,0.3)]"
                >
                  Mark as Resolved
                </button>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm mt-10">No messages yet.</div>
              ) : (
                messages.map(msg => {
                  const isAdmin = msg.sender_username?.toLowerCase().includes("admin");
                  const isContext = msg.content.startsWith("Context:\n");
                  const contextBody = isContext ? msg.content.replace(/^Context:\n/, "") : null;

                  return (
                    <div key={msg.id} className="space-y-4">
                      {isContext && contextBody ? (
                        <div className="space-y-3">
                          {contextBody.split("\n\n").map((part, i) => {
                            const isPartAgent = part.trim().startsWith("Agent:");
                            let cleanPart = part
                              .replace(/^(User:|Agent:)\s*/, "")
                              .replace("Authorized User", "")
                              .replace("Surtn IntelligenceVerified", "")
                              .trim();

                            if (!cleanPart) return null;

                            const citationRegex = /\[Source:\s*([^,\]]+),\s*Page:\s*([^\]]+)\]/g;
                            const citations: { source: string; page: string }[] = [];
                            let match: RegExpExecArray | null;

                            while ((match = citationRegex.exec(cleanPart)) !== null) {
                              citations.push({ source: match[1].trim(), page: match[2].trim() });
                            }

                            if (citations.length > 0) {
                              cleanPart = cleanPart.replace(/\[Source:\s*[^,\]]+,\s*Page:\s*[^\]]+\]/g, "").trim();
                            }

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
                                className={`flex flex-col ${isPartAgent ? "items-end" : "items-start"}`}
                              >
                                <div
                                  className={`max-w-[85%] ${
                                    isPartAgent
                                      ? "rounded-[16px_16px_4px_16px] px-4 py-3 text-sm shadow-sm bg-[#00386B] text-white"
                                      : "rounded-[16px_16px_16px_4px] px-4 py-[14px] text-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white border border-[#E2E8F0] text-[#1E293B]"
                                  }`}
                                >
                                  <div
                                    className={`text-[10px] font-[600] mb-1 tracking-[0.08em] uppercase ${isPartAgent ? 'text-white/60' : 'text-[#64748B]'}`}
                                  >
                                    {isPartAgent ? "SURTN AI" : "USER"} • CONTEXT
                                  </div>
                                  <div className={
                                    isPartAgent
                                      ? "prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&_p:first-child]:mt-0 text-white"
                                      : "prose prose-sm max-w-none prose-slate !text-[#1E293B] [&_strong]:font-[700] [&>*:first-child]:mt-0 [&_p:first-child]:mt-0"
                                  }>
                                    <MessageContent content={cleanPart} className={isPartAgent ? "prose-invert" : ""} />
                                  </div>
                                </div>

                                {groupedCitations.length > 0 && (
                                  <div className={`flex flex-wrap gap-2 mt-2 ${isPartAgent ? "justify-end" : "justify-start"} max-w-[85%]`}>
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
                        <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] ${
                            isAdmin
                              ? 'rounded-[16px_16px_4px_16px] px-4 py-3 text-sm shadow-sm bg-[#00386B] text-white'
                              : 'rounded-[16px_16px_16px_4px] px-4 py-[14px] text-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-white border border-[#E2E8F0] text-[#1E293B]'
                          }`}>
                            <div className={`text-[10px] font-[600] mb-1 tracking-[0.08em] ${isAdmin ? 'text-white/60' : 'text-[#64748B]'}`}>
                              {msg.sender_username || (isAdmin ? "YOU" : "USER")} • {formatRelativeTime(msg.created_at)}
                            </div>
                            <div className={
                              isAdmin
                                ? "prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&_p:first-child]:mt-0 text-white"
                                : "prose prose-sm max-w-none prose-slate !text-[#1E293B] [&_strong]:font-[700] [&>*:first-child]:mt-0 [&_p:first-child]:mt-0"
                            }>
                              <MessageContent content={msg.content} className={isAdmin ? "prose-invert" : ""} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />

              {/* Closure attribution — plain text, no bubble */}
              {activeTicket.status === "closed" && (
                <p className="text-center text-xs text-gray-400 dark:text-[#8e8ea0] mt-3 mb-1">
                  ✅{" "}
                  {activeTicket.closed_by === "admin"
                    ? "Resolved by Support (Admin)."
                    : `Marked as resolved by ${activeTicket.username || "User"}.`}
                </p>
              )}

            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-[#E2E8F0]">
              <form onSubmit={handleSend} className="flex gap-3 items-end">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={activeTicket.status === 'closed' ? "This ticket is closed." : "Type your reply..."}
                  disabled={activeTicket.status === 'closed' || isSending}
                  className="flex-1 resize-none rounded-[10px] px-3 py-2.5 text-sm bg-white border-[1.5px] border-[#CBD5E1] text-[#1E293B] placeholder-[#94A3B8] focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15 focus:outline-none transition-all disabled:opacity-50"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={activeTicket.status === 'closed' || isSending || !inputValue.trim()}
                  className="mb-1 inline-flex items-center justify-center rounded-[10px] bg-[#FFC20E] p-2.5 text-[#00386B] shadow-sm hover:opacity-90 disabled:opacity-25"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-[#8e8ea0]">
            Select a ticket to view messages
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={confirmCloseTicket}
        title="Mark as Resolved"
        message={(
          <>
            Are you sure you want to resolve this ticket for {activeTicket?.username || "User"} (Ticket:{" "}
            <span className="font-[600] text-[#334155] border-b border-dotted border-[#94A3B8]" title={activeTicketId || ""}>
              {activeTicketId?.split('-')[0]}...
            </span>
            )?
          </>
        )}
        confirmText={isClosingTicket ? "Resolving..." : "Mark as Resolved"}
        variant="success"
      />
    </div>
  );
}
