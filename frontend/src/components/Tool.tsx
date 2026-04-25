import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ToolCall } from "../types";
import { str } from "../utils/str";
import { cn } from "../utils/cn";

export function ToolRequest(
  props: ToolCall & {
    open?: boolean;
    setOpen?: (open: boolean) => void;
  },
) {
  return (
    <>
      <span className="text-gray-900 dark:text-[#ececec] whitespace-pre-wrap break-words mr-2">
        Use
      </span>
      {props.name && (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 relative -top-[1px] mr-2 dark:bg-white/5 dark:text-[#c5c5d2] dark:ring-white/10">
          {props.name}
        </span>
      )}
      {props.args && (
        <div className="text-gray-900 dark:text-[#ececec] mt-2 mb-4 whitespace-pre-wrap break-words">
          <div className="ring-1 ring-gray-300 dark:ring-[#3a3a3a] rounded">
            <div className="grid divide-y divide-gray-200 dark:divide-[#3a3a3a] empty:hidden">
              {Object.entries(props.args).map(([key, value], i) => (
                <div key={i} className="contents">
                  <div
                    className={cn(
                      i === 0 ? "" : "border-t border-transparent",
                      "py-1 px-3 text-sm border-r border-r-gray-300 dark:border-r-[#3a3a3a]",
                    )}
                  >
                    <div className="font-medium text-gray-500">{key}</div>
                  </div>
                  <div
                    className={cn(
                      i === 0 ? "" : "border-t border-gray-200 dark:border-[#3a3a3a]",
                      "py-1 px-3",
                    )}
                  >
                    {str(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ToolResponse(props: {
  name?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  return (
    <>
      <span className="text-gray-900 dark:text-[#ececec] whitespace-pre-wrap break-words mr-2">
        Results from
      </span>
      {props.name && (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 relative -top-[1px] mr-2 dark:bg-white/5 dark:text-[#c5c5d2] dark:ring-white/10">
          {props.name}
        </span>
      )}
      {props.setOpen && (
        <span
          className={cn(
            "inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 cursor-pointer relative top-1 dark:bg-white/5 dark:text-[#c5c5d2] dark:ring-white/10",
            props.open && "mb-2",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.setOpen?.(!props.open);
          }}
        >
          <ChevronDownIcon
            className={cn(
              "h-5 w-5 transition opacity-70 hover:opacity-100",
              props.open ? "rotate-180" : "",
            )}
          />
        </span>
      )}
    </>
  );
}
