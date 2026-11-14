import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Case study",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="max-w-[72ch] space-y-3 text-[15px] leading-[1.6] text-[var(--ink)]">{children}</div>
    </section>
  );
}

export default function CaseStudyPage() {
  return (
    <article className="space-y-10">
      <header>
        <h1 className="mb-2 text-[30px] font-semibold tracking-tight">
          Agentic Onboarding for ONDC Sellers
        </h1>
        <p className="max-w-[72ch] text-[var(--ink2)]">
          A personal case-study project: an agentic onboarding flow that turns a small seller&apos;s
          messy product list into an ONDC-ready retail catalog, with a human approving every step that
          carries legal or financial risk. Built on public specifications and synthetic data only; not
          affiliated with ONDC or any network participant.
        </p>
      </header>

      <Section title="The problem">
        <p>
          Sellers don&apos;t connect to ONDC directly — they join through a seller app (an SNP), which
          digitises their catalog and pushes it to the network. Category and attribute completeness
          matter more here than on a single marketplace, because one listing is discovered across many
          buyer apps. Small sellers still describe onboarding as long and complex, and how much
          cataloguing help they get depends entirely on which SNP they join.
        </p>
        <p>
          The case study imagines a fictional SNP&apos;s catalog operations team, re-keying catalogs by
          hand from Excel sheets, price-list photos and WhatsApp messages. The goal: cut the time from a
          seller&apos;s first upload to a publish-ready catalog, without letting a wrong price, net
          quantity or FSSAI number reach buyers.
        </p>
      </Section>

      <Section title="Users">
        <p>
          Four people touch the flow. <b>Meena</b>, a fictional seller running a home-made pickles
          business in Nashik, keeps her price list in a notebook and on WhatsApp — she needs to list
          products without learning a catalog format, and stay in control of prices and legal details. A{" "}
          <b>catalog ops reviewer</b> at the SNP onboards 20–30 sellers a week and wants to review only
          what the agent is unsure about, with the reason shown. An <b>SNP onboarding lead</b> owns
          activation numbers and wants a faster time to first live listing with an audit trail. And an{" "}
          <b>evaluator</b> — a hiring manager, engineer or another PM — wants to run the whole flow on
          sample data in minutes and see how it scores.
        </p>
      </Section>

      <Section title="Approach">
        <p>
          The flow runs in two stages under one orchestrator, built as a state machine so it can pause at
          any gate for days and resume exactly where it stopped. <b>Stage 1</b> onboards a seller once:
          a seller-intake agent reads the registration form and specimen documents, a verification agent
          checks formats (GSTIN, PAN, FSSAI, IFSC) and runs a simulated ID match, and the SNP reviewer
          approves at G0. <b>Stage 2</b> runs per catalog, repeating whenever the seller adds a new one:
          source intake, extraction, a seller confirmation gate for unstructured sources, smart mapping,
          a reviewer gate, category classification, deterministic validation, a seller sign-off gate,
          catalog build, a two-phase publish gate, and publish.
        </p>
        <p>
          Smart mapping profiles each source column, proposes a target ONDC attribute with a confidence
          score and a reason that quotes the seller&apos;s own sample values, and routes the decision by
          confidence and the field&apos;s risk class: low-risk fields at 0.90 or above auto-accept,
          high-risk fields (prices, net quantity, FSSAI, packer, veg mark, return terms) always go to a
          human, and anything below 0.60 goes to a fallback queue. Deterministic rules handle what they
          can — currency symbols, unit conversions, GSTIN and GTIN checksums — before any model call.
        </p>
      </Section>

      <Section title="The human-gate design">
        <p>
          The rule behind every gate: an agent may extract, suggest and check, but a human owns every
          value that is legal, financial or customer-facing at scale. Nothing publishes by default. Five
          gates enforce this — seller approval, extraction confirmation, mapping review, statutory
          sign-off, and a phased publish approval — and every approval, edit and rejection is written to
          an audit log.
        </p>
        <p>
          The no-invention guardrail runs deeper than a prompt instruction. A branded item (one carrying
          someone else&apos;s brand, not the seller&apos;s own) is never defaulted to the seller&apos;s
          own packer details — building its ONDC catalog entry throws rather than guessing if the seller
          hasn&apos;t entered the brand owner&apos;s pack-label details at G3. That boundary is enforced
          in code, not just asked of the model.
        </p>
      </Section>

      <Section title="The run-once cache">
        <p>
          Model calls are expensive, so every agent step calls the model only the first time it sees a
          given input. Its output is cached under a key built from a hash of the normalised input, the
          step name, the prompt version, the target schema version and the model ID — change any of
          those and the key changes, so a stale result is never replayed. Mapping decisions get a second,
          finer cache keyed by just the column header and its sample values, so a repeated column — even
          in a different seller&apos;s file — reuses the decision without a new call. The public demo
          site takes this one step further: it only ever replays from a cache committed to the repo,
          never calling the model live, so running the demo costs nothing and needs no API key.
        </p>
      </Section>

      <Section title="Results">
        <p>
          The <Link href="/scorecard" className="underline">scorecard</Link> computes real metrics from
          whatever you actually did in a run — auto-accept precision and auto-map rate against the eval
          kit&apos;s ground truth, fallback queue rate, and time to publish-ready. Running the set G
          cooperative&apos;s bulk flow catches both of its planted seller errors (an invalid GSTIN
          checksum and an expired FSSAI licence) with real deterministic code, not a model. All seven
          sample sets are warmed against the real model and replay from a committed cache on the live
          demo, so every step (mapping, category, extraction) shows real output, not a placeholder.
        </p>
        <p>
          The guardrail design caught a real failure, not a staged one. Warming the cache exposed that
          the seller-intake agent&apos;s vision read of a synthetic GST certificate can misread the
          GSTIN&apos;s run of repeated characters — on more than one sample seller, confirmed by viewing
          the certificate images directly: they are correct, the model&apos;s transcription is not. The
          deterministic GSTIN checksum check (real code, not the model) correctly failed the result every
          time and blocked auto-approval at G0, exactly the deterministic-check-plus-human-gate design
          this project is built around. The one gap it exposed was in the UI, not the guardrail: a seller
          whose check failed had no way forward, only a disabled approve button. That is fixed now with a
          send-back-and-correct step, so the reviewer sends the seller back, the seller compares the
          flagged value against the certificate and corrects it, and the real checks run again before
          returning to G0 — with the original misread kept in the audit log, never edited over.
        </p>
      </Section>

      <Section title="What I would do next">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Finish multimodal intake (price-list photo, WhatsApp text) end to end, with G1 confirmation.</li>
          <li>Add per-tenant workspaces, gate policy and a REST API (FR-22 to FR-25), for the standalone-SaaS positioning.</li>
          <li>
            Beyond version 1: a credit-readiness summary for a seller verified at G0 with a clean
            catalog, shared only with explicit consent and within RBI&apos;s digital lending rules.
          </li>
        </ul>
      </Section>

      <Card>
        <h3 className="mb-1 text-sm font-semibold">Read more</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href="https://github.com/abhpaul-personal/agentic-onboarding-ondc/blob/master/docs/PRD.md"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent)] underline"
          >
            Full PRD
          </a>
          <Link href="/demo" className="font-semibold text-[var(--accent)] underline">
            Run the demo
          </Link>
          <Link href="/kit" className="font-semibold text-[var(--accent)] underline">
            Download the evaluation kit
          </Link>
        </div>
      </Card>
    </article>
  );
}
