"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as actions from "./actions";
import { Button } from "@/components/ui";

const LiveModeContext = createContext<string | null>(null);

/** The current owner-entered passphrase, or null when live mode isn't unlocked. Pass it as the 2nd arg to a cache-dependent action to try a live call. */
export function useLiveModePassphrase(): string | null {
  return useContext(LiveModeContext);
}

export function LiveModeProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    actions.isLiveModeAvailable().then(setAvailable);
  }, []);

  return (
    <LiveModeContext.Provider value={passphrase}>
      {available && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] px-3 py-2 text-xs text-[var(--warn)]">
          {passphrase ? (
            <>
              <b>Live mode is on.</b>
              <span>Model-dependent steps will call the real API (rate limited to 10 runs/hour) instead of replaying the cache.</span>
              <Button small variant="ghost" onClick={() => setPassphrase(null)}>
                Turn off
              </Button>
            </>
          ) : (
            <>
              <b>Owner only:</b>
              <span>enter the live-mode passphrase to call the real model instead of replaying the cache.</span>
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Passphrase"
                className="rounded border border-[var(--warn)] bg-white px-2 py-0.5 text-xs text-[var(--ink)]"
              />
              <Button
                small
                onClick={() => {
                  setPassphrase(draft);
                  setDraft("");
                }}
                disabled={!draft}
              >
                Unlock
              </Button>
            </>
          )}
        </div>
      )}
      {children}
    </LiveModeContext.Provider>
  );
}
