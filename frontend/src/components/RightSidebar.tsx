import { useState } from "react";

import { ChevronDownIcon, ChevronUpIcon, DocumentArrowDownIcon, EnvelopeIcon, CreditCardIcon, ChatBubbleLeftRightIcon, UserIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SupportChatModal } from "./SupportChatModal";
import { format } from "date-fns";
import { PlusIcon } from "@heroicons/react/20/solid";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "./Toast";
import { useThreadAndAssistant } from "../hooks/useThreadAndAssistant";
import { UserSettingsModal } from "./UserSettingsModal";


const FAQ_ITEMS = [
  { question: "What is Surtn AI?", answer: "Surtn is your intelligent AI assistant to help you with various tasks, answer questions, and generate insights based on your data." },
  { question: "How does the knowledge base work?", answer: "The Knowledge Base uses Retrieval-Augmented Generation (RAG) to provide context-aware answers using your uploaded documents." },
  { question: "Can I use it on mobile?", answer: "Yes, Surtn is fully responsive and works smoothly on mobile devices and tablets." },
  { question: "Is my data secure?", answer: "Absolutely. We prioritize data privacy and employ robust encryption standards to protect your information." },
  { question: "How can I contact support?", answer: "You can reach out to our support team via email or use the help section in the dashboard." },
];

export function RightSidebar() {
  const { chatId: thread_id } = useParams();
  const { currentChat } = useThreadAndAssistant();
  const { show: showToast } = useToast();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [isSupportChatsOpen, setIsSupportChatsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportContext, setSupportContext] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined);
  const [supportTickets, setSupportTickets] = useState<{ id: string, status: string, created_at: string, label?: string }[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Close Support Ticket State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isClosingTicket, setIsClosingTicket] = useState(false);
  const [hasPurchases, setHasPurchases] = useState(false);

  const fetchBillingHistory = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/billing/history", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          setHasPurchases(Array.isArray(data) && data.length > 0);
        }
      }
    } catch (e) {
      console.error("Error fetching billing history", e);
    }
  };

  const fetchSupportTickets = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/support/ticket", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const tickets = await res.json();
        setSupportTickets(tickets);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBillingHistory();
    fetchSupportTickets(); // fetch on mount so badge shows even when collapsed
  }, []);

  useEffect(() => {
    if (isSupportChatsOpen) {
      fetchSupportTickets();
    }
  }, [isSupportChatsOpen, isSupportModalOpen]); // refresh when modal closes or accordion opens

  const handleOpenSupport = (ticketId?: string) => {
    if (!ticketId && !thread_id) {
      showToast("Please select a chat to request support.", "error");
      return;
    }

    let contextStr = "";
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) {
      // Find messages by strict explicit data tag
      const messages = Array.from(chatContainer.querySelectorAll('[data-chat-role]'));
      if (messages.length > 0) {
        contextStr = messages.map((m) => {
          const role = m.getAttribute('data-chat-role') === 'ai' ? 'Agent' : 'User';
          const rawCont = m.getAttribute('data-raw-content');
          let text = m.textContent?.trim() || "";
          
          if (rawCont) {
            try {
              text = decodeURIComponent(rawCont);
              // In case it's a JSON string with an answer field and citations array
              if (text.startsWith("{") && text.includes('"answer"')) {
                const parsed = JSON.parse(text);
                text = parsed.answer || text;
                
                if (Array.isArray(parsed.citations)) {
                  parsed.citations.forEach((c: any) => {
                    text += `\n[Source: ${c.source || ""}, Page: ${c.page || ""}]`;
                  });
                }
              }
            } catch(e) {}
          }
          
          return `${role}: ${text}`;
        }).join("\n\n");
      }
    }
    setSupportContext(contextStr);
    setSelectedTicketId(ticketId);
    setIsSupportModalOpen(true);
  };

  const confirmCloseTicket = async () => {
    if (!selectedTicketId) return;
    setIsClosingTicket(true);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/support/ticket/${selectedTicketId}/close`, {
        method: "PATCH",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res.ok) {
        setIsConfirmModalOpen(false);
        setIsSupportModalOpen(false); // Close chat UI
        fetchSupportTickets();       // Refresh dropdown list
        showToast("Ticket resolved successfully");
      }
    } catch (e) {
      console.error("Error closing ticket", e);
    } finally {
      setIsClosingTicket(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleDownloadPDF = async () => {
    if (!thread_id) {
      showToast("Please select a chat to download.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/threads/${thread_id}/pdf`, {
        method: "GET",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF on server");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let fileName = "";
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) fileName = match[1];
      }
      if (!fileName) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const d = new Date();
        const h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hours12 = pad(h % 12 || 12);
        const nowStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${hours12}${pad(d.getMinutes())}${pad(d.getSeconds())}${ampm}`;
        const safeName = (currentChat?.name || "chat").replace(/[^\w-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        fileName = `${safeName}_${nowStr}.pdf`;
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      if (response.ok) {
        showToast("PDF Downloaded successfully!", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to download PDF.", "error");
    }
  };

  const handleEmailPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread_id) {
      showToast("No chat selected to email.", "error");
      return;
    }

    setIsSendingEmail(true);

    try {
      const formData = new FormData();
      formData.append("email", emailAddress);

      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/threads/${thread_id}/email-pdf`, {
        method: 'POST',
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to send email");
      }

      setIsEmailModalOpen(false);
      setEmailAddress("");
      if (response.ok) {
        showToast("Email sent successfully!", "success");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      showToast("Failed to send email.", "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white px-4 py-4 border-l border-[#E2E8F0] dark:bg-[#171717] dark:border-[#3a3a3a] overflow-y-auto">
      {/* Export Chat Actions */}
      {thread_id && (
        <div className="mb-8">
          <h3 className="text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.1em] mb-3">
            Export Chat
          </h3>
          <div className="space-y-3">
            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-[14px] font-[700] text-[#00386B] bg-[#FFC20E] rounded-[10px] hover:bg-[#E6AE00] focus:outline-none focus-visible:outline-none transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] border-none"
            >
              <DocumentArrowDownIcon className="h-5 w-5 text-[#00386B]" />
              Download PDF
            </button>
            <button
              onClick={() => {
                if (!thread_id) {
                  showToast("Please select a chat to email.", "error");
                  return;
                }
                setIsEmailModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-[14px] font-[600] rounded-[10px] focus:outline-none focus-visible:outline-none transition-all"
              style={{
                background: 'transparent',
                border: '2px solid #2B93D1',
                color: '#2B93D1',
                boxShadow: 'none'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#2B93D1';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#2B93D1';
              }}
            >
              <EnvelopeIcon className="h-5 w-5" style={{ color: 'inherit' }} />
              Email PDF
            </button>
          </div>
        </div>
      )}

      {/* Account */}
      <div className="mb-8">
        <h3 className="text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.1em] mb-3">
          Account
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-[500] text-[#334155] bg-white border border-gray-200 rounded-lg hover:bg-[#F0F4F8] hover:text-[#00386B] focus:outline-none transition-colors"
          >
            <UserIcon className="h-5 w-5 text-[#2B93D1]" />
            Profile
          </button>
          <Link
            to="/plan"
            className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-[500] text-[#334155] bg-white border border-gray-200 rounded-lg hover:bg-[#F0F4F8] hover:text-[#00386B] focus:outline-none transition-colors"
          >
            <SparklesIcon className="h-5 w-5 text-[#2B93D1]" />
            Plan
          </Link>
          {hasPurchases && (
            <Link
              to="/billing/history"
              className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-[500] text-[#334155] bg-white border border-gray-200 rounded-lg hover:bg-[#F0F4F8] hover:text-[#00386B] focus:outline-none transition-colors"
            >
              <CreditCardIcon className="h-5 w-5 text-[#2B93D1]" />
              Purchase History
            </Link>
          )}
        </div>
      </div>

      {/* How to use */}
      <div className="mb-8">
        <h3 className="text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.1em] mb-3">
          Help
        </h3>
        <div className="space-y-2">
          {thread_id && (
            <div className="bg-white border border-gray-200 rounded-lg dark:bg-[#2a2a2a] dark:border-[#4a4a4a] overflow-hidden mb-2">
              <button
                onClick={() => setIsSupportChatsOpen(!isSupportChatsOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left focus:outline-none"
              >
                <div className="flex items-center gap-2 text-[14px] font-[500] text-[#334155] dark:text-[#ececec]">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 text-[#2B93D1] shrink-0 dark:text-[#8e8ea0]" />
                  Support Chats
                  {(() => {
                    const openCount = supportTickets.filter(t => t.status === 'open').length;
                    return openCount > 0 ? (
                      <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] rounded-full bg-[#00386B] text-[10px] font-[700] text-white">
                        {openCount}
                      </span>
                    ) : null;
                  })()}
                </div>
                {isSupportChatsOpen ? (
                  <ChevronUpIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
                )}
              </button>
              {isSupportChatsOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-[#3a3a3a]">
                  {/* New Request — filled button */}
                  <button
                    onClick={() => handleOpenSupport()}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 mb-2.5 text-[14px] font-[700] text-[#00386B] bg-[#FFC20E] rounded-[10px] hover:bg-[#E6AE00] transition-colors border-none"
                  >
                    <PlusIcon className="h-4 w-4 text-[#00386B]" />
                    New Request
                  </button>

                  {/* Filter chips */}
                  {supportTickets.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {(['all', 'open', 'closed'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setTicketFilter(f)}
                          className={`px-[14px] py-1 rounded-full text-[12px] capitalize transition-colors ${ticketFilter === f
                            ? 'bg-[#00386B] text-white font-[600] border-none'
                            : 'bg-transparent text-[#64748B] border border-[#E2E8F0] font-[500] hover:bg-[#F0F4F8] hover:text-[#00386B]'
                            }`}
                        >
                          {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Closed'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Ticket list */}
                  {(() => {
                    const filtered = supportTickets.filter(t =>
                      ticketFilter === 'all' || t.status === ticketFilter
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="text-xs text-gray-500 text-center py-2 dark:text-[#8e8ea0]">
                          {supportTickets.length === 0 ? 'No past chats' : `No ${ticketFilter} tickets`}
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                        {filtered.map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => handleOpenSupport(ticket.id)}
                            className="w-full flex items-center justify-between px-2 py-2 text-left rounded-md hover:bg-gray-50 dark:hover:bg-[#3a3a3a] transition-colors"
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <span
                                className="text-[13px] font-[500] text-[#1E293B] break-words"
                                title={ticket.label || `Support Chat #${(supportTickets.length - supportTickets.findIndex(t => t.id === ticket.id)).toString().padStart(2, '0')}`}
                              >
                                {ticket.label || `Support Chat #${(supportTickets.length - supportTickets.findIndex(t => t.id === ticket.id)).toString().padStart(2, '0')}`}
                              </span>
                              <span className="text-[11px] text-[#94A3B8] mt-0.5">
                                {format(new Date(ticket.created_at), "MMM d, yyyy · h:mm a")}
                              </span>
                            </div>
                            <span className={`ml-2 shrink-0 px-[10px] py-[2px] rounded-full text-[11px] font-semibold ${ticket.status === 'open'
                              ? 'bg-[#D1FAE5] text-[#065F46]'
                              : 'bg-gray-100 text-gray-600 dark:bg-[#3a3a3a] dark:text-[#8e8ea0]'
                              }`}>
                              {ticket.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg dark:bg-[#2a2a2a] dark:border-[#4a4a4a] overflow-hidden">
            <button
              onClick={() => setIsHowToUseOpen(!isHowToUseOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left focus:outline-none"
            >
              <span className="text-[14px] font-[500] text-[#334155] dark:text-[#ececec] pr-4">
                How to use this agent?
              </span>
              {isHowToUseOpen ? (
                <ChevronUpIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
              )}
            </button>
            {isHowToUseOpen && (
              <div className="px-3 pb-3 pt-1 text-[13px] leading-[1.6] text-[#64748B] dark:text-[#c5c5d2] border-t border-gray-100 dark:border-[#3a3a3a] space-y-2 [&_strong]:font-[700] [&_strong]:text-[#1E293B]">
                <p><strong>1. Ask questions:</strong> Type your query in the message box at the bottom and hit send.</p>
                <p><strong>2. Upload documents:</strong> Use the attachment icon to upload files you want the agent to analyze.</p>
                <p><strong>3. Export chats:</strong> Use the "Export Chat" options above to save or email your conversation.</p>
                <p><strong>4. Knowledge Base:</strong> Ensure your admin has configured the right Knowledge Base for accurate answers.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="flex-1">
        <h3 className="text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.1em] mb-3">
          Frequently Asked Questions
        </h3>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, index) => (
            <div key={index} className="bg-white border-b border-[#F1F5F9] dark:bg-[#2a2a2a] dark:border-[#4a4a4a] overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between px-3 py-3 text-left focus:outline-none"
              >
                <span className="text-[14px] font-[500] text-[#334155] dark:text-[#ececec] pr-4">
                  {item.question}
                </span>
                {openFaqIndex === index ? (
                  <ChevronUpIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-[#2B93D1] shrink-0" />
                )}
              </button>
              {openFaqIndex === index && (
                <div className="px-3 pb-3 pt-1 text-[13px] text-[#64748B] dark:text-[#c5c5d2] transition-all">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Email Modal */}
      <Transition.Root show={isEmailModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isSendingEmail && setIsEmailModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-[16px] bg-white px-4 pb-4 pt-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                  <div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-lg font-[700] leading-6 text-[#00386B]">
                        Email Chat as PDF
                      </Dialog.Title>
                      <div className="mt-2 text-center">
                        <p className="text-[14px] leading-[1.6] text-[#64748B]">
                          Please enter the email address where you would like to receive the PDF transcript of this chat.
                        </p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleEmailPDF} className="mt-5 sm:mt-6">
                    <div className="mt-5 sm:mt-6 space-y-4">
                      <div>
                        <label className="block text-[11px] font-[700] text-[#64748B] uppercase tracking-[0.08em] mb-2">
                          Email address
                        </label>
                        <input
                          type="email"
                          required
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          placeholder="johndoe@example.com"
                          className="block w-full rounded-[10px] border-[1.5px] border-[#CBD5E1] py-2.5 text-[14px] text-[#1E293B] bg-white placeholder:text-[#94A3B8] focus:border-[#2B93D1] focus:ring-[3px] focus:ring-[#2B93D1]/15 focus:outline-none transition-all shadow-sm px-3"
                        />
                      </div>
                    </div>
                    <div className="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        disabled={isSendingEmail}
                        className="sm:col-start-2 w-full flex items-center justify-center px-4 py-2.5 text-sm font-[700] text-white bg-[#00386B] rounded-[10px] hover:bg-[#00295A] transition-all shadow-[0_2px_8px_rgba(0,56,107,0.3)] border-none"
                      >
                        {isSendingEmail ? "Sending..." : "Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEmailModalOpen(false)}
                        disabled={isSendingEmail}
                        className="sm:col-start-1 mt-3 sm:mt-0 w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium text-[#334155] bg-transparent border-[1.5px] border-[#CBD5E1] rounded-[10px] hover:bg-[#F1F5F9] transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <SupportChatModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        initialContext={supportContext}
        ticketId={selectedTicketId}
        ticketLabel={currentChat?.name}
        onRequestCloseTicket={() => setIsConfirmModalOpen(true)}
        onTicketCreated={(id) => {
          setSelectedTicketId(id);
          fetchSupportTickets();
        }}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmCloseTicket}
        title="Mark as Resolved"
        message={(
          <>
            Are you sure you want to resolve this ticket for "{currentChat?.name || "Surtn Check"}" (Ticket:{" "}
            <span className="cursor-help border-b border-dotted border-gray-400 dark:border-gray-500" title={selectedTicketId}>
              {selectedTicketId?.split('-')[0]}...
            </span>
            )? You will no longer be able to send messages regarding this issue.
          </>
        )}
        confirmText={isClosingTicket ? "Resolving..." : "Mark as Resolved"}
        variant="success"
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
