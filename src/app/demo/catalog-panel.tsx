"use client";

import { useState } from "react";
import Link from "next/link";
import * as actions from "./actions";
import type { DemoState } from "@/lib/demo/state";
import { Button, Card, Chip, Confidence } from "@/components/ui";
import { targetLabel } from "@/lib/schemas/mapping-target";

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

type SingleDemoState = Extract<DemoState, { kind: "single" }>;

export function CatalogPanel({
  state,
  run,
  isPending,
}: {
  state: SingleDemoState;
  run: (action: () => Promise<DemoState>) => void;
  isPending: boolean;
}) {
  const { catalog } = state;
  if (!catalog) return null;

  switch (catalog.step) {
    case "intake":
      return (
        <Card>
          <StepHead n="1" label="Source intake agent" extra={<Chip kind="real">Deterministic</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">Detects the format the seller uploaded and pre-fills what it can from the approved profile.</p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunIntake(state))}>
            Run source intake agent
          </Button>
        </Card>
      );

    case "extract":
      return (
        <Card>
          <StepHead n="2" label="Extraction agent" extra={<Chip kind="sim">Model, cached</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            {catalog.rawRows ? `Parses ${catalog.rawRows.length} rows.` : "Reads the chat text or price-list photo into draft items."}
          </p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunExtraction(state))}>
            Run extraction agent
          </Button>
        </Card>
      );

    case "g1":
      return (
        <Card>
          <StepHead n="G1" label="Seller confirms the extracted items" extra={<Chip kind="gate">Human gate</Chip>} />
          <div className="mb-3 overflow-auto rounded-lg border border-[var(--line)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fbfaf7]">
                  {["Item", "Net qty", "Price", "Confidence"].map((h) => (
                    <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--line2)]">
                    <td className="p-1.5">{item.name}</td>
                    <td className="p-1.5">{item.netQty ?? "—"}</td>
                    <td className="p-1.5">{item.price != null ? `₹${item.price}` : "—"}</td>
                    <td className="p-1.5">
                      {item.extractionConfidence != null && <Confidence value={item.extractionConfidence} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="gate" disabled={isPending} onClick={() => run(() => actions.catalogConfirmG1(state))}>
            Confirm {catalog.items.length} items
          </Button>
        </Card>
      );

    case "mapping":
      return (
        <Card>
          <StepHead n="3" label="Smart mapping agent" extra={<Chip kind="sim">Model, cached per column</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            For each column, proposes a target attribute with a confidence and a reason that quotes the
            seller&apos;s own values.
          </p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunMapping(state))}>
            Run mapping agent
          </Button>
        </Card>
      );

    case "g2":
      return <G2Panel state={state} run={run} isPending={isPending} />;

    case "category":
      return (
        <Card>
          <StepHead n="4" label="Category agent" extra={<Chip kind="sim">Model, cached</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            Classifies {catalog.items.length} items into the seller&apos;s allowed ONDC categories, using
            each item&apos;s now-resolved name.
          </p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunCategory(state))}>
            Run category agent
          </Button>
        </Card>
      );

    case "validate":
      return (
        <Card>
          <StepHead n="5" label="Validation" extra={<Chip kind="real">Real checks</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            GTIN check digit, MRP versus selling price, duplicates, unsupported claims, and required
            statutory fields — run as real code, not the model.
          </p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunValidation(state))}>
            Run validation
          </Button>
        </Card>
      );

    case "queue":
      return <QueuePanel state={state} run={run} isPending={isPending} />;

    case "g3":
      return <G3Panel state={state} run={run} isPending={isPending} />;

    case "build":
      return (
        <Card>
          <StepHead n="6" label="Catalog builder" extra={<Chip kind="real">Deterministic</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            Builds the ONDC catalog JSON for {catalog.items.length} items and prepares the pilot phase of
            the first 10.
          </p>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogRunBuild(state))}>
            Build catalog
          </Button>
        </Card>
      );

    case "g4":
      return (
        <Card>
          <StepHead n="G4" label="Pilot phase, then full catalog" extra={<Chip kind="gate">Human gate</Chip>} />
          <p className="mb-3 text-sm text-[var(--ink2)]">
            First the reviewer publishes a pilot phase of 10 items to the mock seller app. Then, if it is
            accepted, the seller approves the full catalog.
          </p>
          {!catalog.pilotApproved ? (
            <Button variant="gate" disabled={isPending} onClick={() => run(() => actions.catalogApproveG4Pilot(state))}>
              Reviewer: publish pilot phase (10 items)
            </Button>
          ) : (
            <Button variant="gate" disabled={isPending} onClick={() => run(() => actions.catalogApproveG4Full(state))}>
              Seller: approve the full catalog ({catalog.catalogItems?.length ?? 0} items)
            </Button>
          )}
        </Card>
      );

    case "publish":
      return (
        <Card>
          <StepHead n="7" label="Publish and monitor" extra={<Chip kind="real">Deterministic</Chip>} />
          <Button variant="primary" disabled={isPending} onClick={() => run(() => actions.catalogPublish(state))}>
            Publish full catalog
          </Button>
        </Card>
      );

    case "done":
      return (
        <Card>
          <h3 className="mb-2 text-base font-semibold">{catalog.sellerProfile.business_name} is live on the mock seller app</h3>
          <p className="text-sm text-[var(--ink2)]">
            {catalog.catalogItems?.length ?? 0} items published after {catalog.gates.length} human decisions.
          </p>
          <Link href="/scorecard" className="mt-3 inline-block font-semibold text-[var(--accent)]">
            Open the scorecard →
          </Link>
        </Card>
      );

    default:
      return null;
  }
}

function G2Panel({ state, run, isPending }: { state: SingleDemoState; run: (a: () => Promise<DemoState>) => void; isPending: boolean }) {
  const { catalog } = state;
  if (!catalog) return null;
  const decisions = Object.values(catalog.columnMappings);
  return (
    <Card>
      <StepHead n="G2" label="Reviewer approves risky mappings" extra={<Chip kind="gate">Human gate</Chip>} />
      <div className="mb-3 max-h-[420px] overflow-auto rounded-lg border border-[var(--line)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#fbfaf7]">
              {["Column", "Proposed attribute", "Confidence", "Route"].map((h) => (
                <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.column} className="border-b border-[var(--line2)] align-top">
                <td className="p-1.5">
                  <b>{d.column}</b>
                  <div className="font-mono text-[10px] text-[var(--ink3)]">{d.candidates.map((c) => c.target ?? "—").join(" · ")}</div>
                </td>
                <td className="p-1.5">
                  <b>{targetLabel(d.proposed)}</b>
                  <div className="text-[var(--ink2)]">{d.reason}</div>
                </td>
                <td className="p-1.5">
                  <Confidence value={d.confidence} />
                </td>
                <td className="p-1.5">
                  <Chip kind={d.route === "auto" ? "ok" : d.route === "review" ? "gate" : "warn"}>{d.route}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-2 text-xs text-[var(--ink2)]">
        Accepting every mapping as proposed (the demo keeps per-field overrides out of scope for M5).
      </p>
      <Button variant="gate" disabled={isPending} onClick={() => run(() => actions.catalogApproveG2(state))}>
        Approve mappings
      </Button>
    </Card>
  );
}

function QueuePanel({ state, run, isPending }: { state: SingleDemoState; run: (a: () => Promise<DemoState>) => void; isPending: boolean }) {
  const { catalog } = state;
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  if (!catalog) return null;
  const queueIssues = catalog.issues.filter((i) => i.severity === "queue");

  const resolve = (itemId: string, type: string) => {
    const resolution =
      type === "duplicate"
        ? ("drop" as const)
        : type === "gtin"
          ? ("clear_gtin" as const)
          : type === "claim"
            ? ("remove_claim" as const)
            : type === "net_qty_unparsed"
              ? ({ kind: "set_net_qty" as const, value: "500 g" })
              : ({ kind: "set_packed_month" as const, value: "10/2026" });
    setResolved((s) => new Set(s).add(`${itemId}:${type}`));
    run(() => actions.catalogResolveQueueItem(state, itemId, resolution));
  };

  return (
    <Card>
      <StepHead n="FQ" label="Fallback queue" extra={<Chip kind="warn">Needs a person</Chip>} />
      <div className="mb-3 space-y-2">
        {queueIssues.map((issue) => {
          const key = `${issue.itemId}:${issue.type}`;
          return (
            <div key={key} className="rounded-lg border border-[var(--line)] p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <b className="font-mono">{issue.itemId}</b> · {issue.message}
                </span>
                <Button small disabled={isPending || resolved.has(key)} onClick={() => resolve(issue.itemId, issue.type)}>
                  {resolved.has(key) ? "Resolved" : "Resolve"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="gate" disabled={isPending} onClick={() => run(() => actions.catalogFinishQueue(state))}>
        Finish fallback queue
      </Button>
    </Card>
  );
}

function G3Panel({ state, run, isPending }: { state: SingleDemoState; run: (a: () => Promise<DemoState>) => void; isPending: boolean }) {
  const { catalog } = state;
  const [enteredBrands, setEnteredBrands] = useState<Set<string>>(new Set());
  if (!catalog) return null;
  const g3Issues = catalog.issues.filter((i) => i.severity === "g3");
  const packerBrands = [...new Set(catalog.items.filter((i) => !i.manufacturerOrPackerName && i.brand).map((i) => i.brand!))];

  const enterBrand = (brand: string) => {
    setEnteredBrands((s) => new Set(s).add(brand));
    run(() =>
      actions.catalogEnterPackerForBrand(state, brand, {
        manufacturerOrPackerName: `${brand} (from label)`,
        manufacturerOrPackerAddress: "Address copied from the pack label",
        fssaiLicenceNo: "20000000000900",
      }),
    );
  };

  const remaining = g3Issues.filter((i) => i.type !== "packer_missing" && i.type !== "fssai");

  return (
    <Card>
      <StepHead n="G3" label="Seller signs off statutory fields" extra={<Chip kind="gate">Human gate</Chip>} />
      <p className="mb-3 text-sm text-[var(--ink2)]">
        Statutory values are yours to confirm. The agent only extracted them from your file, pre-filled
        them from your approved profile, or asks you below. It never fills them in itself.
      </p>

      {packerBrands.length > 0 && (
        <div className="mb-3 space-y-2">
          <h4 className="text-sm font-semibold">Branded items packed by someone else</h4>
          {packerBrands.map((brand) => (
            <div key={brand} className="flex items-center justify-between rounded-lg border border-[var(--line)] p-2.5 text-sm">
              <span>
                <b>{brand}</b> — copy packer name, address and FSSAI licence from the pack label
              </span>
              <Button small disabled={isPending || enteredBrands.has(brand)} onClick={() => enterBrand(brand)}>
                {enteredBrands.has(brand) ? "Entered" : "Enter from label"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {remaining.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <h4 className="text-sm font-semibold">Other statutory issues</h4>
          {remaining.map((issue, i) => (
            <div key={i} className="rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] p-2 text-xs text-[var(--warn)]">
              <b className="font-mono">{issue.itemId}</b> · {issue.message}
            </div>
          ))}
          <p className="text-xs text-[var(--ink3)]">
            These need a value change in the source data; resolve them there and re-run validation.
          </p>
        </div>
      )}

      <Button
        variant="gate"
        disabled={isPending || g3Issues.length > 0}
        onClick={() => run(() => actions.catalogSignOffG3(state))}
      >
        Sign off statutory fields
      </Button>
    </Card>
  );
}
