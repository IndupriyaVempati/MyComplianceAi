import {
  PlusIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserIcon,
  BookOpenIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

import { ChatListProps } from "../hooks/useChatList";
import { cn } from "../utils/cn";
import { useThreadAndAssistant } from "../hooks/useThreadAndAssistant.ts";
import { ConfigListProps } from "../hooks/useConfigList.ts";
import { ConfirmModal } from "./ConfirmModal";
import { Chat } from "../types";
import { UserSettingsModal } from "./UserSettingsModal";

import { useToast } from "./Toast";

export function ChatList(props: {
  chats: ChatListProps["chats"];
  configs: ConfigListProps["configs"];
  enterChat: (id: string | null) => void;
  updateChat?: (thread_id: string, name: string, assistant_id: string | null) => Promise<Chat>;
  deleteChat: (id: string) => void;
  enterConfig: (id: string | null) => void;
  deleteConfig?: (id: string) => Promise<void>;
  admin?: boolean;
  onAdminHome?: () => void;
  onAdminChats?: () => void;
  onAdminUsers?: () => void;
  onAdminSupport?: () => void;
  onCreateKB?: () => void;
  onAdminChatWithKB?: () => void;
  isViewingAdminChats?: boolean;
  isViewingAdminUsers?: boolean;
  isViewingAdminSupport?: boolean;
  isCreatingAdmin?: boolean;
  isViewingAdminChatWithKB?: boolean;
}) {
  const { currentChat } = useThreadAndAssistant();
  const { show: showToast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleMenu, setVisibleMenu] = useState<string | null>(null);
  const [isAdminChatHistoryExpanded, setIsAdminChatHistoryExpanded] = useState(true);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const menuRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();
  const [planType, setPlanType] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
  });

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    navigate(props.admin ? "/admin/login" : "/login", { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisibleMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!props.admin) return;

    const fetchOpenTicketsCount = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/support/ticket", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          const count = data.filter((t: any) => t.status === "open").length;
          setOpenTicketsCount(count);
        }
      } catch (e) {
        console.error("Error fetching tickets count:", e);
      }
    };

    fetchOpenTicketsCount();
    const interval = setInterval(fetchOpenTicketsCount, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [props.admin]);

  useEffect(() => {
    if (props.admin) return;
    const fetchPlan = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlanType(data.plan_type ?? "freemium");
        }
      } catch { /* ignore */ }
    };
    fetchPlan();
  }, [props.admin]);

  const renderSearchAndChats = () => (
    <>
      {/* Search chats — only shown after 3+ chats */}
      {props.chats && props.chats.length >= 3 && (
      <div className="relative mt-1 mb-4">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon
            className="h-4 w-4 transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats…"
          className="w-full px-4 py-2 pl-9 pr-8 outline-none transition-all placeholder:text-white/40"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            color: '#FFFFFF',
            fontSize: '13px'
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-3 flex items-center text-[#FFFFFF]/40 hover:text-[#FFFFFF] transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      )}

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto min-h-0 slim-scrollbar -mr-3 pr-3">
        {(() => {
          if (!props.chats || props.chats.length === 0) return null;

          const query = searchQuery.trim().toLowerCase();
          const allChats = query
            ? props.chats.filter(c => c.name?.toLowerCase().includes(query))
            : props.chats;

          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const yesterday = today - 86400000;

          const todayChats = allChats.filter(c => new Date(c.updated_at).getTime() >= today);
          const yesterdayChats = allChats.filter(c => {
            const t = new Date(c.updated_at).getTime();
            return t >= yesterday && t < today;
          });
          const earlierChats = allChats.filter(c => new Date(c.updated_at).getTime() < yesterday);

          if (query && allChats.length === 0) {
            return (
              <p className="px-2 mt-3 text-xs text-gray-400 dark:text-[#8e8ea0]">
                No chats match &ldquo;{searchQuery}&rdquo;
              </p>
            );
          }

          const renderChat = (chat: Chat) => (
            <li
              key={chat.thread_id}
              className="relative flex items-center group rounded-lg transition-colors"
              style={
                chat.thread_id === currentChat?.thread_id
                  ? { background: 'rgba(255,255,255,0.12)' }
                  : {}
              }
            >
              <button
                onClick={() => !editingChatId && props.enterChat(chat.thread_id)}
                className="flex-1 min-w-0 flex flex-col px-2 py-[10px] text-left"
              >
                {editingChatId === chat.thread_id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={async () => {
                      if (editingName.trim() && editingName !== chat.name) {
                        await props.updateChat?.(chat.thread_id, editingName.trim(), chat.assistant_id);
                      }
                      setEditingChatId(null);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingChatId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white text-gray-900 border border-gray-300 dark:bg-[#171717] dark:text-[#ececec] dark:border-[#4a4a4a] text-sm rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#2B93D1]"
                  />
                ) : (
                  <span
                    title={chat.name}
                    className="text-sm truncate"
                    style={
                      chat.thread_id === currentChat?.thread_id
                        ? { color: '#FFFFFF', fontWeight: 600 }
                        : { color: 'rgba(255,255,255,0.7)', fontWeight: 500 }
                    }
                  >
                    {chat.name}
                  </span>
                )}
              </button>

              {/* Three-dot menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleMenu(
                    visibleMenu === chat.thread_id ? null : chat.thread_id,
                  );
                }}
                className={cn(
                  "p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#3a3a3a]",
                  visibleMenu === chat.thread_id
                    ? "opacity-100 text-gray-900 dark:text-[#ececec]"
                    : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-900 dark:text-[#8e8ea0] dark:hover:text-[#ececec]",
                )}
              >
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </button>

              {/* Dropdown */}
              {visibleMenu === chat.thread_id && (
                <div className="absolute right-0 top-full mt-0.5 z-50 w-36 rounded-lg bg-white border border-gray-200 shadow-xl py-1 dark:bg-[#2a2a2a] dark:border-[#3a3a3a]">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors dark:text-[#ececec] dark:hover:bg-[#3a3a3a]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat.thread_id);
                      setEditingName(chat.name);
                      setVisibleMenu(null);
                    }}
                  >
                    <PencilIcon className="h-4 w-4" />
                    Rename
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-gray-100 transition-colors dark:text-red-400 dark:hover:bg-[#3a3a3a]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModal({
                        isOpen: true,
                        title: "Delete Chat",
                        message: `Are you sure you want to delete chat "${chat.name}"? This action cannot be undone.`,
                        onConfirm: () => {
                          props.deleteChat(chat.thread_id);
                          showToast("Chat deleted successfully");
                        }
                      });
                      setVisibleMenu(null);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </li>
          );

          return (
            <ul className="space-y-4" ref={menuRef}>
              {todayChats.length > 0 && (
                <div>
                  <p
                    className="px-1 mb-1"
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    Today
                  </p>
                  <ul className="space-y-1">{todayChats.map(renderChat)}</ul>
                </div>
              )}
              {yesterdayChats.length > 0 && (
                <div>
                  <p
                    className="px-1 mb-1"
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    Yesterday
                  </p>
                  <ul className="space-y-1">{yesterdayChats.map(renderChat)}</ul>
                </div>
              )}
              {earlierChats.length > 0 && (
                <div>
                  <p
                    className="px-1 mb-1"
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    Earlier
                  </p>
                  <ul className="space-y-1">{earlierChats.map(renderChat)}</ul>
                </div>
              )}
            </ul>
          );
        })()}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-[#00386B] px-3 py-3">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
      />
      {/* App name + plan badge */}
      <div className="px-1 mb-3 flex items-center justify-between">
        <img
          src="/logo.png?v=4"
          alt="Surtn"
          style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
        />
        <span className="items-center gap-1 text-[20px] font-[800] text-[#FFFFFF] tracking-tight" style={{ display: 'none' }}>
          surtn<span className="text-[#FFC20E]">.</span>
        </span>
        {!props.admin && planType && (
          <Link
            to="/plan"
            className="inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer mt-[2px]"
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px 2px',
              lineHeight: 1,
              letterSpacing: '0.02em'
            }}
          >
            {planType !== "freemium" ? planType.charAt(0).toUpperCase() + planType.slice(1) : "Free"}
          </Link>
        )}
      </div>

      {!props.admin ? (
        <>
          {/* New Chat */}
          {(() => {
            const hasKB = props.configs && props.configs.length > 0;
            const isNewChat = !currentChat;
            const disabled = !hasKB || isNewChat;
            return (
              <div
                onClick={() => {
                  if (disabled) return;
                  navigate('/');
                }}
                className={cn(
                  "group flex items-center gap-2 px-[14px] py-[10px] w-full transition-all",
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "cursor-pointer hover:bg-white/[0.08] hover:rounded-[10px] hover:text-white",
                )}
                style={{
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: '0',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium transition-colors border-white/20 text-white/50 bg-white/5 group-hover:border-white/40 group-hover:text-white">
                  <PlusIcon className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </span>
                <span className="truncate">New Chat</span>
              </div>
            );
          })()}


          {renderSearchAndChats()}
        </>
      ) : (
        <div className="flex flex-col h-full gap-2 mt-2">
          {/* Chat History — top */}
          {props.onAdminChats && (
            <div
              onClick={props.onAdminChats}
              className={cn(
                "group flex items-center gap-x-3 rounded-lg px-3 py-[10px] leading-6 transition-all cursor-pointer",
                props.isViewingAdminChats
                  ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
              style={props.isViewingAdminChats ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={cn("w-5 h-5 shrink-0 transition-colors", props.isViewingAdminChats ? "text-white" : "text-white/50 group-hover:text-white")}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <span className="truncate text-sm font-medium">Chat History</span>
            </div>
          )}

          {/* Knowledge Base */}
          {props.configs && props.configs.length > 0 ? (
            <ul className="space-y-1 block">
              {props.configs.map((config) => (
                <li
                  key={config.assistant_id}
                  className="block relative"
                >
                  <button
                    onClick={() => props.enterConfig(config.assistant_id)}
                    className={cn(
                      "w-full flex items-center gap-x-3 rounded-lg px-3 py-[10px] text-left leading-6 transition-all group",
                      window.location.pathname.startsWith("/admin/assistant")
                        ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                    style={window.location.pathname.startsWith("/admin/assistant") ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
                  >
                    <BookOpenIcon className={cn("w-5 h-5 shrink-0 transition-colors", window.location.pathname.startsWith("/admin/assistant") ? "text-white" : "text-white/50 group-hover:text-white")} />
                    <span className="text-sm truncate font-medium flex-1">
                      Knowledge Base
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button
              onClick={props.onCreateKB}
              className={cn(
                "w-full flex items-center gap-x-3 rounded-lg px-3 py-[10px] text-left leading-6 transition-all group",
                props.isCreatingAdmin
                  ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
              style={props.isCreatingAdmin ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
            >
              <BookOpenIcon className={cn("w-5 h-5 shrink-0 transition-colors", props.isCreatingAdmin ? "text-white" : "text-white/50 group-hover:text-white")} />
              <span className="text-sm truncate font-medium flex-1">
                Knowledge Base
              </span>
            </button>
          )}

          {/* User Management */}
          {props.onAdminUsers && (
            <div
              onClick={props.onAdminUsers}
              className={cn(
                "group flex items-center gap-x-3 rounded-lg px-3 py-[10px] leading-6 transition-all cursor-pointer",
                props.isViewingAdminUsers
                  ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
              style={props.isViewingAdminUsers ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={cn("w-5 h-5 shrink-0 transition-colors", props.isViewingAdminUsers ? "text-white" : "text-white/50 group-hover:text-white")}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v-.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <span className="truncate text-sm font-medium">User Management</span>
            </div>
          )}

          {/* User Support */}
          {props.onAdminSupport && (
            <div
              onClick={props.onAdminSupport}
              className={cn(
                "group flex items-center gap-x-3 rounded-lg px-3 py-[10px] leading-6 transition-all cursor-pointer",
                props.isViewingAdminSupport
                  ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
              style={props.isViewingAdminSupport ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" className={cn("w-5 h-5 shrink-0 transition-colors", props.isViewingAdminSupport ? "text-white" : "text-white/50 group-hover:text-white")}>
                <rect width="256" height="256" fill="none" stroke="none" />
                <path d="M224,200v8a32,32,0,0,1-32,32H136" />
                <path d="M224,128H192a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16h32V128a96,96,0,1,0-192,0v56a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V144a16,16,0,0,0-16-16H32" />
              </svg>
              <div className="flex-1 flex items-center justify-between">
                <span className="truncate text-sm font-medium">User Support</span>
                {openTicketsCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#FFC20E] text-[11px] font-bold text-[#00386B] shadow-sm">
                    {openTicketsCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {props.onAdminChatWithKB && (
            <div className="block relative mt-1">
              <button
                onClick={props.onAdminChatWithKB}
                className={cn(
                  "w-full flex items-center gap-x-3 rounded-lg px-3 py-[10px] text-left leading-6 transition-all group",
                  props.isViewingAdminChatWithKB
                    ? "bg-white/10 text-white border-l-[3px] border-[#FFC20E]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                style={props.isViewingAdminChatWithKB ? { borderLeft: '3px solid #FFC20E', background: 'rgba(255,255,255,0.12)' } : {}}
              >
                <ChatBubbleBottomCenterTextIcon className={cn("w-5 h-5 shrink-0 transition-colors", props.isViewingAdminChatWithKB ? "text-white" : "text-white/50 group-hover:text-white")} />
                <span className="text-sm truncate font-medium flex-1">
                  Chat for Admin
                </span>
                {props.isViewingAdminChatWithKB && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAdminChatHistoryExpanded(!isAdminChatHistoryExpanded);
                    }}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors"
                  >
                    {isAdminChatHistoryExpanded ? (
                      <ChevronDownIcon className="w-4 h-4 text-white/60" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-white/60" />
                    )}
                  </div>
                )}
              </button>
              {props.isViewingAdminChatWithKB && isAdminChatHistoryExpanded && (
                <div className="mt-2 flex flex-col flex-1 overflow-y-auto min-h-0 border-t border-white/10 pt-2 max-h-[400px] slim-scrollbar -mr-3 pr-3">
                  <div
                    onClick={() => {
                      if (props.configs && props.configs.length > 0) {
                        navigate(`/admin/chat-with-kb/${props.configs[0].assistant_id}`);
                      }
                    }}
                    className="group flex items-center gap-x-3 rounded-[10px] mx-1 px-3 py-2 leading-6 transition-all cursor-pointer text-white/70 hover:text-white hover:bg-white/8"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium transition-colors border-white/20 text-white/50 bg-white/5 group-hover:border-white/40 group-hover:text-white">
                      <PlusIcon className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </span>
                    <span className="truncate text-sm font-medium">New Admin Chat</span>
                  </div>
                  {renderSearchAndChats()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 mt-auto pt-2 pb-1 px-1 border-t border-[#FFFFFF]/10">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div
            className="h-9 w-9 border border-[#FFFFFF]/10 shadow-sm flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', borderRadius: '50%', display: 'none' }}
          >
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0" style={{ display: 'none' }}>
            <p style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px', display: 'none' }} className="truncate leading-tight">
              User Name
            </p>
            <span
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 600,
                fontSize: '11px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '9999px',
                padding: '2px 10px',
                display: 'none',
                marginTop: '4px'
              }}
              className="uppercase tracking-wider"
            >
              Viewer
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all shrink-0 group/logout hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            title="Log out"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 group-hover/logout:text-[#FFC20E] transition-colors" />
            <span className="text-sm font-semibold group-hover/logout:text-[#FFC20E] transition-colors">
              Logout
            </span>
          </button>
        </div>
      </div>

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        admin={props.admin}
      />
    </div>
  );
}
