# Agentic Onboarding for ONDC Sellers

Personal case-study project. Not affiliated with ONDC or any network participant.
All sellers and identifiers are fictional test data.

## The problem

Small sellers get onboarded to ONDC through seller apps, but far fewer go live with a
complete, compliant catalog. Seller apps re-key catalogs by hand from Excel sheets,
price-list photos and WhatsApp messages, and statutory fields such as MRP, net quantity
and FSSAI licence are often missing. This project shows an agentic onboarding flow that
does the extraction, mapping and checking, while a human approves every step that
carries legal or financial risk.

## The approach

A two-stage flow runs under one orchestrator:

- **Stage 1** (once per seller): seller intake agent, verification agent, gate G0
  (seller app reviewer approves the seller). Supports bulk onboarding from one CSV.
- **Stage 2** (per catalog): source intake, extraction, gate G1 (seller confirms
  extracted items, for photo and text sources), category agent, smart mapping agent,
  gate G2 (reviewer approves risky mappings, plus the fallback queue), validation, gate
  G3 (seller signs off statutory fields), catalog builder, gate G4 (pilot phase, then
  full catalog), publish to a mock seller app and monitor.

Mappings route by confidence and field risk: low-risk fields at 0.90 or above are
auto-accepted, high-risk fields (prices, net quantity, FSSAI, packer, veg mark, return
terms) always go to a human, and anything below 0.60 goes to a fallback queue. An agent
never invents a statutory value — it may only extract it from the source, pre-fill it
from the approved seller profile, or ask the seller.

## Run once, replay forever

Model calls are expensive, so every agent step runs once per unique input and is
replayed after that:

- A step output cache, keyed by a hash of the step name, prompt version, schema
  version, model ID and the normalised input.
- A column-level cache for mapping decisions.
- Mapping templates saved per source format fingerprint once a reviewer approves them
  at G2.
- Human decisions are never cached — they are recorded per run in the audit log.

The deployed public site runs in demo mode: every sample-set agent step replays from a
committed cache (see `data/cache/`), so it needs no API key and spends no tokens. Live
mode (owner only) runs real model calls behind a passphrase and rate limit.

## Status

This repo is being built milestone by milestone, PRD-first. See
`reference/claude-code-prompt-agentic-onboarding.md` for the milestone plan.

- [x] M0: setup, eval kit imported, tests running
- [x] M1: deterministic checks, zod schemas, target schema
- [x] M2: cache layer
- [x] M3: agents and the warm script (code ready; real warm run pending a valid API key)
- [ ] M4: orchestrator and gates
- [ ] M5: demo UI, scorecard, kit pages
- [ ] M6: landing and case-study pages
- [ ] M7: hardening and live mode
- [ ] M8: launch

## Running locally

```bash
npm install
npm run dev
```

```bash
npm run lint
npm run test
npm run build
```

## Evaluation kit

The synthetic evaluation kit (seven sample sellers and catalogs, with ground truth) is
in `public/kit/` (served to visitors) and `data/sets/` (read by server code). Score a
run against a set's ground truth:

```bash
python3 public/kit/score.py public/kit/set-B/ground_truth/field_mapping.json my_run.json
```

## Licence

Evaluation kit data: CC BY 4.0. Code: MIT.
