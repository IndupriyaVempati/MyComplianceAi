export const TYPES = {

  chat_retrieval: {
    id: "chat_retrieval",
    title: "Upload File",
    description:
      "Upload files to provide custom knowledge. The bot will use these files to answer your questions accurately based on the documents you provide.",
    files: true,
  },
} as const;

export type TYPE_NAME = (typeof TYPES)[keyof typeof TYPES]["id"];

export const DROPZONE_CONFIG = {
  multiple: true,
  accept: {
    "text/*": [".txt", ".htm", ".html"],
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      ".docx",
    ],
    "application/msword": [".doc"],
  },
  maxSize: 10_000_000, // Up to 10 MB file size.
};
