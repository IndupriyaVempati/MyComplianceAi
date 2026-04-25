import { MarkedOptions, marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "../utils/cn";

const OPTIONS: MarkedOptions = {
  gfm: true,
  breaks: true,
};

export function StringViewer(props: {
  value: string;
  className?: string;
  markdown?: boolean;
}) {
  return props.markdown ? (
    <div
      className={cn("prose max-w-none", props.className)}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked(props.value, OPTIONS)).trim(),
      }}
    />
  ) : (
    <div className={cn("max-w-none", props.className)}>
      {props.value}
    </div>
  );
}
