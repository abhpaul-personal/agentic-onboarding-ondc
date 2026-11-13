"use client";

import { useState, useTransition } from "react";
import * as actions from "./actions";
import { CatalogPanel } from "./catalog-panel";
import { ScorecardLink } from "./scorecard-link";
import { useLiveModePassphrase } from "./live-mode-context";
import { SAMPLE_SETS, type SampleSetId } from "@/lib/demo/sample-sets";
import type { DemoState } from "@/lib/demo/state";
import { AuditLog } from "@/components/audit-log";
import { Timeline } from "@/components/timeline";
import { Button, Card, Chip } from "@/components/ui";
import type { AuditLogEntry } from "@/lib/orchestrator/audit";

const BULK_STEPS = [
  { id: "s1", label: "S1 · Bulk seller intake", gate: false },
  { id: "s2", label: "S2 · Verification", gate: false },
  { id: "g0", label: "G0 · SNP reviewer approves", gate: true },
  { id: "done", label: "Summary", gate: false },
];

const STAGE1_STEPS = [
  { id: "s1", label: "S1 · Seller intake agent", gate: false },
  { id: "s2", label: "S2 · Verification agent", gate: false },
  { id: "g0", label: "G0 · SNP reviewer approves", gate: true },
];

const STAGE2_STEPS = [
  { id: "intake", label: "1 · Source intake", gate: false },
  { id: "extract", label: "2 · Extraction agent", gate: false },
  { id: "g1", label: "G1 · Seller confirms items", gate: true },
  { id: "mapping", label: "3 · Smart mapping agent", gate: false },
  { id: "g2", label: "G2 · Reviewer approves mappings", gate: true },
  { id: "category", label: "4 · Category agent", gate: false },
  { id: "validate", label: "5 · Validation", gate: false },
  { id: "queue", label: "Fallback queue", gate: true },
  { id: "g3", label: "G3 · Seller signs off", gate: true },
  { id: "build", label: "6 · Catalog builder", gate: false },
  { id: "g4", label: "G4 · Pilot, then full catalog", gate: true },
  { id: "publish", label: "7 · Publish and monitor", gate: false },
];

function allAuditEntries(state: DemoState): AuditLogEntry[] {
  if (state.kind === "bulk") return state.bulk.auditLog;
  return [...state.seller.auditLog, ...(state.catalog?.auditLog ?? [])];
}

export function DemoClient() {
  const [state, setState] = useState<DemoState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<DemoState>) {
    setError(null);
    startTransition(async () => {
      try {
        setState(await action());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (!state) {
    return <Picker onPick={(id) => run(() => actions.startDemo(id))} isPending={isPending} />;
  }

  const timelineStages =
    state.kind === "bulk"
      ? [{ name: "Stage 1 · Bulk", steps: BULK_STEPS }]
      : [
          { name: "Stage 1 · Seller", steps: STAGE1_STEPS },
          ...(state.catalog
            ? [{ name: "Stage 2 · Catalog", steps: STAGE2_STEPS.filter((s) => !state.catalog!.skippedSteps.includes(s.id as never)) }]
            : []),
        ];

  const currentStep =
    state.kind === "bulk" ? state.bulk.step : state.catalog ? state.catalog.step : state.seller.step;

  const allIds = timelineStages.flatMap((s) => s.steps.map((x) => x.id));
  const currentIndex = allIds.indexOf(currentStep);
  const doneSteps = currentIndex >= 0 ? allIds.slice(0, currentIndex) : allIds;

  const title = SAMPLE_SETS.find((s) => s.id === state.setId)?.title ?? state.setId;

  return (
    <div className="grid grid-cols-[230px_minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-[210px_minmax(0,1fr)] max-md:grid-cols-1">
      <Timeline stages={timelineStages} currentStep={currentStep} doneSteps={doneSteps} />
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" small onClick={() => setState(null)}>
            Change seller
          </Button>
        </div>
        {error && (
          <Card className="border-[var(--bad)] bg-[var(--bad-soft)] text-sm text-[var(--bad)]">{error}</Card>
        )}
        <StepPanel state={state} run={run} isPending={isPending} />
      </div>
      <div className="max-xl:hidden">
        <AuditLog entries={allAuditEntries(state)} />
      </div>
    </div>
  );
}

function Picker({ onPick, isPending }: { onPick: (id: SampleSetId) => void; isPending: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 text-[26px] font-semibold tracking-tight">Pick a sample seller</h1>
        <p className="max-w-[70ch] text-[var(--ink2)]">
          Each one stresses a different part of the flow. The demo replays from the committed cache — a
          step that hasn&apos;t been warmed yet shows plainly rather than guessing.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {SAMPLE_SETS.map((set) => (
          <button
            key={set.id}
            disabled={isPending}
            onClick={() => onPick(set.id)}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-3.5 text-left hover:border-[var(--accent)] disabled:opacity-50"
          >
            <span className="mb-2 inline-block">
              <Chip kind={set.bulk ? "gate" : "neutral"}>{set.bulk ? "Stage 1 only" : `Set ${set.id} · ${set.category}`}</Chip>
            </span>
            <b className="block text-[14.5px]">{set.title}</b>
            <span className="block text-xs text-[var(--ink2)]">{set.where}</span>
            <p className="mt-2 text-xs">{set.format}, {set.size}</p>
            <span className="mt-1 block text-xs text-[var(--ink2)]">Tests: {set.tests}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingCard({ note }: { note: string }) {
  return (
    <Card className="border-[var(--sim)] bg-[var(--sim-soft)] text-sm text-[var(--sim)]">
      <b className="block">Not warmed yet</b>
      <p className="mt-1">{note}</p>
    </Card>
  );
}

function StepHead({ n, label, extra }: { n: string; label: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold">
        {n} · {label}
      </h3>
      {extra}
    </div>
  );
}

function StepPanel({
  state,
  run,
  isPending,
}: {
  state: DemoState;
  run: (action: () => Promise<DemoState>) => void;
  isPending: boolean;
}) {
  if (state.pending) return <PendingCard note={state.pending.note} />;

  if (state.kind === "bulk") return <BulkPanel state={state} run={run} isPending={isPending} />;

  if (!state.catalog) return <SellerPanel state={state} run={run} isPending={isPending} />;

  return <CatalogPanel state={state} run={run} isPending={isPending} />;
}

/* ---------------- bulk (set G) ---------------- */

function BulkPanel({
  state,
  run,
  isPending,
}: {
  state: Extract<DemoState, { kind: "bulk" }>;
  run: (action: () => Promise<DemoState>) => void;
  isPending: boolean;
}) {
  const { bulk } = state;

  if (bulk.step === "s1") {
    return (
      <Card>
        <StepHead n="S1" label="Bulk seller intake agent" extra={<Chip kind="real">Deterministic</Chip>} />
        <p className="mb-3 text-sm text-[var(--ink2)]">
          The SNP uploads a bulk list from the cooperative. Each row is read directly into a draft seller
          profile — no model call needed for structured bulk intake.
        </p>
        <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.bulkRunIntake(state))}>
          Run bulk intake
        </Button>
      </Card>
    );
  }

  if (bulk.step === "s2") {
    return (
      <Card>
        <StepHead n="S2" label="Verification agent" extra={<Chip kind="real">Real checks</Chip>} />
        <p className="mb-3 text-sm text-[var(--ink2)]">
          {bulk.rows.length} seller profiles drafted. Checking GSTIN, FSSAI and IFSC for each.
        </p>
        <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.bulkRunVerification(state))}>
          Run verification
        </Button>
      </Card>
    );
  }

  if (bulk.step === "g0") {
    const flagged = bulk.rows.filter((r) => r.checks?.some((c) => !c.passed));
    const clean = bulk.rows.filter((r) => r.checks?.every((c) => c.passed));
    return (
      <Card>
        <StepHead n="G0" label="SNP reviewer approves the seller" extra={<Chip kind="gate">Human gate</Chip>} />
        <div className="mb-3 overflow-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#fbfaf7]">
                {["#", "Member", "GSTIN", "Result"].map((h) => (
                  <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulk.rows.map((row) => (
                <tr key={row.rowIndex} className="border-b border-[var(--line2)]">
                  <td className="p-1.5">{row.rowIndex}</td>
                  <td className="p-1.5">{row.profile.owner}</td>
                  <td className="p-1.5 font-mono">{row.profile.gstin}</td>
                  <td className="p-1.5">
                    {row.checks?.every((c) => c.passed) ? (
                      <Chip kind="ok">All checks pass</Chip>
                    ) : (
                      row.checks
                        ?.filter((c) => !c.passed)
                        .map((c) => (
                          <span key={c.name} className="mr-1">
                            <Chip kind="bad">{c.name}</Chip>
                          </span>
                        ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="gate"
          disabled={isPending}
          onClick={() => run(() => actions.bulkApproveG0(state))}
        >
          Approve {clean.length}, send back {flagged.length}
        </Button>
      </Card>
    );
  }

  const approved = bulk.rows.filter((r) => r.approved);
  const sentBack = bulk.rows.filter((r) => !r.approved);
  return (
    <Card>
      <h3 className="mb-2 text-base font-semibold">Stage 1 complete</h3>
      <p className="text-sm text-[var(--ink2)]">
        {approved.length} sellers are approved and can start catalog onboarding. {sentBack.length} were sent
        back with a reason, and the checks that caught them were real code, not a model.
      </p>
      <ScorecardLink state={state} />
    </Card>
  );
}

/* ---------------- stage 1, single seller ---------------- */

function SellerPanel({
  state,
  run,
  isPending,
}: {
  state: Extract<DemoState, { kind: "single" }>;
  run: (action: () => Promise<DemoState>) => void;
  isPending: boolean;
}) {
  const { seller } = state;
  const liveModePassphrase = useLiveModePassphrase();

  if (seller.step === "s1") {
    return (
      <Card>
        <StepHead n="S1" label="Seller intake agent" extra={<Chip kind="sim">Model, cached</Chip>} />
        <p className="mb-3 text-sm text-[var(--ink2)]">
          Reads the registration form and the GST certificate, FSSAI licence and cancelled cheque images,
          and cross-fills the seller profile.
        </p>
        <Button
          variant="primary"
          disabled={isPending}
          onClick={() => run(() => actions.singleRunIntake(state, liveModePassphrase ?? undefined))}
        >
          Run seller intake agent
        </Button>
      </Card>
    );
  }

  if (seller.step === "s2") {
    return (
      <Card>
        <StepHead n="S2" label="Verification agent" extra={<Chip kind="real">Real checks</Chip>} />
        <p className="mb-3 text-sm text-[var(--ink2)]">
          Format and checksum checks run as real code. Name matching against GST and bank records is
          simulated, since it would need live APIs.
        </p>
        <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.singleRunVerification(state))}>
          Run verification
        </Button>
      </Card>
    );
  }

  if (seller.step === "g0") {
    const allOk = seller.checks?.every((c) => c.passed) ?? false;
    return (
      <Card>
        <StepHead n="G0" label="SNP reviewer approves the seller" extra={<Chip kind="gate">Human gate</Chip>} />
        <table className="mb-3 w-full text-xs">
          <thead>
            <tr className="bg-[#fbfaf7]">
              {["Check", "Value", "Result"].map((h) => (
                <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seller.checks?.map((c) => (
              <tr key={c.name} className="border-b border-[var(--line2)]">
                <td className="p-1.5">{c.name}</td>
                <td className="p-1.5 font-mono">{c.value}</td>
                <td className="p-1.5">
                  <Chip kind={c.passed ? "ok" : "bad"}>{c.passed ? "Pass" : "Fail"}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <Button variant="gate" disabled={!allOk || isPending} onClick={() => run(() => actions.singleApproveG0(state))}>
            Approve seller
          </Button>
          {!allOk && (
            <Button variant="default" disabled={isPending} onClick={() => run(() => actions.singleRejectG0(state))}>
              Send back
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm text-[var(--ink2)]">Seller approved. Starting catalog onboarding…</p>
    </Card>
  );
}
