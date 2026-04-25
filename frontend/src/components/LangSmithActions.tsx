import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  EllipsisHorizontalIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { getAuthHeaders } from "../utils/auth";

export function LangSmithActions(props: { runId: string }) {
  const [state, setState] = useState<{
    score: number;
    inflight: boolean;
  } | null>(null);
  const sendFeedback = async (score: number) => {
    setState({ score, inflight: true });
    await fetch(`/api/runs/feedback`, {
      method: "POST",
      body: JSON.stringify({
        run_id: props.runId,
        key: "user_score",
        score: score,
      }),
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    setState({ score, inflight: false });
  };
  return (
    <div className="flex mt-1 gap-1 flex-row">
      <button
        type="button"
        className="rounded-md p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => sendFeedback(1)}
        title="Thumbs up"
      >
        {state?.score === 1 ? (
          state?.inflight ? (
            <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckIcon className="h-4 w-4 text-green-500" aria-hidden="true" />
          )
        ) : (
          <HandThumbUpIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="rounded-md p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => sendFeedback(0)}
        title="Thumbs down"
      >
        {state?.score === 0 ? (
          state?.inflight ? (
            <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckIcon className="h-4 w-4 text-[#19c37d]" aria-hidden="true" />
          )
        ) : (
          <HandThumbDownIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
