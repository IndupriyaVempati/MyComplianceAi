import { TYPES } from "../constants";
import { Config, ConfigListProps } from "../hooks/useConfigList";
import { cn } from "../utils/cn";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { ConfirmModal } from "./ConfirmModal";
import { useState } from "react";
import { useToast } from "./Toast";

function ConfigItem(props: {
  config: Config;
  currentConfig: Config | null;
  enterConfig: (id: string | null) => void;
  deleteConfig: (id: string) => void;
  confirmModal: any;
  setConfirmModal: any;
  showToast: (message: string, type?: any) => void;
}) {
  return (
    <li key={props.config.assistant_id}>
      <div
        onClick={() => props.enterConfig(props.config.assistant_id)}
        className={cn(
          props.config.assistant_id === props.currentConfig?.assistant_id
            ? "bg-gray-100 text-[#00386B] dark:bg-[#2f2f2f] dark:text-[#2B93D1]"
            : "text-gray-700 hover:text-[#2B93D1] hover:bg-gray-50 dark:text-[#ececec] dark:hover:text-white dark:hover:bg-[#323232]",
          "group flex gap-x-3 rounded-md p-2 leading-6 cursor-pointer",
        )}
      >
        <span
          className={cn(
            props.config.assistant_id === props.currentConfig?.assistant_id
              ? "text-[#00386B] border-[#2B93D1] dark:text-[#2B93D1] dark:border-[#2B93D1]"
              : "text-gray-400 border-gray-200 group-hover:border-[#2B93D1] group-hover:text-[#2B93D1] dark:text-[#8e8ea0] dark:border-[#3a3a3a] dark:group-hover:border-[#2B93D1] dark:group-hover:text-[#2B93D1]",
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white dark:bg-[#212121]",
          )}
        >
          {props.config.name?.[0] ?? " "}
        </span>
        <div className="flex flex-col">
          <span 
            className="truncate text-sm font-medium text-gray-900 dark:text-[#ececec]"
            title={props.config.name}
          >
            {props.config.name}
          </span>
          <span className="truncate text-xs text-gray-500 dark:text-[#8e8ea0]">
            {
              TYPES[
                (props.config.config.configurable?.type ??
                  "agent") as keyof typeof TYPES
              ]?.title
            }
          </span>
        </div>
        <Link
          className="ml-auto w-5 text-gray-400 hover:text-[#2B93D1] dark:text-[#8e8ea0] dark:hover:text-[#2B93D1]"
          to={`/assistant/${props.config.assistant_id}/edit`}
          onClick={(event) => event.stopPropagation()}
        >
          <PencilSquareIcon />
        </Link>
        <Link
          className="w-5 text-gray-400 hover:text-red-600 dark:text-[#8e8ea0] dark:hover:text-red-500"
          to="#"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.setConfirmModal({
              isOpen: true,
              title: "Delete Knowledge Base",
              message: `Are you sure you want to delete "${props.config.name}"?\nThis cannot be undone.`,
              onConfirm: () => {
                props.deleteConfig(props.config.assistant_id);
                props.showToast("Knowledge Base deleted successfully");
              }
            });
          }}
        >
          <TrashIcon />
        </Link>
      </div>
    </li>
  );
}

export function ConfigList(props: {
  configs: ConfigListProps["configs"];
  currentConfig: Config | null;
  enterConfig: (id: string | null) => void;
  deleteConfig: (id: string) => void;
}) {
  const { show: showToast } = useToast();
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

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
      />
      <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-[#6b6b7b]">
        Your Saved Bots
      </div>
      <ul role="list" className="-mx-2 mt-2 space-y-1">
        {props.configs
          ?.filter((a) => a.mine)
          .map((assistant) => (
            <ConfigItem
              key={assistant.assistant_id}
              config={assistant}
              currentConfig={props.currentConfig}
              enterConfig={props.enterConfig}
              deleteConfig={props.deleteConfig}
              confirmModal={confirmModal}
              setConfirmModal={setConfirmModal}
              showToast={showToast}
            />
          )) ?? (
            <li className="leading-6 p-2 animate-pulse font-black text-gray-400 text-lg">
              ...
            </li>
          )}
      </ul>

      <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-[#6b6b7b] mt-4">
        Public Bots
      </div>
      <ul role="list" className="-mx-2 mt-2 space-y-1">
        {props.configs
          ?.filter((a) => !a.mine)
          .map((assistant) => (
            <ConfigItem
              key={assistant.assistant_id}
              config={assistant}
              currentConfig={props.currentConfig}
              enterConfig={props.enterConfig}
              deleteConfig={props.deleteConfig}
              confirmModal={confirmModal}
              setConfirmModal={setConfirmModal}
              showToast={showToast}
            />
          )) ?? (
            <li className="leading-6 p-2 animate-pulse font-black text-gray-400 text-lg">
              ...
            </li>
          )}
      </ul>
    </>
  );
}
