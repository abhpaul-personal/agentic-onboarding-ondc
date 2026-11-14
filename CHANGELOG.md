# Changelog

Built milestone by milestone, PRD-first. See
`reference/claude-code-prompt-agentic-onboarding.md` for the milestone plan and
[docs/PRD.md](docs/PRD.md) for the full spec.

## GSTIN misread no longer dead-ends G0

The seller-intake agent's vision read of a synthetic GST certificate was
misreading the certificate's run of "Z" placeholder characters on every
sample set, not just one, because the v1 prompt's own example told it to
"correct" the form's GSTIN from the certificate. A new v2 prompt states the
15-character GSTIN rule, warns that repeated letters are easy to misread,
and tells the model to keep a well-formed form GSTIN over a malformed
certificate reading, naming both values in its notes. Real model runs
confirm every sample seller now passes every G0 check on attempt 1 with the
form's valid GSTIN.

Set C stays the one deliberate case: its first attempt is pinned to the v1
prompt via a `plantedIntakeMisread` flag, so the committed, already-real
misread entry keeps replaying unchanged (the attempt-1 cache key gains no
new fields, so it is byte-identical to before). Sending it back now replays
a second real model call: attempt 2 uses the v2 prompt plus the failed
attempt as feedback, both folded into the cache key alongside the prompt
version, so a retry can never collide with or invalidate attempt 1. If no
retry has been warmed for a given set, Send back falls back to the existing
correction panel instead of dead-ending. `npm run agents:warm` now refuses
to finish if any set would still be stuck: every set but the planted one
must pass G0 on attempt 1, and the planted set must fail attempt 1 and pass
attempt 2.

## Agent cache warmed against the real model

`npm run agents:warm` run for the first time against the real model for every
sample set, which surfaced and fixed several real bugs no unit test had
covered: current models reject forced `tool_choice`; adaptive thinking's
token spend needed a larger `max_tokens` budget; a blank `ANTHROPIC_MODEL`
in `.env.local` wasn't falling back to the default; a Shopify-style variant
export left names blank past a group's first row; and "Approve mappings"
crashed on any column needing G2 review. Also added a "Send back" action at
the single-seller G0 gate, so a failing verification check (which a
synthetic GST certificate's vision misread can trigger non-deterministically)
no longer leaves the reviewer stuck.

## M8: launch

Production deploy on Vercel, with Upstash Redis backing the run-state store
(a run's state has to persist across serverless invocations between
finishing Stage 1 and opening its scorecard, which a committed file store
can't do on a read-only production filesystem). LICENSE file (MIT for
code). README gained screenshots, real scorecard numbers, cache-warming
and live-mode instructions, and the live URL.

## M7: hardening

Playwright end-to-end runs for sample sets B, C, D, F and G, plus the landing,
kit, case-study and scorecard pages. An accessibility pass with axe-core found
and fixed a WCAG AA contrast failure and a heading-order skip; all four main
pages now score 100 on Lighthouse's accessibility, performance,
best-practices and SEO categories. Owner-only live mode: passphrase check,
10-runs-per-hour rate limit, and a banner on `/demo` that unlocks it.

## M6: landing and case-study pages

Problem-first landing page with the onboarded-versus-live gap and the
two-stage, five-gate flow. Case-study write-up: problem, approach, the
run-once cache, results, what's next.

## M5: demo UI, scorecard, kit pages

`/demo` walks every sample seller through its agent steps and gates, with a
timeline, the step panel and an audit log. `/scorecard` computes metrics
against ground truth. `/kit` lists the evaluation kit with per-file and full
downloads. Every agent step shows a cache-provenance badge; a step not yet
warmed shows an honest placeholder instead of a live call.

## M4: orchestrator and gates

State-machine orchestrator for both stages, all five gates, the fallback
queue, mapping templates and the audit log. Packer-details rule reworked
twice from real set B data: a branded item is never defaulted to the seller,
only an item with no brand or one of the seller's own declared brands is
self-packed. Deterministic parsers for messy net-quantity and
manufacturing-date columns, each raising a fallback-queue issue rather than
silently becoming blank or NaN on an unrecognised format.

## M3: agents, prompts and the warm script

Agent steps for seller intake, extraction, smart mapping and category, each
with a versioned prompt, zod input/output schemas and a cache wrapper.
`npm run agents:warm` runs every step once per sample set against the real
model and writes the result to `data/cache/`.

## M2: cache layer

`CacheStore` interface with file-system (local, committed cache) and Upstash
(production) implementations. Content-addressed keys from the step name,
prompt version, schema version, model ID and normalised input, plus a
column-level cache for mapping and per-format mapping templates.

## M1: deterministic checks and schemas

GSTIN, PAN, FSSAI, IFSC and GTIN-13 checks ported to pure TypeScript with unit
tests. zod schemas for every agent input and output, and a local ONDC-style
target schema built from the kit's golden catalogs.

## M0: setup

Next.js App Router project, TypeScript, Tailwind, lint, tests, Vercel
preview. Evaluation kit imported into `public/kit/` and `data/sets/`.
