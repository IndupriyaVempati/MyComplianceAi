import { Chat } from "../types";

export async function getThread(threadId: string): Promise<Chat | null> {
  try {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`/api/threads/${threadId}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Chat;
  } catch (error) {
    console.error("Failed to fetch assistant:", error);
    return null;
  }
}
