import Link from "next/link";
import { Card, Chip } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid grid-cols-[1.25fr_1fr] gap-6 max-md:grid-cols-1">
        <div>
          <span className="mb-3 inline-block">
            <Chip kind="neutral">Case study</Chip>
          </span>
          <h1 className="mb-3 text-[32px] leading-[1.15] font-semibold tracking-tight">
            Small sellers get onboarded to ONDC, but far fewer go live with a complete, compliant
            catalog.
          </h1>
          <p className="max-w-[60ch] text-[var(--ink2)]">
            Seller apps re-key catalogs by hand from Excel sheets, price-list photos and WhatsApp
            messages. Statutory fields such as MRP, net quantity and FSSAI licence are often missing.
            This project shows an agentic onboarding flow that does the extraction, mapping and
            checking, while a human approves every step that carries legal or financial risk.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/demo"
              className="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 font-semibold text-white no-underline"
            >
              Run the demo
            </Link>
            <Link
              href="/case-study"
              className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-2 font-semibold text-[var(--ink)] no-underline hover:border-[var(--ink3)]"
            >
              Read the case study
            </Link>
          </div>
        </div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">The gap this targets</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <b className="block text-2xl tracking-tight">7 lakh+</b>
              <span className="text-xs text-[var(--ink2)]">
                sellers onboarded across 72 seller apps, early 2025 (
                <a
                  href="https://www.policycircle.org/industry/ondc-faces-growth-pangs-e-commerce/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Policy Circle
                </a>
                )
              </span>
            </div>
            <div>
              <b className="block text-2xl tracking-tight">2 lakh+</b>
              <span className="text-xs text-[var(--ink2)]">
                retail merchants active, July 2026 (
                <a
                  href="https://cross-border-magazine.com/ondc-500-million-transactions-india/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Cross-Border Magazine
                </a>
                )
              </span>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-[var(--ink3)]">
            Sources count sellers differently, so read this as direction, not an exact funnel.
          </p>
        </Card>
      </section>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">How the flow works</h2>
        <p className="mb-3 text-sm text-[var(--ink2)]">
          Stage 1 runs once per seller. Stage 2 runs for every catalog that seller adds. Nothing is
          published by default.
        </p>

        <div className="mb-1 text-[11px] font-bold tracking-wider text-[var(--ink3)] uppercase">
          Stage 1 · Seller onboarding
        </div>
        <FlowRow
          items={["S1 Seller intake agent", "S2 Verification agent", "G0 SNP reviewer approves the seller"]}
          gateIndex={2}
        />

        <div className="mt-4 mb-1 text-[11px] font-bold tracking-wider text-[var(--ink3)] uppercase">
          Stage 2 · Catalog onboarding, per seller
        </div>
        <FlowRow
          items={[
            "1 Source intake",
            "2 Extraction",
            "G1 Seller confirms items",
            "3 Smart mapping",
            "G2 Reviewer approves mappings",
            "4 Category agent",
            "5 Validation",
            "G3 Seller signs off statutory fields",
            "6 Catalog builder",
            "G4 Pilot phase, then full catalog",
            "7 Publish and monitor",
          ]}
          gateIndex={[2, 4, 7, 9]}
        />
        <p className="mt-3 text-xs text-[var(--ink2)]">
          Anything the mapping or validation agent cannot resolve goes to the fallback queue and comes
          back through G2. For a spreadsheet catalog, category runs after mapping and G2 resolve each
          item&apos;s real name, not before; for a photo or WhatsApp catalog, extraction already gives
          each item a name, so category runs right after G1.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <Card>
          <span className="mb-2 inline-block">
            <Chip kind="sim">Agent step</Chip>
          </span>
          <p className="text-sm">
            Agent steps call the model once per unique input, then replay from a committed cache — the
            public demo site never calls the model live.
          </p>
        </Card>
        <Card>
          <span className="mb-2 inline-block">
            <Chip kind="real">Real check</Chip>
          </span>
          <p className="text-sm">
            Deterministic checks run as real code, not the model: GSTIN checksum, PAN match, FSSAI
            expiry, IFSC format, GTIN check digit, MRP versus price, duplicates and required fields.
          </p>
        </Card>
        <Card>
          <span className="mb-2 inline-block">
            <Chip kind="gate">Human gate</Chip>
          </span>
          <p className="text-sm">
            Five gates stop the flow until a named person approves. Every approval, edit and rejection
            lands in the audit log.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Smart mapping, in one rule</h2>
        <p className="text-sm">
          Every proposed field mapping carries a confidence score and a one-line reason that quotes the
          seller&apos;s own values. Low-risk fields at 0.90 or above are auto-accepted. Prices, net
          quantity, FSSAI, packer and veg marks always go to a human. Anything below 0.60 goes to the
          fallback queue. The agent never invents a statutory value: it can only extract it, pre-fill it
          from the approved seller profile, or ask. A branded item is never defaulted to the seller —
          the seller copies the brand owner&apos;s packer details from the pack label once per brand.
        </p>
      </Card>

      <p className="text-xs text-[var(--ink3)]">
        All sellers, people, GSTINs, PANs, FSSAI numbers, bank details and barcodes are fictional test
        data. ONDC attribute keys are modelled on the public retail v1.2 specs and simplified for the
        demo.
      </p>
    </div>
  );
}

function FlowRow({ items, gateIndex }: { items: readonly string[]; gateIndex: number | readonly number[] }) {
  const gateIndexes = new Set(Array.isArray(gateIndex) ? gateIndex : [gateIndex]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-1.5">
          <span
            className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium ${
              gateIndexes.has(i)
                ? "border-[#c7c2f7] bg-[var(--gate-soft)] font-semibold text-[var(--gate)]"
                : "border-[var(--line)] bg-white"
            }`}
          >
            {item}
          </span>
          {i < items.length - 1 && <span className="text-[var(--ink3)]">→</span>}
        </span>
      ))}
    </div>
  );
}
