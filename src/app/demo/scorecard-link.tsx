"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import * as actions from "./actions";
import type { DemoState } from "@/lib/demo/state";

export function ScorecardLink({ state }: { state: DemoState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const runId = await actions.persistRun(state);
          router.push(`/scorecard?run=${runId}`);
        })
      }
      className="mt-3 inline-block cursor-pointer border-none bg-transparent p-0 font-semibold text-[var(--accent)] underline-offset-2 hover:underline disabled:opacity-60"
    >
      {isPending ? "Opening…" : "Open the scorecard →"}
    </button>
  );
}
