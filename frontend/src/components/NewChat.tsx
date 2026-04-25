import TypingBox from "./TypingBox";
import { Schemas } from "../hooks/useSchemas";
import {
  ConfigListProps,
  Config as ConfigInterface,
} from "../hooks/useConfigList";
import { MessageWithFiles } from "../utils/formTypes.ts";
import { useThreadAndAssistant } from "../hooks/useThreadAndAssistant.ts";

interface NewChatProps extends ConfigListProps {
  configSchema: Schemas["configSchema"];
  configDefaults: Schemas["configDefaults"];
  enterConfig: (id: string | null) => void;
  deleteConfig: (id: string) => Promise<void>;
  currentAssistantConfig?: ConfigInterface;
  startChat: (
    config: ConfigInterface,
    message: MessageWithFiles,
  ) => Promise<void>;
}

export function NewChat(props: NewChatProps) {
  const { isLoading } = useThreadAndAssistant();
  const assistantConfig = props.currentAssistantConfig;

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm dark:text-[#8e8ea0]">
        Loading...
      </div>
    );

  if (!assistantConfig)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm dark:text-[#8e8ea0]">
        Please ask the admin to configure the bot.
      </div>
    );

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Welcome screen — fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        <h1 className="text-[28px] font-[700] text-[#00386B] mb-8 tracking-[-0.02em] dark:text-[#ececec]">
          What can I help you with?
        </h1>

        {/* Input pinned to bottom of the centered column */}
        <div className="w-full max-w-3xl">
          <TypingBox
            onSubmit={async (msg: MessageWithFiles) => {
              if (assistantConfig) {
                await props.startChat(assistantConfig, msg);
              }
            }}
            currentConfig={assistantConfig}
            currentChat={null}
          />
        </div>
      </div>
    </div>
  );
}
