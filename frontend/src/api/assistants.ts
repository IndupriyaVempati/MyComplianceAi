import { Config } from "../hooks/useConfigList";

export async function getAssistant(
  assistantId: string,
): Promise<Config | null> {
  try {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`/api/assistants/${assistantId}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Config;
  } catch (error) {
    console.error("Failed to fetch assistant:", error);
    return null;
  }
}

export async function getAssistants(): Promise<Config[] | null> {
  try {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`/api/assistants/`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Config[];
  } catch (error) {
    console.error("Failed to fetch assistants:", error);
    return null;
  }
}
