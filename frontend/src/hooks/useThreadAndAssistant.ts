import { useQuery, useQueryClient } from "react-query";
import { useParams } from "react-router-dom";
import { getAssistant } from "../api/assistants";
import { getThread } from "../api/threads";

export function useThreadAndAssistant() {
  // Extract route parameters
  const { chatId, assistantId } = useParams();
  const queryClient = useQueryClient();

  // React Query to fetch chat details if chatId is present
  const { data: chatData, isLoading: isLoadingChat } = useQuery(
    ["thread", chatId],
    () => getThread(chatId as string),
    {
      enabled: !!chatId,
    },
  );

  // Only treat the chat as "current" if chatId is actually in the URL.
  // Without this guard, stale React Query cache causes currentChat to remain
  // truthy after navigating away from /thread/:id, so the app keeps rendering
  // <Chat> instead of <NewChat>.
  const currentChat = chatId ? chatData : undefined;

  // Determine the assistantId to use: route param takes priority, then chat
  const effectiveAssistantId = assistantId || (chatId ? chatData?.assistant_id : undefined);

  // React Query to fetch assistant configuration based on the effectiveAssistantId
  const { data: assistantConfig, isLoading: isLoadingAssistant } = useQuery(
    ["assistant", effectiveAssistantId],
    () => getAssistant(effectiveAssistantId as string),
    {
      enabled: !!effectiveAssistantId,
    },
  );

  const invalidateChat = (chatId: string) => {
    queryClient.invalidateQueries(["thread", chatId]);
  };

  // Return both loading states, the chat data, and the assistant configuration
  return {
    currentChat,
    assistantConfig,
    isLoading: isLoadingChat || isLoadingAssistant,
    isLoadingAssistant,
    invalidateChat,
  };
}
