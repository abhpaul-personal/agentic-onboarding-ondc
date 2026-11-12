# Changelog

Built milestone by milestone, PRD-first. See
`reference/claude-code-prompt-agentic-onboarding.md` for the milestone plan and
[docs/PRD.md](docs/PRD.md) for the full spec.

## M8: launch

Production deploy on Vercel. LICENSE file (MIT for code). README gained
screenshots, real scorecard numbers, cache-warming and live-mode instructions.

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
