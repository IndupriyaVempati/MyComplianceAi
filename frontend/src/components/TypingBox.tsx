import {
  PaperAirplaneIcon,
  StopIcon,
  PaperClipIcon,
  XMarkIcon,
  DocumentTextIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../utils/cn";
import { Fragment, useCallback, useEffect, useRef, useState, ChangeEvent } from "react";
import { useDropzone } from "react-dropzone";
import { MessageWithFiles } from "../utils/formTypes.ts";
import { DROPZONE_CONFIG, TYPE_NAME } from "../constants.ts";
import { Config } from "../hooks/useConfigList.ts";
import { Chat } from "../types";
import { useToast } from "./Toast";

function getFileTypeIcon(fileType: string) {
  switch (fileType) {
    case "text/plain":
    case "text/csv":
    case "text/html":
      return <DocumentTextIcon className="h-4 w-4 text-gray-500 dark:text-[#8e8ea0]" />;
    default:
      return <DocumentIcon className="h-4 w-4 text-gray-500 dark:text-[#8e8ea0]" />;
  }
}

function convertBytesToReadableSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export default function TypingBox(props: {
  onSubmit: (data: MessageWithFiles) => void;
  onInterrupt?: () => void;
  inflight?: boolean;
  isDisabled?: boolean;
  currentConfig: Config;
  currentChat: Chat | null;
}) {
  const [inflight, setInflight] = useState(false);
  const isInflight = props.inflight || inflight || props.isDisabled;
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isDocumentRetrievalActive, setIsDocumentRetrievalActive] =
    useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { currentConfig, currentChat } = props;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, [message]);

  useEffect(() => {
    let configurable = null;
    if (currentConfig) {
      configurable = currentConfig.config?.configurable;
    }
    const agent_type = configurable?.["type"] as TYPE_NAME | null;
    if (agent_type === null || (agent_type as string) === "chatbot") {
      setIsDocumentRetrievalActive(false);
      return;
    }
    if (agent_type === "chat_retrieval") {
      setIsDocumentRetrievalActive(true);
      return;
    }
    const tools =
      (configurable?.["type==agent/tools"] as { name: string }[]) ?? [];
    setIsDocumentRetrievalActive(tools.some((t) => t.name === "Retrieval"));
  }, [currentConfig, currentChat]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prevFiles) => {
      const newFiles = acceptedFiles.filter(
        (acceptedFile) =>
          !prevFiles.some(
            (prevFile) =>
              prevFile.name === acceptedFile.name &&
              prevFile.size === acceptedFile.size,
          ),
      );
      return [...prevFiles, ...newFiles];
    });
  }, []);

  const { getInputProps } = useDropzone({
    ...DROPZONE_CONFIG,
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  // Dedicated file input ref for reliable multi-file picking
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) onDrop(selected);
    // Reset so the same file(s) can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const { show: showToast } = useToast();
  const handleSubmit = async () => {
    if (isInflight || !message.trim()) return;

    const previousMessage = message;
    const previousFiles = [...files];

    // Optimistically clear the UI immediately
    setMessage("");
    setFiles([]);
    setInflight(true);

    try {
      await props.onSubmit({ message: previousMessage, files: previousFiles });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Restore state if sending fails
      setMessage(previousMessage);
      setFiles(previousFiles);
      showToast("Failed to send message. Please try again.", "error");
    } finally {
      setInflight(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = message.trim().length > 0 && !isInflight;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Attached files preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {files.map((file) => (
            <Fragment key={file.name}>
              <div className="flex items-center gap-2 bg-[#F1F5F9] rounded-lg px-3 py-2 text-xs font-medium text-text-dark dark:bg-[#2f2f2f] dark:text-[#c5c5d2]">
                {getFileTypeIcon(file.type)}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-gray-500 dark:text-[#8e8ea0]">
                  {convertBytesToReadableSize(file.size)}
                </span>
                <button
                  onClick={() =>
                    setFiles((f) => f.filter((item) => item !== file))
                  }
                  className="ml-0.5 text-gray-400 hover:text-gray-900 transition-colors dark:text-[#8e8ea0] dark:hover:text-[#ececec]"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {/* Input pill */}
      <div
        className={cn(
          "relative flex items-end gap-2 bg-white rounded-[16px] px-2 py-2 border-[1.5px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all",
          "border-[#CBD5E1] focus-within:border-[#2B93D1] focus-within:ring-[3px] focus-within:ring-[#2B93D1]/15",
          isInflight && "opacity-80",
        )}
      >
        {/* Hidden file inputs */}
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.htm,.html,.doc,.docx"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        {/* Attach file button */}
        {isDocumentRetrievalActive && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 mb-0.5 p-1.5 text-[#94A3B8] hover:text-[#64748B] transition-colors"
            title="Attach file"
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
          placeholder={props.isDisabled ? "Subscription needed to continue chat." : "Ask anything"}
          readOnly={isInflight}
          className={cn(
            "flex-1 resize-none bg-transparent text-[#1E293B] placeholder:text-[#94A3B8] text-[15px]",
            "leading-relaxed outline-none border-none",
            "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:shadow-none",
            "min-h-[24px] max-h-[200px] py-0",
          )}
          style={{ fontFamily: 'Poppins' }}
        />

        <button
          type="button"
          onClick={
            props.onInterrupt
              ? () => props.onInterrupt?.()
              : handleSubmit
          }
          disabled={!canSend && !props.onInterrupt}
          className={cn(
            "shrink-0 mb-0.5 h-8 w-8 rounded-[10px] flex items-center justify-center transition-all",
            props.onInterrupt
              ? "bg-[#F1F5F9] text-[#1E293B] hover:bg-[#E2E8F0]"
              : canSend
                ? "bg-[#FFC20E] text-[#00386B] hover:bg-[#E6AE00] shadow-sm"
                : "bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#CBD5E1]/30",
          )}
        >
          {props.onInterrupt ? (
            <StopIcon className="h-4 w-4" />
          ) : (
            <PaperAirplaneIcon className={cn("h-4 w-4 rotate-[-45deg]", canSend ? "text-[#00386B]" : "text-[#94A3B8]")} />
          )}
        </button>
      </div>

      <div className="flex items-center justify-center mt-3">
        <p className="text-[12px] font-[400] text-[#94A3B8]">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
