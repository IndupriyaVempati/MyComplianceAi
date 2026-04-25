import { useCallback, useState, useEffect } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Chat } from "./components/Chat";
import { ChatList } from "./components/ChatList";
import { Layout } from "./components/Layout";
import { NewChat } from "./components/NewChat";
import { useChatList } from "./hooks/useChatList";
import { useSchemas } from "./hooks/useSchemas";
import { useStreamState } from "./hooks/useStreamState";
import {
  useConfigList,
  Config as ConfigInterface,
} from "./hooks/useConfigList";
import { Config } from "./components/Config";
import { MessageWithFiles } from "./utils/formTypes.ts";
import { useNavigate } from "react-router-dom";
import { useThreadAndAssistant } from "./hooks/useThreadAndAssistant.ts";
import { Message } from "./types.ts";
import { OrphanChat } from "./components/OrphanChat.tsx";
import { AdminHome } from "./components/AdminHome.tsx";
import { AdminChatsPage } from "./components/AdminChatsPage.tsx";
import { AdminUsers } from "./components/AdminUsers.tsx";
import { KBHistory } from "./components/KBHistory.tsx";
import { TrialModal } from "./components/TrialModal.tsx";
import { RightSidebar } from "./components/RightSidebar.tsx";
import { AdminSupport } from "./components/AdminSupport.tsx";
import { useToast } from "./components/Toast.tsx";

function App(props: { edit?: boolean; admin?: boolean }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [isViewingAdminChats, setIsViewingAdminChats] = useState(false);
  const [isViewingAdminUsers, setIsViewingAdminUsers] = useState(false);
  const [isViewingAdminSupport, setIsViewingAdminSupport] = useState(false);
  const [isViewingKBHistory, setIsViewingKBHistory] = useState(false);
  const { chats, createChat, updateChat, deleteChat, touchChat } = useChatList();
  const { configs, saveConfig, deleteConfig, deleteFile } = useConfigList();
  const { startStream, stopStream, stream } = useStreamState();
  const { configSchema, configDefaults } = useSchemas();
  const { currentChat, assistantConfig: urlAssistantConfig, isLoading, isLoadingAssistant } = useThreadAndAssistant();
  const { show: showToast } = useToast();

  // Do not auto-select the first bot for admins so they can see the home screen
  const assistantConfig = urlAssistantConfig || (props.admin ? undefined : (configs?.length ? configs[0] : undefined));
  const showEditConfig = props.admin || props.edit;
  const isViewingAdminChatWithKB = window.location.pathname.startsWith("/admin/chat-with-kb") || window.location.pathname.startsWith("/admin/thread") || (props.admin && !!currentChat);
  const [isInitialRouteApplied, setIsInitialRouteApplied] = useState(false);
  const isDataLoading = isLoading || (props.admin && (chats === null || configs === null));

  // If a specific bot is selected from the URL or sidebar, we are no longer in special admin modes
  useEffect(() => {
    if (urlAssistantConfig && !window.location.pathname.startsWith("/admin/chat-with-kb")) {
      setIsCreatingAdmin(false);
      setIsViewingAdminChats(false);
      setIsViewingAdminUsers(false);
      setIsViewingAdminSupport(false);
      setIsViewingKBHistory(false);
    }
  }, [urlAssistantConfig]);

  // Auto-route admin on first load: Chat History if chats exist, else KB Management
  useEffect(() => {
    if (!props.admin || isDataLoading) return;
    if (isInitialRouteApplied) return;
    
    // Check if we are already viewing a specific sub-page
    if (urlAssistantConfig || isCreatingAdmin || isViewingAdminChats || isViewingAdminUsers || isViewingAdminSupport || isViewingKBHistory || isViewingAdminChatWithKB) {
      setIsInitialRouteApplied(true);
      return;
    }

    if (chats && chats.length > 0) {
      setIsViewingAdminChats(true);
    } else if (configs && configs.length > 0) {
      navigate(`/admin/assistant/${configs[0].assistant_id}`, { replace: true });
    }
    
    setIsInitialRouteApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.admin, isDataLoading, chats, configs]);

  const startTurn = useCallback(
    async (
      message: MessageWithFiles | null,
      thread_id: string,
      assistantType: string,
      config?: Record<string, unknown>,
    ) => {
      const files = message?.files || [];
      if (files.length > 0) {
        const formData = files.reduce((formData, file) => {
          formData.append("files", file);
          return formData;
        }, new FormData());
        formData.append(
          "config",
          JSON.stringify({ configurable: { thread_id } }),
        );
        const token = localStorage.getItem("auth_token");
        await fetch(`/api/ingest`, {
          method: "POST",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: formData,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let input: Message[] | Record<string, any> | null = null;

      if (message) {
        // Set the input to an array of messages. This is the default input
        // format for all assistant types.
        input = [
          {
            content: message.message,
            additional_kwargs: files.length > 0
              ? { attached_files: files.map((f) => f.name) }
              : {},
            type: "human",
            example: false,
            id: `human-${Math.random()}`,
          },
        ];

        if (assistantType === "chat_retrieval") {
          // The RAG assistant type requires an object with a `messages` field.
          input = {
            messages: input,
          };
        }
      }

      await startStream(input, thread_id, config);
      // Bump updated_at so this chat floats to the top of the sidebar
      touchChat(thread_id);
    },
    [startStream, touchChat],
  );

  const startChat = useCallback(
    async (config: ConfigInterface, message: MessageWithFiles) => {
      const chat = await createChat(message.message, config.assistant_id);
      const assistantType = config.config.configurable?.type as string;
      // Start the stream BEFORE navigating so Chat mounts while stream is already inflight.
      // If navigate fired first, Chat would see stream=null and miss the inflight→done transition.
      const streamPromise = startTurn(message, chat.thread_id, assistantType);
      navigate(props.admin ? `/admin/thread/${chat.thread_id}` : `/thread/${chat.thread_id}`);
      return streamPromise;
    },
    [createChat, navigate, startTurn],
  );

  const selectChat = useCallback(
    async (id: string | null) => {
      if (currentChat) {
        stopStream?.(true);
      }
      if (!id) {
        // Prefer the currently selected assistant; fall back to the first config
        const targetAssistant =
          assistantConfig?.assistant_id ?? configs?.[0]?.assistant_id ?? null;
        // Use replace:true so React Router re-renders even if URL is the same
        if (props.admin) {
          navigate(targetAssistant ? `/admin/assistant/${targetAssistant}` : "/admin", { replace: true });
        } else {
          navigate(targetAssistant ? `/` : "/", { replace: true });
        }
        window.scrollTo({ top: 0 });
      } else {
        navigate(props.admin ? `/admin/thread/${id}` : `/thread/${id}`);
      }
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    },
    [currentChat, sidebarOpen, stopStream, assistantConfig, configs, navigate, props.admin],
  );

  const selectConfig = useCallback(
    (_id: string | null) => {
      if (!_id) return;
      if (props.admin && window.location.pathname.startsWith("/admin/chat-with-kb")) {
        navigate(`/admin/chat-with-kb/${_id}`);
      } else {
        navigate(props.admin ? `/admin/assistant/${_id}` : `/assistant/${_id}`);
      }
    },
    [navigate, props.admin],
  );

  const selectConfigFromSidebar = useCallback(
    (_id: string | null) => {
      if (!_id) return;
      navigate(props.admin ? `/admin/assistant/${_id}` : `/assistant/${_id}`);
    },
    [navigate, props.admin],
  );

  return (
    <>
      <Layout
        subtitle={
          assistantConfig ? (
            <span className="inline-flex gap-1 items-center">
              {assistantConfig.name}
              <InformationCircleIcon
                className="h-5 w-5 cursor-pointer text-indigo-600"
                onClick={() => {
                  selectConfig(assistantConfig.assistant_id);
                }}
              />
            </span>
          ) : currentChat ? currentChat.name : "New Chat"
        }
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        setRightSidebarOpen={setRightSidebarOpen}
        sidebar={
          <ChatList
            chats={chats}
            configs={configs}
            enterChat={selectChat}
            updateChat={updateChat}
            deleteChat={deleteChat}
            enterConfig={selectConfigFromSidebar}
            deleteConfig={deleteConfig}
            admin={props.admin}
            onAdminHome={() => {
              navigate("/admin");
              setIsCreatingAdmin(false);
              setIsViewingAdminChats(false);
              setIsViewingAdminUsers(false);
              setIsViewingAdminSupport(false);
              setIsViewingKBHistory(false);
            }}
            onCreateKB={() => {
              navigate("/admin");
              setIsCreatingAdmin(true);
              setIsViewingAdminChats(false);
              setIsViewingAdminUsers(false);
              setIsViewingAdminSupport(false);
              setIsViewingKBHistory(false);
            }}
            onAdminChats={() => {
              navigate("/admin");
              setIsCreatingAdmin(false);
              setIsViewingAdminChats(true);
              setIsViewingAdminUsers(false);
              setIsViewingAdminSupport(false);
              setIsViewingKBHistory(false);
            }}
            onAdminUsers={() => {
              navigate("/admin");
              setIsCreatingAdmin(false);
              setIsViewingAdminChats(false);
              setIsViewingAdminUsers(true);
              setIsViewingAdminSupport(false);
              setIsViewingKBHistory(false);
            }}
            onAdminSupport={() => {
              navigate("/admin");
              setIsCreatingAdmin(false);
              setIsViewingAdminChats(false);
              setIsViewingAdminUsers(false);
              setIsViewingAdminSupport(true);
              setIsViewingKBHistory(false);
            }}
            onAdminChatWithKB={() => {
              if (configs && configs.length > 0) {
                navigate(`/admin/chat-with-kb/${configs[0].assistant_id}`);
                setIsCreatingAdmin(false);
                setIsViewingAdminChats(false);
                setIsViewingAdminUsers(false);
                setIsViewingAdminSupport(false);
                setIsViewingKBHistory(false);
              } else {
                showToast("Please create a Knowledge Base first.", "error");
              }
            }}
            isViewingAdminChats={isViewingAdminChats}
            isViewingAdminUsers={isViewingAdminUsers}
            isViewingAdminSupport={isViewingAdminSupport}
            isCreatingAdmin={isCreatingAdmin}
            isViewingAdminChatWithKB={isViewingAdminChatWithKB}
          />
        }
        rightSidebar={props.admin ? undefined : <RightSidebar />}
      >
        {currentChat && assistantConfig && !isLoading && (
          <Chat startStream={startTurn} stopStream={stopStream} stream={stream} />
        )}
        {currentChat && !assistantConfig && !isLoadingAssistant && !isLoading && (
          <OrphanChat chat={currentChat} updateChat={updateChat} />
        )}
        {!currentChat && assistantConfig && (!showEditConfig || isViewingAdminChatWithKB) && (
          <NewChat
            startChat={startChat}
            configSchema={configSchema}
            configDefaults={configDefaults}
            configs={configs}
            saveConfig={saveConfig}
            enterConfig={selectConfig}
            deleteConfig={deleteConfig}
            deleteFile={deleteFile}
            currentAssistantConfig={assistantConfig}
          />
        )}
        {!currentChat && assistantConfig && showEditConfig && !isViewingAdminChatWithKB && (
          props.admin ? (
            <Config
              className="mb-6"
              config={assistantConfig}
              configSchema={configSchema}
              configDefaults={configDefaults}
              saveConfig={saveConfig}
              deleteConfig={deleteConfig}
              deleteFile={deleteFile}
              existingConfigs={configs}
              enterConfig={selectConfig}
              edit={true}
              onKBHistory={() => {
                navigate("/admin");
                setIsViewingKBHistory(true);
              }}
            />
          ) : (
            <div className="px-8 py-4">
              <Config
                className="mb-6"
                config={assistantConfig}
                configSchema={configSchema}
                configDefaults={configDefaults}
                saveConfig={saveConfig}
                deleteConfig={deleteConfig}
                deleteFile={deleteFile}
                existingConfigs={configs}
                enterConfig={selectConfig}
                edit={true}
              />
            </div>
          )
        )}
        {!currentChat && !assistantConfig && !isLoading && props.admin && isCreatingAdmin && !isViewingAdminChats && !isViewingAdminUsers && (
          <Config
            config={null}
            configSchema={configSchema}
            configDefaults={configDefaults}
            saveConfig={saveConfig}
            deleteConfig={deleteConfig}
            existingConfigs={configs}
            enterConfig={selectConfig}
          />
        )}
        {!currentChat && !assistantConfig && !isDataLoading && props.admin && isInitialRouteApplied && !isCreatingAdmin && !isViewingAdminChats && !isViewingAdminUsers && !isViewingAdminSupport && !isViewingKBHistory && !isViewingAdminChatWithKB && (
          <AdminHome
            onCreateRag={() => {
              if (configs && configs.length > 0) {
                showToast("A knowledge base already exists. Only one can exist at a time. Please delete the previous knowledge base before creating a new one. Or Edit the existing knowledge base.", "error");
              } else {
                setIsCreatingAdmin(true);
              }
            }}
            onAdminChats={() => setIsViewingAdminChats(true)}
            onAdminUsers={() => setIsViewingAdminUsers(true)}
            onAdminKBHistory={() => setIsViewingKBHistory(true)}
          />
        )}
        {!currentChat && !assistantConfig && !isLoading && props.admin && isViewingAdminChats && !isViewingAdminUsers && (
          <AdminChatsPage />
        )}
        {!currentChat && !assistantConfig && !isLoading && props.admin && isViewingAdminUsers && !isViewingAdminSupport && (
          <AdminUsers />
        )}
        {!currentChat && !assistantConfig && !isLoading && props.admin && isViewingAdminSupport && (
          <AdminSupport />
        )}
        {!currentChat && !assistantConfig && !isLoading && props.admin && isViewingKBHistory && (
          <KBHistory onBack={() => {
            setIsViewingKBHistory(false);
            if (configs && configs.length > 0) {
              navigate(`/admin/assistant/${configs[0].assistant_id}`);
            }
          }} />
        )}
        {!currentChat && !assistantConfig && !isLoading && !props.admin && (
          <div className="px-8 py-4 flex items-center justify-center text-gray-500 dark:text-[#8e8ea0]">
            Waiting for the admin to configure the Knowledge Base...
          </div>
        )}
        {(isDataLoading || (props.admin && !isInitialRouteApplied)) && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-gray-500 dark:text-[#8e8ea0]">Initializing session...</p>
          </div>
        )}
      </Layout>
      <TrialModal />
    </>
  );
}

export default App;
