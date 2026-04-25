import { useMemo, forwardRef } from "react";
import { DropzoneState } from "react-dropzone";
import { XCircleIcon } from "@heroicons/react/24/outline";

const baseClasses =
  "flex-1 flex flex-col items-center p-5 border-2 border-dashed rounded-lg outline-none transition-colors border-gray-300 bg-gray-50 text-gray-500 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#8e8ea0]";

const focusedClasses = "border-[#2B93D1]";
const acceptClasses = "border-green-500";
const rejectClasses = "border-red-500";

function Label(props: { id: string; title: string }) {
  return (
    <label
      htmlFor={props.id}
      className="block font-medium leading-6 text-gray-700 mb-2 dark:text-[#a1a1aa]"
    >
      {props.title}
    </label>
  );
}

export const FileUploadDropzone = forwardRef<HTMLInputElement, {
  state: DropzoneState;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  className?: string;
  uploading?: boolean;
  invisible?: boolean;
}>((props, ref) => {
  const { getRootProps, getInputProps } = props.state;

  const files = props.files.map((file, i) => (
    <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-[#c5c5d2]">
      {file.name} - {file.size} bytes
      <span
        className="inline-flex items-center rounded-full cursor-pointer text-gray-400 hover:text-gray-900 dark:text-[#8e8ea0] dark:hover:text-[#ececec]"
        onClick={() =>
          props.setFiles((files) => files.filter((f) => f !== file))
        }
      >
        <XCircleIcon className="h-4 w-4" />
      </span>
    </li>
  ));

  const styleClasses = useMemo(
    () => {
      let classes = baseClasses;
      if (props.state.isFocused) classes += ` ${focusedClasses}`;
      if (props.state.isDragAccept) classes += ` ${acceptClasses}`;
      if (props.state.isDragReject) classes += ` ${rejectClasses}`;
      return classes;
    },
    [props.state.isFocused, props.state.isDragAccept, props.state.isDragReject],
  );

  // While uploading, replace the whole section with a spinner
  if (props.uploading) {
    return (
      <section className={props.className}>
        <Label id="files" title="Files" />
        <div
          className={`${baseClasses} justify-center min-h-[80px] flex-row gap-3`}
        >
          <svg
            className="animate-spin h-5 w-5 text-[#2B93D1] shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="text-sm text-gray-500 dark:text-[#8e8ea0]">Uploading file, please wait…</span>
        </div>
      </section>
    );
  }

  if (props.invisible && !props.uploading) {
    return (
      <div {...getRootProps()} style={{ display: "none" }}>
        <input {...getInputProps()} ref={ref} />
      </div>
    );
  }

  return (
    <section className={props.className}>
      <aside>
        <Label id="files" title="Files" />
        {files.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">{files}</ul>
        )}
      </aside>
      <div {...getRootProps({ className: styleClasses })}>
        <input {...getInputProps()} ref={ref} />
        <p className="text-center text-sm">
          Drag n&apos; drop some files here, or click to select files.
          <br />
          <span className="text-gray-500 text-xs dark:text-[#6b6b7b]">
            Accepted files: .txt, .csv, .html, .docx, .pdf. No file should exceed 10 MB.
          </span>
        </p>
      </div>
    </section>
  );
});
