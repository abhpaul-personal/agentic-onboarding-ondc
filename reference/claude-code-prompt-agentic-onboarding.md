# Claude Code prompt: Agentic Onboarding for ONDC Sellers

Paste everything below the line into Claude Code, from an empty folder. Before you start, put these in a `reference/` folder in that empty folder:

- `reference/demo/index.html`: the case-study demo (download it from the artifact, or ask Claude to send you the file)
- `reference/eval-kit-v1.zip`: the synthetic evaluation kit
- `reference/PRD.docx`: the PRD

---

## Role and working style

You are building a production version of my personal case-study project, **Agentic Onboarding for ONDC Sellers**. I am a product manager. Work PRD-first and milestone by milestone. At the end of every milestone, stop, show me what changed, run the tests, and wait for my go-ahead before starting the next one. Ask me before any step that costs money, creates cloud resources or pushes to GitHub.

Read `reference/PRD.docx`, `reference/demo/index.html` and the files inside `reference/eval-kit-v1.zip` before you write any code. The demo is the functional and visual reference. The PRD is the source of truth for scope, gates, metrics and guardrails.

## What we are building

A public web app I can link from my portfolio and CV. It must open with the problem statement and show, end to end, how an agentic onboarding flow with human gates solves it.

**Problem statement for the landing page (use this wording, you may tighten it):**
Small sellers get onboarded to ONDC through seller apps, but far fewer go live with a complete, compliant catalog. Seller apps re-key catalogs by hand from Excel sheets, price-list photos and WhatsApp messages, and statutory fields such as MRP, net quantity and FSSAI licence are often missing. This project shows an agentic onboarding flow that does the extraction, mapping and checking, while a human approves every step that carries legal or financial risk.

**The flow (from the PRD):**
- Stage 1, once per seller: S1 seller intake agent, S2 verification agent, gate G0 (seller app reviewer approves the seller). Bulk onboarding of many sellers from one CSV is supported.
- Stage 2, per catalog: 1 source intake, 2 extraction, gate G1 (seller confirms extracted items, only for photo and text sources), 3 category agent, 4 smart mapping agent, gate G2 (reviewer approves risky mappings, plus the fallback queue), 5 validation, gate G3 (seller signs off statutory fields), 6 catalog builder, gate G4 (pilot phase of 10 items, then full catalog), 7 publish to a mock seller app and monitor.
- Routing rule for mappings: low-risk fields at confidence 0.90 or above are auto-accepted, high-risk fields (prices, net quantity, FSSAI, packer, veg mark, return terms) always go to a human, anything below 0.60 goes to the fallback queue.
- Guardrail: an agent never invents a statutory value. It may only extract it from the source, pre-fill it from the approved seller profile, or ask the seller.

## The most important design rule: run the agents once, replay forever

Model calls are expensive, so every agent step must be **run once per unique input and replayed after that**.

1. **Step output cache.** Before any model call, compute `key = sha256(step_name + prompt_version + schema_version + model_id + canonical_json(normalised_input))`. If the key exists in the cache, return the stored output and do not call the model. If it does not exist, call the model, validate the output with the step's zod schema, then store it with metadata (key, step, created_at, model_id, input hash, token usage).
2. **Column-level cache for mapping.** Also cache single-column decisions keyed by `sha256(normalised_header + top_5_distinct_sample_values + schema_version)`, so a new file that repeats a known column does not need a new call.
3. **Mapping templates.** When a reviewer approves mappings at G2, save them as a template keyed by source format fingerprint (sorted header set). A later file with the same fingerprint starts pre-mapped and only unknown columns go to the model.
4. **Never cache human decisions.** Gate approvals, edits and rejections are stored per run in the audit log, not in the cache.
5. **Invalidation is by key only.** Bumping `PROMPT_VERSION`, `SCHEMA_VERSION` or the model ID changes the key, so stale outputs are never replayed. No time-based expiry.
6. **Warm the cache for the sample sets and commit it.** Add a script `npm run agents:warm` that runs every agent step for every sample set in the eval kit exactly once against the real model, and writes the outputs to `data/cache/<key>.json`. I run it once locally with my API key, review the outputs, and commit them. The deployed public site then replays those committed files and needs **no API key and spends no tokens**.
7. **Show it honestly in the UI.** Every agent step shows a badge: "Replayed from cache · run on <date> with <model>" or "Live agent run". Show cumulative token usage and estimated cost saved by cache hits on the scorecard.
8. Storage: committed JSON files in `data/cache/` for sample sets. For live runs in production, use Upstash Redis from the Vercel Marketplace, behind a small `CacheStore` interface with a file-system implementation for local dev and tests.

## Modes

- **Demo mode (default, public):** sample sellers only, every agent step served from the committed cache. Uploads of real files are disabled on the public site.
- **Live mode (owner only):** enabled only when `ANTHROPIC_API_KEY` is set and the visitor enters `LIVE_MODE_PASSPHRASE`. Runs real model calls for a new upload, writes to the cache, and is rate limited (for example 10 runs per hour). Show a clear notice that live mode is for the owner's testing.

## Stack and repo

- Next.js (App Router) with TypeScript and Tailwind CSS, deployed on Vercel. Server-side route handlers for every model call; the API key never reaches the browser.
- Anthropic TypeScript SDK. Read the model ID from `ANTHROPIC_MODEL` with a sensible current default (for example `claude-sonnet-5-5`). Use structured output: ask for JSON, validate with zod, retry once on a schema failure, then route to the fallback queue.
- zod for every agent input and output schema. Vitest for unit tests. Playwright for one end-to-end test per sample set.
- GitHub repo `abhpaul-personal/agentic-onboarding-ondc` (public), created with `gh repo create` after I confirm. Conventional commits, one PR per milestone.
- Vercel project linked to the repo, preview deployments on PRs, production on `main`.

## Pages

1. `/`: landing page. Problem statement, the onboarded-versus-live gap with sources (Policy Circle, early 2025: 7 lakh+ sellers onboarded across 72 seller apps; Cross-Border Magazine, July 2026: 2 lakh+ retail merchants active; note that sources count sellers differently), the two-stage flow with the five gates, and buttons to run the demo and read the case study.
2. `/demo`: pick a sample seller (sets B, C, D, F and the bulk set G, as in the reference demo), then walk through every agent step and gate with the timeline on the left, the step in the middle and the audit log on the right.
3. `/scorecard`: metrics computed from the run against ground truth: auto-accept precision, auto-map rate, fallback rate, planted errors caught (set F), invented statutory values (must be 0), time to publish-ready, plus cache hits, tokens used and tokens saved.
4. `/kit`: evaluation kit table with per-file downloads and the full zip from `public/kit/`.
5. `/case-study`: a readable write-up: problem, users, approach, the human-gate design, the run-once cache, results from the scorecard, what I would do next. Link the PRD.
6. Footer on every page: "Personal case-study project. Not affiliated with ONDC or any network participant. All sellers and identifiers are fictional test data." Links to GitHub and my LinkedIn (linkedin.com/in/abhpaul) and portfolio (https://abhijit-paul-portfolio-pm.vercel.app).

## Engineering requirements

- Port the deterministic checks from the reference demo into `lib/checks/` as pure TypeScript with unit tests: GSTIN format and checksum, GSTIN state code, PAN format and match inside GSTIN, FSSAI format and expiry, IFSC format, GTIN-13 check digit, MRP at or above selling price, duplicate SKUs, unsupported claims in descriptions (organic, handmade, sugar-free and similar), required statutory fields after profile pre-fill.
- Agent steps live in `lib/agents/<step>.ts`, each with a versioned prompt file, an input schema, an output schema and a cache wrapper. No step may write a statutory value that is not present in its input; add a test that fails if it does.
- The orchestrator is a state machine (`lib/orchestrator.ts`) that can pause at any gate and resume. Store run state in the URL-safe run ID plus the cache store, not in the browser alone.
- Accessibility: keyboard reachable gates, labelled form controls, colour is never the only signal.
- Performance: the public demo must load fast and work with JavaScript-light pages where possible; no model calls on page load.
- Security: no secrets in the client, server-side validation of every gate action, rate limiting on live mode, and no storage of uploaded files beyond 24 hours.
- Copy: plain, human tone. Do not use dashes or em dashes to join clauses in UI copy or the README; use commas or new sentences. Call rollout stages "phases", never "waves".
- Do not use ONDC's logo or brand styling, and do not name any real seller app as a partner.

## Milestones (stop after each one for my review)

- **M0 Setup:** repo, Next.js app, Tailwind, lint, tests, Vercel preview, README skeleton with the problem statement. Import the eval kit into `public/kit/` and `data/sets/`.
- **M1 Checks and schemas:** deterministic checks with unit tests, zod schemas for all agent inputs and outputs, local ONDC-style target schema from the kit's golden catalogs.
- **M2 Cache layer:** `CacheStore` interface, file and Upstash implementations, key function, tests that prove a second identical call makes no model request.
- **M3 Agents:** all agent steps with prompts and schemas, the `agents:warm` script, and a dry run on set B that I review before you warm all sets.
- **M4 Orchestrator and gates:** both stages, all five gates, fallback queue, audit log, mapping templates.
- **M5 Demo UI:** the demo, scorecard and kit pages, matching the reference demo's behaviour, with cache badges.
- **M6 Landing and case study pages:** problem-first landing page and the case-study write-up.
- **M7 Hardening:** Playwright end-to-end runs for sets B, C, D, F and G, accessibility pass, live mode with passphrase and rate limit, Lighthouse check.
- **M8 Launch:** production deploy on Vercel, README with screenshots and the scorecard numbers, and a short changelog.

## Acceptance criteria

- The production URL works with no API key set, and every sample run is served entirely from the committed cache (zero model calls, visible on the scorecard).
- Running `npm run agents:warm` twice in a row makes model calls only the first time.
- All five gates block progress until a person acts, and every action appears in the audit log.
- Set F scorecard shows 13 of 13 planted errors caught and 0 invented statutory values.
- Set G shows both planted seller errors (invalid GSTIN checksum, expired FSSAI licence) caught before G0.
- Lighthouse accessibility score of 90 or more on `/` and `/demo`.
- README explains the problem, the approach, the run-once cache, how to run locally, how to warm the cache, and the licences (data CC BY 4.0, code MIT).

---

## Appendix: copy for my portfolio and CV (draft, for me to edit)

**Portfolio card**
Agentic Onboarding for ONDC Sellers. Small sellers get onboarded to ONDC, but far fewer go live with a complete, compliant catalog. I designed and built an agentic onboarding flow that turns messy seller files into ONDC-ready catalogs, with five human gates for anything legal or financial and a run-once cache that replays agent results instead of paying for the same model call twice. Live demo, evaluation kit and PRD linked.

**CV line (personal projects)**
Agentic Onboarding for ONDC Sellers (personal project, live on Vercel): designed and built a two-stage seller and catalog onboarding flow with AI-assisted field mapping, five human approval gates and a run-once agent cache; ships with a synthetic evaluation kit that catches 13 of 13 planted catalog errors.
