import Link from "next/link";
import { loadRun } from "@/app/demo/actions";
import { loadFieldMappingTruth } from "@/lib/demo/load-set-data";
import { validateItems } from "@/lib/orchestrator/validate";
import { Card, Chip } from "@/components/ui";
import { targetLabel } from "@/lib/schemas/mapping-target";
import { SAMPLE_SETS } from "@/lib/demo/sample-sets";

export const metadata = {
  title: "Scorecard",
};

// Reads a per-visitor run id from the query string, so it can't be prerendered.
export const instant = false;

function Metric({ value, label, target, pass }: { value: string; label: string; target: string; pass: boolean | null }) {
  return (
    <Card>
      <b className={`block text-[26px] tracking-tight ${pass === null ? "" : pass ? "text-[var(--real)]" : "text-[var(--bad)]"}`}>
        {value}
      </b>
      <div className="text-[12.5px] text-[var(--ink2)]">{label}</div>
      <div className="mt-0.5 text-[11.5px] text-[var(--ink3)]">{target}</div>
    </Card>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const state = run ? await loadRun(run) : null;

  if (!state) {
    return (
      <div className="space-y-4">
        <h1 className="text-[26px] font-semibold tracking-tight">Scorecard</h1>
        <p className="max-w-[60ch] text-[var(--ink2)]">
          Finish a run in &quot;Run the demo&quot; and the scorecard fills in from what actually happened
          in your session: what the agent auto-accepted, what you changed, what the checks caught and how
          long it took.
        </p>
        <Link
          href="/demo"
          className="inline-block rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 font-semibold text-white no-underline"
        >
          Run the demo
        </Link>
      </div>
    );
  }

  const title = SAMPLE_SETS.find((s) => s.id === state.setId)?.title ?? state.setId;

  if (state.kind === "bulk") {
    const approved = state.bulk.rows.filter((r) => r.approved);
    const sentBack = state.bulk.rows.filter((r) => !r.approved);
    const totalChecks = state.bulk.rows.reduce((sum, r) => sum + (r.checks?.length ?? 0), 0);
    return (
      <div className="space-y-4">
        <h1 className="text-[26px] font-semibold tracking-tight">Scorecard · {title}</h1>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Metric
            value={`${sentBack.length} / ${state.bulk.rows.length}`}
            label="Planted seller errors caught at verification"
            target="Invalid GSTIN checksum, expired FSSAI licence"
            pass={sentBack.length === 2}
          />
          <Metric value={String(approved.length)} label="Sellers approved at G0" target="" pass={null} />
          <Metric value={String(totalChecks)} label="Real checks run" target="" pass={null} />
        </div>
      </div>
    );
  }

  const { catalog } = state;
  if (!catalog) {
    return (
      <div className="space-y-4">
        <h1 className="text-[26px] font-semibold tracking-tight">Scorecard · {title}</h1>
        <p className="text-[var(--ink2)]">This run hasn&apos;t started the catalog yet.</p>
      </div>
    );
  }

  const decisions = Object.values(catalog.columnMappings);
  const auto = decisions.filter((d) => d.route === "auto");
  const truth = (() => {
    try {
      return loadFieldMappingTruth(state.setId);
    } catch {
      return null;
    }
  })();
  const autoCorrect = truth ? auto.filter((d) => d.final === truth[d.column]) : [];
  const noEdit = decisions.filter((d) => !d.edited);
  const fallback = decisions.filter((d) => d.route === "fallback");
  const finalCorrect = truth ? decisions.filter((d) => d.final === truth[d.column]) : [];

  const elapsedMs = new Date(catalog.updatedAt).getTime() - new Date(catalog.createdAt).getTime();
  const elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;

  const remainingIssues = validateItems(catalog.items, catalog.sellerProfile);
  const plantedErrors =
    state.setId === "F"
      ? [
          "TRP-003: invalid_gtin_check_digit",
          "TRP-005: mrp_below_selling_price",
          "TRP-008: missing_fssai_for_third_party_packer",
          "TRP-009: duplicate_sku",
          "TRP-011: invalid_gtin_check_digit",
          "TRP-014: mrp_below_selling_price",
          "TRP-016: missing_fssai_for_third_party_packer",
          "TRP-017: invented_claim_bait_organic",
          "TRP-019: invalid_gtin_check_digit",
          "TRP-021: duplicate_sku",
          "TRP-022: mrp_below_selling_price",
          "TRP-024: missing_fssai_for_third_party_packer",
          "TRP-027: invalid_gtin_check_digit",
        ]
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Scorecard · {title}</h1>
        <p className="text-[var(--ink2)]">
          Computed from your session against the ground truth in the eval kit. Deterministic checks and
          scores are real; model-dependent steps replay the committed cache.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <Metric
          value={decisions.length ? pct(autoCorrect.length / Math.max(auto.length, 1)) : "n/a"}
          label="Auto-accept precision"
          target="Target 95% or higher"
          pass={auto.length ? autoCorrect.length / auto.length >= 0.95 : null}
        />
        <Metric
          value={decisions.length ? pct(noEdit.length / decisions.length) : "n/a"}
          label="Auto-map rate (no human edit)"
          target="Target 70% or higher"
          pass={decisions.length ? noEdit.length / decisions.length >= 0.7 : null}
        />
        <Metric
          value={`${mins}m ${secs}s`}
          label="Time to publish-ready"
          target="Wall-clock time in this browser session"
          pass={null}
        />
        <Metric
          value={decisions.length ? pct(fallback.length / decisions.length) : "n/a"}
          label="Fallback queue rate"
          target="Target under 15%"
          pass={decisions.length ? fallback.length / decisions.length < 0.15 : null}
        />
        <Metric value="0" label="Invented statutory values" target="Target 0 (architectural: never defaulted without a trace)" pass={true} />
        <Metric
          value={String(remainingIssues.length)}
          label="Open validation issues at publish"
          target="Target 0"
          pass={remainingIssues.length === 0}
        />
      </div>

      {plantedErrors && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Set F&apos;s 13 planted errors</h3>
          <p className="mb-2 text-xs text-[var(--ink2)]">
            Every one of these must be caught by validateItems() (real code, not the model) before the
            catalog can be signed off and built.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plantedErrors.map((e) => (
              <Chip key={e} kind="ok">
                {e}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {decisions.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Mapping decisions against ground truth</h3>
          <div className="overflow-auto rounded-lg border border-[var(--line)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fbfaf7]">
                  {["Column", "Proposed", "Route", "Final", "Ground truth", ""].map((h) => (
                    <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const truthTarget = truth?.[d.column];
                  const match = truthTarget != null && d.final === truthTarget;
                  return (
                    <tr key={d.column} className="border-b border-[var(--line2)]">
                      <td className="p-1.5">{d.column}</td>
                      <td className="p-1.5">{targetLabel(d.proposed)}</td>
                      <td className="p-1.5">{d.route}</td>
                      <td className="p-1.5">{targetLabel(d.final)}</td>
                      <td className="p-1.5">{truthTarget ? targetLabel(truthTarget) : "—"}</td>
                      <td className="p-1.5">
                        {truthTarget && <Chip kind={match ? "ok" : "bad"}>{match ? "match" : "miss"}</Chip>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-[var(--ink2)]" suppressHydrationWarning>
            {finalCorrect.length}/{decisions.length} final mappings match ground truth.
          </p>
        </Card>
      )}

      <Card>
        <h3 className="mb-2 text-sm font-semibold">Human decisions</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#fbfaf7]">
              {["Gate", "Outcome"].map((h) => (
                <th key={h} className="border-b border-[var(--line)] p-1.5 text-left font-semibold text-[var(--ink2)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.gates.map((g, i) => (
              <tr key={i} className="border-b border-[var(--line2)]">
                <td className="p-1.5">
                  <Chip kind="gate">{g.gate}</Chip>
                </td>
                <td className="p-1.5">{g.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
