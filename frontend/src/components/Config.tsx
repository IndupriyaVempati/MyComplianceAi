import { Fragment, useCallback, useEffect, useState, useRef } from "react";
import { ShareIcon, TrashIcon as TrashIconOutline } from "@heroicons/react/24/outline";
import { useDropzone } from "react-dropzone";
import { orderBy, last } from "lodash";
import { v4 as uuidv4 } from "uuid";

import {
  ConfigListProps,
  Config as ConfigInterface,
} from "../hooks/useConfigList";
import { SchemaField, Schemas } from "../hooks/useSchemas";
import { cn } from "../utils/cn";
import { FileUploadDropzone } from "./FileUpload";
import { Combobox, Disclosure, Transition } from "@headlessui/react";
import { DROPZONE_CONFIG, TYPES } from "../constants";
import { Tool, ToolConfig, ToolSchema } from "../utils/formTypes.ts";
import { useToolsSchemas } from "../hooks/useToolsSchemas.ts";
import { Toast, useToast } from "./Toast";
import {
  ChevronUpDownIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  RocketLaunchIcon,
} from "@heroicons/react/20/solid";
import { marked } from "marked";
import { ConfirmModal } from "./ConfirmModal";


function Types(props: {
  field: SchemaField;
  value: string;
  readonly: boolean;
  setValue: (value: string) => void;
  alwaysExpanded?: boolean;
}) {
  const options =
    props.field.enum
      ?.map((id) => TYPES[id as keyof typeof TYPES])
      .filter(Boolean) ?? [];
  return (
    <div className="-mx-8 mb-8">
      <div className="mx-8 md:hidden">
        <label htmlFor="tabs" className="sr-only">
          Select a tab
        </label>
        <select
          id="tabs"
          name="tabs"
          className={cn(
            "block w-full rounded-md bg-white border-gray-300 text-gray-900 focus:border-[#2B93D1] focus:ring-[#2B93D1] dark:bg-[#2f2f2f] dark:border-[#3a3a3a] dark:text-[#ececec]",
          )}
          defaultValue={options.find((o) => o.id === props.value)?.id}
          onChange={(e) => props.setValue(e.target.value)}
          disabled={props.readonly}
        >
          {options.map((option) => (
            <option key={option.id}>{option.title}</option>
          ))}
        </select>
      </div>
      <div className="mx-8 hidden md:block">
        <div className="border-b border-gray-200 dark:border-[#3a3a3a]">
          <nav className="-mb-px flex justify-center" aria-label="Tabs">
            {options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  props.value === option.id
                    ? "border-[#2B93D1] text-[#00386B] dark:text-white"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-[#b4b4b4] dark:hover:border-[#555] dark:hover:text-white",
                  "border-b-2 py-4 px-8 text-center text-sm font-medium transition-colors",
                  props.readonly
                    ? props.value === option.id
                      ? "cursor-default"
                      : "cursor-default opacity-50 pointer-events-none"
                    : "cursor-pointer",
                )}
                aria-current={props.value === option.id ? "page" : undefined}
                onClick={
                  !props.readonly ? () => props.setValue(option.id) : undefined
                }
                aria-disabled={props.readonly}
              >
                {option.title}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

function Label(props: { id?: string; title: string; description?: string }) {
  return (
    <label
      htmlFor={props.id}
      className="flex flex-col font-medium leading-6 text-gray-700 dark:text-[#a1a1aa] mb-2"
    >
      <div>{props.title}</div>
      {props.description && (
        <div className="font-normal text-sm text-gray-500 dark:text-[#6b6b7b] whitespace-pre-line">
          {props.description}
        </div>
      )}
    </label>
  );
}

function StringField(props: {
  id: string;
  field: SchemaField;
  value: string;
  title: string;
  readonly: boolean;
  setValue: (value: string) => void;
}) {
  return (
    <div>
      <Label
        id={props.id}
        title={props.title}
        description={props.field.description}
      />
      <textarea
        rows={4}
        name={props.id}
        id={props.id}
        className="block w-full rounded-md border-0 py-1.5 bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#2B93D1] sm:text-sm sm:leading-6 dark:bg-[#2f2f2f] dark:text-[#ececec] dark:ring-[#3a3a3a] dark:placeholder:text-[#8e8ea0] dark:focus:ring-[#2B93D1]"
        value={props.value}
        readOnly={props.readonly}
        disabled={props.readonly}
        onChange={(e) => props.setValue(e.target.value)}
      />
    </div>
  );
}

export default function SingleOptionField(props: {
  id: string;
  field: SchemaField;
  value: string;
  title: string;
  readonly: boolean;
  setValue: (value: string) => void;
}) {
  return (
    <div>
      <Label
        id={props.id}
        title={props.field.title}
        description={props.field.description}
      />
      <fieldset>
        <legend className="sr-only">{props.field.title}</legend>
        <div className="space-y-2">
          {orderBy(props.field.enum)?.map((option) => (
            <div key={option} className="flex items-center">
              <input
                id={`${props.id}-${option}`}
                name={props.id}
                type="radio"
                checked={option === props.value}
                className="h-4 w-4 border-gray-300 bg-white text-[#00386B] focus:ring-[#2B93D1] dark:border-[#3a3a3a] dark:bg-[#2f2f2f] dark:text-[#2B93D1] dark:focus:ring-[#2B93D1]"
                disabled={props.readonly}
                onChange={() => props.setValue(option)}
              />
              <label
                htmlFor={`${props.id}-${option}`}
                className="ml-3 block leading-6 text-gray-700 dark:text-[#d4d4d8]"
              >
                {option}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

const ToolDisplay = (props: {
  tool: Tool;
  onRemoveTool: () => void;
  onUpdateToolConfig: (conf: ToolConfig) => void;
  readonly: boolean;
}) => {
  const { tool, onRemoveTool, onUpdateToolConfig, readonly } = props;
  const confs = Object.entries(tool.config);
  return (
    <Disclosure
      as="div"
      key={"tool-" + tool.id}
      className="flex flex-col max-w-2xl p-2 mt-2 mb-2 border rounded-md border-gray-200 bg-gray-50 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
      defaultOpen={!readonly}
    >
      {({ open }) => (
        <>
          <div className="flex">
            {Object.keys(tool.config).length > 0 ? (
              <Disclosure.Button className="text-sm leading-6 flex justify-between items-center mr-2">
                {open ? (
                  <MinusIcon className="w-5 h-5 text-gray-500 hover:text-[#2B93D1]" />
                ) : (
                  <PlusIcon className="w-5 h-5 text-gray-500 hover:text-[#2B93D1]" />
                )}
              </Disclosure.Button>
            ) : (
              <div className="text-sm leading-6 flex justify-between items-center mr-2">
                <RocketLaunchIcon className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div className="flex flex-col flex-auto">
              <label>{tool.name}</label>
              {tool.description && (
                <div
                  className="text-gray-500 prose prose-sm prose-a:text-gray-500 dark:text-gray-400 dark:prose-a:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: marked(tool.description),
                  }}
                ></div>
              )}
            </div>
            {!readonly && (
              <button
                onClick={onRemoveTool}
                className={
                  "text-gray-400" + (readonly ? "" : " hover:text-red-600")
                }
              >
                <TrashIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          {confs.length > 0 && (
            <Disclosure.Panel className="pt-4 flex flex-col mb-2 pl-5 pr-5">
              {confs.map(([key, value]) => (
                <div className="flex flex-col pt-2" key={key}>
                  <label
                    htmlFor={`${tool.id}-${key}`}
                    className="pl-2 prose-sm"
                  >
                    {key}
                  </label>
                  <input
                    id={`${tool.id}-${key}`}
                    value={value}
                    onChange={(e) =>
                      onUpdateToolConfig({ [key]: e.target.value })
                    }
                    className="rounded-md border-gray-300 shadow-sm prose-sm dark:bg-[#2f2f2f] dark:border-[#555] dark:text-[#ececec]"
                    autoComplete="off"
                    readOnly={readonly}
                  />
                </div>
              ))}
            </Disclosure.Panel>
          )}
        </>
      )}
    </Disclosure>
  );
};

function ToolSelectionField(props: {
  readonly: boolean;
  retrievalOn: boolean;
  selectedTools: Tool[];
  onAddTool: (tool: Tool) => void;
  onRemoveTool: (toolId: string) => void;
  onUpdateToolConfig: (
    toolId: string,
    config: {
      [key: string]: string;
    },
  ) => void;
}) {
  const { onAddTool, onRemoveTool, retrievalOn, selectedTools } = props;
  const { tools: availableTools, loading } = useToolsSchemas();
  const [query, setQuery] = useState("");
  const [filteredTools, setFilteredTools] = useState<ToolSchema[]>([]);

  const handleSelectTool = useCallback(
    (toolSchema: ToolSchema) => {
      // Initialize config object based on ToolSchema
      const config: { [key: string]: string } = {};
      Object.keys(toolSchema.config.properties).forEach((key) => {
        const property = toolSchema.config.properties[key];
        // Use the default value if specified, otherwise initialize to an empty string
        config[key] = property.default || "";
      });

      // Create a new tool object with initialized config
      const tool: Tool = {
        id: toolSchema.name === "Retrieval" ? "retrieval" : uuidv4(),
        type: toolSchema.type,
        name: toolSchema.name,
        description: toolSchema.description,
        config: config,
      };

      onAddTool(tool);
      setQuery(""); // Clear the query
    },
    [onAddTool],
  );

  useEffect(() => {
    const retrieval = availableTools.find((t) => t.name === "Retrieval");
    if (!retrieval) return;
    const retrievalSelected = selectedTools.some((t) => t.name === "Retrieval");
    if (retrievalOn && !retrievalSelected) {
      handleSelectTool(retrieval);
    }
    if (!retrievalOn && retrievalSelected) {
      onRemoveTool("retrieval");
    }
  }, [
    retrievalOn,
    onRemoveTool,
    availableTools,
    handleSelectTool,
    selectedTools,
  ]);

  useEffect(() => {
    let toolSchemas = availableTools.filter(
      (tool) => tool.name !== "Retrieval",
    );
    if (query !== "") {
      toolSchemas = toolSchemas.filter((tool) =>
        tool.name
          .toLowerCase()
          .replace(/\s+/g, "")
          .includes(query.toLowerCase().replace(/\s+/g, "")),
      );
    }
    toolSchemas = toolSchemas.filter(
      (tool) =>
        !selectedTools.some((t) => t.name === tool.name && !tool.multiUse),
    );
    setFilteredTools(toolSchemas);
  }, [query, availableTools, selectedTools]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Label title="Tools" />
      {props.selectedTools.map((t) => (
        <ToolDisplay
          key={`tool-display-${t.id}`}
          tool={t}
          onRemoveTool={() => props.onRemoveTool(t.id)}
          onUpdateToolConfig={(conf) => props.onUpdateToolConfig(t.id, conf)}
          readonly={props.readonly || t.name === "Retrieval"}
        />
      ))}
      <div className="w-full max-w-2xl">
        <Combobox value={null} onChange={handleSelectTool}>
          <div className="relative mt-1">
            <div className="relative mt-1">
              <div className="w-full h-10 border border-gray-300 bg-white py-2 text-sm leading-5 text-gray-900 rounded-md flex items-center dark:border-[#3a3a3a] dark:bg-[#2f2f2f] dark:text-[#ececec]">
                <Combobox.Button as="div" className="relative flex-grow">
                  <Combobox.Input
                    className="w-full h-full rounded-md focus:outline-none focus:ring-2 focus:ring-[#2B93D1] focus:border-[#2B93D1] border-0 bg-transparent text-gray-900 placeholder-gray-400 text-sm dark:focus:ring-[#2B93D1] dark:focus:border-[#2B93D1] dark:text-[#ececec] dark:placeholder-[#8e8ea0]"
                    onChange={(event) => setQuery(event.target.value)}
                    displayValue={() => query}
                    placeholder="Add a tool"
                    autoComplete="off"
                    readOnly={props.readonly}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400 dark:text-[#a1a1aa]"
                      aria-hidden="true"
                    />
                  </span>
                </Combobox.Button>
              </div>
            </div>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white border border-gray-200 py-1 text-base shadow-xl focus:outline-none sm:text-sm dark:bg-[#2a2a2a] dark:border-[#3a3a3a]">
                {filteredTools.length === 0 && query !== "" ? (
                  <div className="relative cursor-default select-none py-2 px-4 text-gray-500 dark:text-[#8e8ea0]">
                    Nothing found.
                  </div>
                ) : (
                  filteredTools.map((tool) => (
                    <Combobox.Option
                      key={"tool-schema-" + tool.name}
                      value={tool}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-2 pr-4 ${active ? "bg-[#00386B] text-white dark:bg-[#3a3a3a] dark:text-[#ececec]" : "text-gray-900 dark:text-[#c5c5d2]"}`
                      }
                    >
                      <span className={`block truncate font-normal`}>
                        {tool.name}
                      </span>
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
        </Combobox>
      </div>
    </div>
  );
}

function PublicLink() {
  const link = window.location.href;
  return (
    <div className="flex rounded-md shadow-sm mb-4">
      <button
        type="submit"
        className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-l-md px-3 py-2 text-sm font-semibold text-gray-900 border border-gray-300 hover:bg-gray-50 bg-white dark:text-[#ececec] dark:border-[#3a3a3a] dark:hover:bg-[#3a3a3a] dark:bg-[#2f2f2f]"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await navigator.clipboard.writeText(link);
          window.alert("Copied to clipboard!");
        }}
      >
        <ShareIcon
          className="-ml-0.5 h-5 w-5 text-gray-400 dark:text-[#8e8ea0]"
          aria-hidden="true"
        />
        Copy Public Link
      </button>
      <a
        className="rounded-none rounded-r-md py-1.5 px-2 text-[#00386B] border border-l-0 border-gray-300 text-sm leading-6 line-clamp-1 flex-1 underline bg-white dark:text-[#7aa2f7] dark:border-[#3a3a3a] dark:bg-[#2f2f2f]"
        href={link}
      >
        {link}
      </a>
    </div>
  );
}


function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const ORDER = [
  "system_message",
  "retrieval_description",
  "interrupt_before_action",
  "tools",
  "llm_type",
  "agent_type",
];

function assignDefaults(
  config: ConfigInterface["config"] | undefined | null,
  configDefaults: Schemas["configDefaults"],
) {
  return config
    ? {
      ...config,
      configurable: {
        ...configDefaults?.configurable,
        ...config.configurable,
      },
    }
    : configDefaults;
}

export function Config(props: {
  className?: string;
  configSchema: Schemas["configSchema"];
  configDefaults: Schemas["configDefaults"];
  config: ConfigInterface | null;
  saveConfig: ConfigListProps["saveConfig"];
  deleteConfig?: (id: string) => Promise<void>;
  deleteFile?: (assistantId: string, filename: string) => Promise<void>;
  existingConfigs?: ConfigListProps["configs"];
  enterConfig: (id: string | null) => void;
  edit?: boolean;
  onKBHistory?: () => void;
}) {
  const [values, setValues] = useState(
    assignDefaults(props.config?.config, props.configDefaults),
  );
  const [error, setError] = useState<string | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();
  // Auto-clear inline error after 3.5s (toast already fires alongside)
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const typeKey = "type";
  const typeField =
    props.configSchema?.properties.configurable.properties[typeKey];
  const typeValue = values?.configurable?.[typeKey] ?? "chat_retrieval";
  // Ensure the type is always set in configurable so conditional fields render
  if (values?.configurable && !values.configurable[typeKey]) {
    values.configurable[typeKey] = "chat_retrieval";
  }
  const typeSpec = (typeValue ? TYPES[typeValue as keyof typeof TYPES] : null) || TYPES["chat_retrieval"];
  const [files, setFiles] = useState<File[]>([]);

  // Existing files currently mapped to the bot
  const [existingFiles, setExistingFiles] = useState<string[]>(
    (props.config?.config?.configurable?.["type==chat_retrieval/files"] as string[]) || []
  );
  // Files marked for deletion
  const [deletedFiles, setDeletedFiles] = useState<string[]>([]);
  const [kbHistory, setKbHistory] = useState<{ file_name: string; created_at: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"default" | "uploads">("uploads");
  const [defaultFiles, setDefaultFiles] = useState<{ name: string, created_at: number }[]>([]);
  const [loadingDefaultFiles, setLoadingDefaultFiles] = useState(false);

  useEffect(() => {
    if (activeTab === "default" && defaultFiles.length === 0 && !loadingDefaultFiles) {
      setLoadingDefaultFiles(true);
      const token = localStorage.getItem("auth_token");
      fetch("/api/admin/default-files", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setDefaultFiles(data))
        .catch((err) => console.error("Failed to fetch default files", err))
        .finally(() => setLoadingDefaultFiles(false));
    }
  }, [activeTab]);

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const newExisting = existingFiles.filter((f) => f !== fileToDelete);
    const newDeleted = [...deletedFiles, fileToDelete];
    setExistingFiles(newExisting);
    setDeletedFiles(newDeleted);
    setFileToDelete(null);
    await handleSave(files, newExisting, newDeleted);
  };

  const handleSave = async (
    filesToSave: File[] = files,
    currentExistingFiles: string[] = existingFiles,
    filesToDelete: string[] = deletedFiles
  ) => {
    const key = props.config?.name || "Knowledge Base";
    if (typeValue === "chat_retrieval" && filesToSave.length === 0 && currentExistingFiles.length === 0 && !props.config?.assistant_id) {
      setError("Please upload at least one file before saving.");
      showToast("Please upload at least one file.", "error");
      return;
    }
    setError(null);
    setInflight(true);
    const vals = { ...values };
    if (vals?.configurable) {
      vals.configurable = { ...vals.configurable };
      vals.configurable["type==agent/tools"] = [...selectedTools];

      // Default LLM type if not set
      if (!vals.configurable["type==chat_retrieval/llm_type"]) {
        vals.configurable["type==chat_retrieval/llm_type"] = "Qwen 3 (Local)";
      }

      // Hardcode strict document instruction
      vals.configurable["type==chat_retrieval/system_message"] = "You are a helpful assistant. You must ONLY answer questions based on the provided document. If a question is asked that cannot be answered using the information within the document, or is outside the scope of the document, you MUST reply exactly with 'this is out of my scope.' Do not use any outside knowledge. When answering, you MUST append a citation at the end of the sentence or paragraph in the exact format: `[Source: document_name.pdf, Page: X]` based on the source metadata provided above each piece of context.";

      // Save the tracked files list
      vals.configurable["type==chat_retrieval/files"] = [
        ...currentExistingFiles,
        ...filesToSave.map(f => f.name)
      ];

      // Strip internal fields that cause backend 500
      const INTERNAL_KEYS = ["assistant_id", "checkpoint_id", "thread_id", "checkpoint_ns"];
      for (const k of INTERNAL_KEYS) {
        delete vals.configurable[k];
      }

      setSelectedTools([]);
    }
    try {
      // Delete marked files sequentially
      if (props.deleteFile && props.config?.assistant_id && filesToDelete.length > 0) {
        for (const filename of filesToDelete) {
          await props.deleteFile(props.config.assistant_id, filename);
        }
        setDeletedFiles([]); // Reset deletion queue after success
      }

      const assistantId = await props.saveConfig(
        key,
        vals!,
        filesToSave,
        false,
        props.config?.assistant_id,
      );
      props.enterConfig(assistantId);
      setInflight(false);
      if (filesToDelete.length > 0) {
        filesToDelete.forEach(filename =>
          showToast(`"${filename}" deleted successfully`)
        );
      } else if (filesToSave.length > 0) {
        filesToSave.forEach(file =>
          showToast(`"${file.name}" uploaded successfully`)
        );
      } else if (!props.config?.assistant_id) {
        showToast("Knowledgebase created successfully");
      }

      // Soft reload existing files view
      if (filesToSave.length > 0) {
        setExistingFiles(prev => [...prev, ...filesToSave.map(f => f.name)]);
        setFiles([]);
        await fetchKbHistory(); // Fetch new history to get the Created On dates
      }
    } catch (err) {
      setInflight(false);
      setError("Failed to save. Please try again.");
      showToast("Failed to save. Please try again.", "error");
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const acceptedFileIds = acceptedFiles.map(fileId);
      const newFiles = [
        ...files.filter((f) => !acceptedFileIds.includes(fileId(f))),
        ...acceptedFiles,
      ];
      setFiles(newFiles);
      await handleSave(newFiles, existingFiles, deletedFiles);
    }
  };

  const onDropRejected = (fileRejections: any[]) => {
    const errorMessages = fileRejections.map(rejection => {
      if (rejection.errors[0]?.code === "file-too-large") {
        return `"${rejection.file.name}" is too large (max 10MB)`;
      }
      return `"${rejection.file.name}": Unsupported format. Try PDF, DOC, DOCX, or TXT.`;
    });
    const msg = errorMessages.join(", ");
    setError(msg);
    showToast(msg, "error");
  };

  const dropzone = useDropzone({
    ...DROPZONE_CONFIG,
    onDrop,
    onDropRejected,
  });

  useEffect(() => {
    if (!values) return;
    if (!values.configurable) return;
    const tools = (values.configurable["type==agent/tools"] as Tool[]) ?? [];
    setSelectedTools((oldTools) =>
      oldTools !== tools ? [...tools] : oldTools,
    );
  }, [values]);

  const handleAddTool = (tool: Tool) => {
    setSelectedTools([...selectedTools, tool]);
    // Optionally trigger auto-save if we want the tool selected to be saved immediately.
    // For now we preserve behavior as before but there's no save button. If the user expects
    // tools to save, we'd need to call handleSave. Since they didn't mention it, we just
    // restore the missing code. Note: the `type==agent` doesn't seem to be used here
    // based on `typeValue === "chat_retrieval"`.
  };

  const handleRemoveTool = (toolId: string) => {
    setSelectedTools(selectedTools.filter((tool) => tool.id !== toolId));
  };

  const handleUpdateToolConfig = (toolId: string, config: ToolConfig) => {
    const updatedTools = selectedTools.map((tool) =>
      tool.id === toolId
        ? { ...tool, config: { ...tool.config, ...config } }
        : tool,
    );
    setSelectedTools(updatedTools);
  };

  useEffect(() => {
    setValues(assignDefaults(props.config?.config, props.configDefaults));
  }, [props.config, props.configDefaults]);

  const fetchKbHistory = useCallback(async () => {
    if (!props.config?.assistant_id) return;
    const token = localStorage.getItem("auth_token");
    try {
      const r = await fetch("/api/admin/kb-history", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = r.ok ? await r.json() : [];
      setKbHistory(data.filter((h: any) => h.action === "file_uploaded"));
    } catch (err) {
      console.error("Failed to fetch KB history", err);
    }
  }, [props.config?.assistant_id]);

  useEffect(() => {
    fetchKbHistory();
  }, [fetchKbHistory]);

  const [inflight, setInflight] = useState(false);
  const readonly = !!props.config && !props.edit && !inflight;

  const settings = !readonly ? (
    <>
      <input
        type="hidden"
        name="key"
        id="key"
        value={props.config?.name || "Knowledge Base"}
      />
    </>
  ) : (
    <>{props.config?.public && <PublicLink />}</>
  );
  // ─── Admin KB Management table view ──────────────────────────────────────
  if (props.edit || !props.config) {
    const getUploadDate = (filename: string): string => {
      const lower = filename.toLowerCase().trim();
      const entry = kbHistory.find((h) => {
        const hname = (h.file_name ?? "").toLowerCase().trim();
        // exact match or match on basename (strip any path prefix stored)
        return hname === lower || hname.split("/").pop() === lower;
      });
      if (!entry) return "—";
      return new Date(entry.created_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    return (
      <>
        <Toast toast={toast} onClose={hideToast} />

        <div className="flex-1 overflow-y-auto w-full h-full bg-[#F0F4F8]">
          <div className="w-full max-w-5xl mx-auto px-8 py-8">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-[24px] font-[700] text-[#00386B]">Knowledge Base Management</h1>
                <p className="text-[14px] text-[#64748B] mt-1">Upload and manage files used by the AI assistant.</p>
              </div>
              <div className="flex items-center gap-3">
                {props.config?.assistant_id && (
                  <button
                    type="button"
                    onClick={() => props.onKBHistory?.()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-[600] transition-all border-[2px] bg-transparent border-[#2B93D1] text-[#2B93D1] hover:bg-[#2B93D1] hover:text-white shadow-none group"
                  >
                    <svg className="h-[18px] w-[18px] transition-colors text-inherit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    History
                  </button>
                )}
                {activeTab === 'uploads' && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#FFC20E] hover:bg-[#E6AE00] text-[#00386B] text-[13px] font-[600] transition-all shadow-[0_2px_8px_rgba(255,194,14,0.3)] border-none"
                  >
                    <PlusIcon className="h-4 w-4 shrink-0" />
                    Upload File
                  </button>
                )}
              </div>
            </div>

            {/* Tabs and Actions */}
            <div className="flex items-center gap-6 mb-6">
              <div className="flex-1">
                <nav className="flex space-x-3" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('default')}
                    className={`px-[10px] py-[3px] rounded-full text-[13px] font-[500] transition-all border ${activeTab === 'default' ? 'bg-[#00386B] border-[#00386B] text-white' : 'bg-transparent border-[#E2E8F0] text-[#64748B] hover:bg-[#F0F4F8] hover:text-[#00386B]'}`}
                  >
                    Government Regulations
                  </button>
                  <button
                    onClick={() => setActiveTab('uploads')}
                    className={`px-[10px] py-[3px] rounded-full text-[13px] font-[500] transition-all border ${activeTab === 'uploads' ? 'bg-[#00386B] border-[#00386B] text-white' : 'bg-transparent border-[#E2E8F0] text-[#64748B] hover:bg-[#F0F4F8] hover:text-[#00386B]'}`}
                  >
                    My Uploads
                  </button>
                </nav>
              </div>

            </div>

            {/* Hidden file input triggered by the Upload File button */}
            <div {...dropzone.getRootProps()} style={{ display: "none" }}>
              <input {...dropzone.getInputProps()} ref={fileInputRef} />
            </div>

            {/* Full-page overlay loader shown during upload / delete */}
            {inflight && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9998,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <svg
                  style={{ width: 48, height: 48, animation: "spin 0.9s linear infinite" }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="3" strokeOpacity="0.25" />
                  <path
                    fill="#6366f1"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <p style={{ color: "#e0e0ff", fontSize: 15, fontWeight: 500, letterSpacing: "0.01em" }}>
                  Please wait…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === "default" && (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#3a3a3a]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#2a2a2a] text-left text-xs text-gray-500 dark:text-[#8e8ea0] uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium align-middle">Name</th>
                      <th className="px-6 py-4 font-medium text-center align-middle">Uploaded on</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {loadingDefaultFiles ? (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500 dark:text-[#8e8ea0]">Loading documents...</td></tr>
                    ) : defaultFiles.length === 0 ? (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500 dark:text-[#8e8ea0]">No documents found.</td></tr>
                    ) : (
                      defaultFiles.map((file) => (
                        <tr key={file.name} className="bg-white dark:bg-[#212121] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors">
                          <td className="px-6 py-3 text-gray-900 dark:text-[#ececec]">
                            <div className="flex items-center gap-2.5">
                              <svg className="h-4 w-4 shrink-0 text-[#00386B]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5z" />
                              </svg>
                              <span className="truncate text-sm font-medium" title={file.name}>{file.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-gray-500 dark:text-[#8e8ea0] whitespace-nowrap text-[13px] text-center align-middle">
                            {new Date(file.created_at).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "uploads" && (
              <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                <table className="min-w-full divide-y divide-[#F1F5F9]">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="text-left text-[11px] font-bold text-[#64748B] uppercase tracking-[0.08em] border-b-[2px] border-[#E2E8F0]">
                      <th className="px-6 py-3 font-bold w-full">Name</th>
                      <th className="px-6 py-4 font-bold whitespace-nowrap text-center align-middle">Uploaded on</th>
                      <th className="px-6 py-4 font-bold text-center whitespace-nowrap w-[80px] align-middle">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F1F5F9]">
                    {existingFiles.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-sm text-[#64748B]">
                          No files uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      existingFiles.map((filename) => (
                        <tr key={filename} className="bg-white hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-6 py-3 max-w-[0] w-full align-middle">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <svg className="h-4 w-4 shrink-0 text-[#2B93D1]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5z" />
                              </svg>
                              <span className="text-[13px] font-[500] text-[#1E293B] truncate" title={filename}>{filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-[13px] font-[500] text-[#64748B] text-center align-middle">
                            {getUploadDate(filename)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-center align-middle">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setFileToDelete(filename);
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-md text-[#94A3B8] hover:text-[#DC2626] transition-all"
                              title="Delete file"
                            >
                              <TrashIconOutline className="h-4 w-4 opacity-100" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <ConfirmModal
          isOpen={!!fileToDelete}
          onClose={() => setFileToDelete(null)}
          onConfirm={confirmDeleteFile}
          title="Delete File"
          message={`Are you sure you want to delete "${fileToDelete}"?\nThis action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Toast toast={toast} onClose={hideToast} />
      <div className={cn("flex flex-col max-w-4xl mx-auto w-full mt-4 bg-white p-8 rounded-xl shadow-2xl border border-gray-200 dark:bg-[#212121] dark:border-[#3a3a3a]", props.className)}>
        {settings}
        {typeField && (
          <Types
            field={typeField}
            value={typeValue as string}
            setValue={(value: string) =>
              setValues({
                ...values,
                configurable: { ...values!.configurable, [typeKey]: value },
              })
            }
            readonly={readonly}
          />
        )}

        {typeSpec?.description && (
          <>
            <Label title="Description" />
            <div className="prose mb-8">{typeSpec.description}</div>
          </>
        )}

        {typeSpec?.files && existingFiles.length > 0 && (
          <div className="mb-4">
            <Label title="Active Files" />
            <div className="flex flex-col gap-2">
              {existingFiles.map((filename) => (
                <div key={filename} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md dark:bg-[#2a2a2a] dark:border-[#3a3a3a]">
                  <span className="text-sm text-gray-900 dark:text-[#ececec]">{filename}</span>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFileToDelete(filename);
                      }}
                      className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#DC2626] transition-all"
                    >
                      <TrashIcon className="h-4 w-4 opacity-100" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {typeSpec?.files && (
          <FileUploadDropzone
            state={dropzone}
            files={files}
            setFiles={setFiles}
            className="mb-4"
            uploading={inflight}
          />
        )}

        {/* Done button — takes admin back to Dashboard */}
        {props.config?.assistant_id && (
          <div className="flex justify-center mb-6">
            <button
              type="button"
              onClick={() => { window.location.href = "/admin"; }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#00386B] hover:bg-[#00295A] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        )}
        <div
          className={cn(
            "flex flex-col gap-8",
            readonly && "opacity-50 cursor-not-allowed",
          )}
        >
          {orderBy(
            Object.entries(
              props.configSchema?.properties.configurable.properties ?? {},
            ),
            ([key]) => ORDER.indexOf(last(key.split("/"))!),
          ).map(([key, value]) => {
            const title = value.title;
            if (key.split("/")[0].includes("==")) {
              const [parentKey, parentValue] = key.split("/")[0].split("==");
              if (values?.configurable?.[parentKey] !== parentValue) {
                return null;
              }
            } else {
              return null;
            }
            if (
              last(key.split("/")) === "retrieval_description" &&
              !files.length
            ) {
              return null;
            }
            if (last(key.split("/")) === "system_message") {
              return null; // Hide the instructions field from the admin
            }
            if (last(key.split("/")) === "llm_type") {
              return null; // Hide the LLM type field from the admin
            }
            if (value.type === "string" && value.enum) {
              return (
                <SingleOptionField
                  key={key}
                  id={key}
                  field={value}
                  title={title}
                  value={values?.configurable?.[key] as string}
                  setValue={(value: string) =>
                    setValues({
                      ...values,
                      configurable: { ...values!.configurable, [key]: value },
                    })
                  }
                  readonly={readonly}
                />
              );
            } else if (value.type === "string") {
              return (
                <StringField
                  key={key}
                  id={key}
                  field={value}
                  title={title}
                  value={values?.configurable?.[key] as string}
                  setValue={(value: string) =>
                    setValues({
                      ...values,
                      configurable: { ...values!.configurable, [key]: value },
                    })
                  }
                  readonly={readonly}
                />
              );
            } else if (value.type === "boolean") {
              return (
                <SingleOptionField
                  key={key}
                  id={key}
                  field={{
                    ...value,
                    type: "string",
                    enum: ["Yes", "No"],
                  }}
                  title={title}
                  value={values?.configurable?.[key] ? "Yes" : "No"}
                  setValue={(value: string) =>
                    setValues({
                      ...values,
                      configurable: {
                        ...values!.configurable,
                        [key]: value === "Yes",
                      },
                    })
                  }
                  readonly={readonly}
                />
              );
            } else if (key === "type==agent/tools") {
              return (
                <ToolSelectionField
                  key={key}
                  selectedTools={selectedTools}
                  onAddTool={handleAddTool}
                  onRemoveTool={handleRemoveTool}
                  onUpdateToolConfig={handleUpdateToolConfig}
                  readonly={readonly}
                  retrievalOn={files.length > 0}
                />
              );
            }
          })}
        </div>
      </div>
      <ConfirmModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={confirmDeleteFile}
        title="Delete File"
        message={`Are you sure you want to delete "${fileToDelete}"?\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
