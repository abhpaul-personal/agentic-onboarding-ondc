import type { AuditLogEntry } from "@/lib/orchestrator/audit";

const KIND_DOT: Record<AuditLogEntry["kind"], string> = {
  agent: "bg-[var(--sim)]",
  human: "bg-[var(--gate)]",
  check: "bg-[var(--real)]",
  sys: "bg-[var(--ink3)]",
};

export function AuditLog({ entries }: { entries: readonly AuditLogEntry[] }) {
  return (
    <aside className="sticky top-[70px] flex max-h-[calc(100vh-100px)] flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Audit log</h3>
        <span className="text-xs text-[var(--ink2)]">{entries.length} entries</span>
      </div>
      <div className="mb-2 flex gap-3 text-[11px] text-[var(--ink2)]">
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm bg-[var(--sim)]" /> agent
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm bg-[var(--real)]" /> check
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm bg-[var(--gate)]" /> human
        </span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto text-xs">
        {[...entries].reverse().map((entry, index) => (
          <div key={index} className="grid grid-cols-[46px_14px_1fr] items-start gap-1.5 border-b border-[var(--line2)] pb-1.5">
            <span className="font-mono text-[10px] text-[var(--ink3)]">
              {new Date(entry.at).toLocaleTimeString("en-IN", { hour12: false, minute: "2-digit", second: "2-digit" })}
            </span>
            <span className={`mt-0.5 h-3.5 w-3.5 rounded ${KIND_DOT[entry.kind]}`} />
            <span>{entry.text}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[var(--ink3)]">Nothing logged yet.</p>}
      </div>
    </aside>
  );
}
