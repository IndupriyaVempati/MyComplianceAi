import { useCallback, useEffect, useState } from "react";
import orderBy from "lodash/orderBy";
import { Chat } from "../types";

export interface ChatListProps {
  chats: Chat[] | null;
  createChat: (name: string, assistant_id: string) => Promise<Chat>;
  updateChat: (
    thread_id: string,
    name: string,
    assistant_id: string | null,
  ) => Promise<Chat>;
  deleteChat: (thread_id: string) => Promise<void>;
  touchChat: (thread_id: string) => void;
}

function updateChatsList(state: Chat[] | null, action: Chat | Chat[]): Chat[] {
  const currentState = state ?? [];
  let nextState: Chat[];
  if (!Array.isArray(action)) {
    const newChat = action;
    nextState = [
      ...currentState.filter((c) => c.thread_id !== newChat.thread_id),
      newChat,
    ];
  } else {
    nextState = action;
  }
  return orderBy(nextState, "updated_at", "desc");
}

export function useChatList(): ChatListProps {
  const [chats, setChats] = useState<Chat[] | null>(null);

  useEffect(() => {
    async function fetchChats() {
      const token = localStorage.getItem("auth_token");
      const fetchedChats = await fetch("/api/threads/", {
        headers: {
          Accept: "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
      }).then((r) => r.json());
      setChats(fetchedChats);
    }

    fetchChats();
  }, []);

  const createChat = useCallback(async (name: string, assistant_id: string) => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`/api/threads`, {
      method: "POST",
      body: JSON.stringify({ assistant_id, name }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
    });
    const saved = await response.json();
    setChats(prev => updateChatsList(prev, saved));
    return saved;
  }, []);

  const updateChat = useCallback(
    async (thread_id: string, name: string, assistant_id: string | null) => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/threads/${thread_id}`, {
        method: "PUT",
        body: JSON.stringify({ assistant_id, name }),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
      });
      const saved = await response.json();
      setChats(prev => updateChatsList(prev, saved));
      return saved;
    },
    [],
  );

  const deleteChat = useCallback(
    async (thread_id: string) => {
      const token = localStorage.getItem("auth_token");
      await fetch(`/api/threads/${thread_id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
      });
      setChats(prev => {
        if (!prev) return [];
        return updateChatsList(prev, prev.filter((c: Chat) => c.thread_id !== thread_id));
      });
    },
    [],
  );

  const touchChat = useCallback(
    (thread_id: string) => {
      setChats(prev => {
        if (!prev) return [];
        const updated = prev.map((c: Chat) =>
          c.thread_id === thread_id
            ? { ...c, updated_at: new Date().toISOString() }
            : c
        );
        return updateChatsList(prev, updated);
      });
    },
    [],
  );

  return {
    chats,
    createChat,
    updateChat,
    deleteChat,
    touchChat,
  };
}
