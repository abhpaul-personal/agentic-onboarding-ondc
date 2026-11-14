/**
 * Runs every agent step once per sample set, against the real model, and
 * writes the outputs to data/cache/. Run it once locally with your own
 * API key, review the outputs, then commit the cache: the deployed public
 * site replays these files and never calls the model.
 *
 * Usage:
 *   npm run agents:warm                 # dry run: set B only (review before --all)
 *   npm run agents:warm -- --set=D      # a specific set
 *   npm run agents:warm -- --all        # every set (A-F; G has no catalog to warm)
 *   npm run agents:warm -- --all --intake-only   # only the seller-intake step (and set C's retry)
 *
 * The seller-intake step refuses to leave a dead end in the cache: after
 * warming, every set except the one flagged plantedIntakeMisread must pass
 * every G0 check on its first attempt, and that set must fail on attempt 1
 * and pass on attempt 2. If not, this exits non-zero instead of letting a
 * seller the reviewer can never approve be committed and replayed.
 *
 * Needs ANTHROPIC_API_KEY. Costs real money per the PRD's "under $0.50 for
 * a first run of a 50-item catalog" target; running it twice in a row
 * makes no model calls the second time (M2's cache layer).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { config as loadEnv } from "dotenv";

// Loaded before any other project import, so ANTHROPIC_API_KEY from a local
// .env.local (gitignored) is available regardless of which shell runs this.
loadEnv({ path: join(process.cwd(), ".env.local") });
loadEnv(); // .env, without overriding anything .env.local already set

import { createCacheStore } from "@/lib/cache";
import { getAnthropicClient, defaultModelId } from "@/lib/llm/client";
import { parseCsvRecords } from "@/lib/parse/csv";
import { profileColumns } from "@/lib/parse/profile-columns";
import { runSellerIntakeAgent } from "@/lib/agents/seller-intake";
import { verifySellerChecks } from "@/lib/agents/verification";
import { buildIntakeInput, intakePromptVersionFor, priorAttemptFrom } from "@/lib/demo/intake-attempts";
import { runMappingAgent } from "@/lib/agents/mapping";
import { runCategoryAgent } from "@/lib/agents/category";
import { runExtractionAgent } from "@/lib/agents/extraction";
import { buildItemsFromMappedColumns } from "@/lib/orchestrator/build-items";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import { getSampleSet } from "@/lib/demo/sample-sets";

const DATA_DIR = join(process.cwd(), "data/sets");

interface StructuredSetConfig {
  kind: "structured";
  set: string;
  catalogFile: string;
}

interface UnstructuredSetConfig {
  kind: "whatsapp_text" | "price_list_photo";
  set: string;
  sourceFile: string;
}

type SetConfig = StructuredSetConfig | UnstructuredSetConfig;

// Each set's allowed category list lives once, in SampleSetMeta
// (src/lib/demo/sample-sets.ts), read below via getSampleSet — not
// duplicated here, since the live demo's catalogRunCategory must build
// the exact same category step input or its cache key never matches.
const SET_CONFIGS: Record<string, SetConfig> = {
  A: { kind: "structured", set: "A", catalogFile: "set-A/catalog.csv" },
  B: { kind: "structured", set: "B", catalogFile: "set-B/catalog_flat.csv" },
  C: { kind: "structured", set: "C", catalogFile: "set-C/products_export.csv" },
  D: { kind: "whatsapp_text", set: "D", sourceFile: "set-D/whatsapp_export.txt" },
  E: { kind: "price_list_photo", set: "E", sourceFile: "set-E/price_list_photo.png" },
  F: { kind: "structured", set: "F", catalogFile: "set-F/catalog.csv" },
  // G is bulk seller onboarding only (Stage 1), no catalog: nothing to warm here.
};

function imageMediaType(path: string): "image/png" | "image/jpeg" {
  return path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";
}

function readImageBase64(relativePath: string) {
  const absolute = join(DATA_DIR, relativePath);
  return { data: readFileSync(absolute).toString("base64"), media_type: imageMediaType(absolute) };
}

function failedChecks(profile: Parameters<typeof verifySellerChecks>[0]) {
  return verifySellerChecks(profile).filter((c) => !c.passed);
}

/**
 * Warms seller intake the way the demo replays it (same input builder, same
 * prompt version per attempt), then checks the result is not a dead end:
 * the planted-misread set (C) must fail G0 on attempt 1 and pass on attempt
 * 2; every other set must pass on attempt 1. Throws otherwise.
 */
async function warmSellerIntake(set: string, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const planted = getSampleSet(set)?.plantedIntakeMisread === true;

  const first = await runSellerIntakeAgent({
    store,
    client,
    model,
    input: buildIntakeInput(set),
    promptVersion: intakePromptVersionFor(set, 1),
  });
  const firstFailures = failedChecks(first.output.profile);
  console.log(
    `  seller-intake attempt 1 (prompt v${intakePromptVersionFor(set, 1)}): ${first.cached ? "cached" : "called model"}` +
      `, GSTIN ${first.output.profile.gstin}, ${firstFailures.length ? "fails " + firstFailures.map((c) => c.name).join(", ") : "passes every G0 check"}`,
  );

  if (!planted) {
    if (firstFailures.length) {
      throw new Error(
        `Set ${set}: seller intake fails G0 on attempt 1 (${firstFailures.map((c) => c.name).join(", ")}). ` +
          `Only the set flagged plantedIntakeMisread may do that; refusing to leave a dead end in the cache.`,
      );
    }
    return first;
  }

  if (!firstFailures.length) {
    throw new Error(
      `Set ${set} is flagged plantedIntakeMisread but its attempt 1 passes every G0 check, so the planted case is gone.`,
    );
  }
  const second = await runSellerIntakeAgent({
    store,
    client,
    model,
    input: buildIntakeInput(set, { attempt: 2, prior: priorAttemptFrom(first.output.profile) }),
    promptVersion: intakePromptVersionFor(set, 2),
  });
  const secondFailures = failedChecks(second.output.profile);
  console.log(
    `  seller-intake attempt 2 (prompt v${intakePromptVersionFor(set, 2)}): ${second.cached ? "cached" : "called model"}` +
      `, GSTIN ${second.output.profile.gstin}, ${secondFailures.length ? "fails " + secondFailures.map((c) => c.name).join(", ") : "passes every G0 check"}`,
  );
  if (secondFailures.length) {
    throw new Error(
      `Set ${set}: the retry still fails G0 (${secondFailures.map((c) => c.name).join(", ")}), so Send back would not unblock the reviewer.`,
    );
  }
  return second;
}

async function warmMapping(config: StructuredSetConfig, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const raw = readFileSync(join(DATA_DIR, config.catalogFile), "utf-8");
  const records = parseCsvRecords(raw);
  const columns = profileColumns(records);
  const columnTargets: Record<string, MappingTargetKey | null> = {};
  let calledModel = 0;
  for (const column of columns) {
    const result = await runMappingAgent({ store, client, model, column });
    if (!result.cached) calledModel++;
    // Matches the demo's own "Approve mappings" button (catalog-panel.tsx):
    // it accepts every column's proposed value as-is, with no per-field
    // overrides (out of scope for M5), so the warm script has to build the
    // same item list or the category step's cache key never matches what a
    // visitor's click actually produces. A misread column (e.g. a Shopify
    // "Handle" mapped to "id" instead of "parent_item_id") is handled
    // downstream in buildItemsFromMappedColumns, not special-cased here.
    columnTargets[column.column] = result.proposal.proposed;
  }
  console.log(`  mapping: ${columns.length} columns, ${calledModel} called the model`);
  return { records, columns, columnTargets };
}

/**
 * Runs the category step on an already-built item list and logs the
 * result. Shared by the structured and unstructured paths below so both
 * build their item list the same way the corresponding live-demo action
 * does, then call the category agent identically.
 */
async function warmCategoryStep(set: string, items: { id: string; name: string; description?: string }[], store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const allowedCategoryIds = getSampleSet(set)?.allowedCategoryIds;
  if (!allowedCategoryIds) throw new Error(`Set ${set} has no allowedCategoryIds configured in sample-sets.ts.`);
  const result = await runCategoryAgent({
    store,
    client,
    model,
    input: { items, allowed_categories: [...allowedCategoryIds] },
  });
  console.log(`  category: ${items.length} items, ${result.cached ? "cached" : "called model"}`);
  return result;
}

/**
 * Builds category input the same way the live demo does
 * (buildItemsFromMappedColumns, then each item's own name/description)
 * rather than reading a raw column directly, so a variant export's
 * forward-filled names and the cache key this produces both match what
 * catalogRunCategory in src/app/demo/actions.ts builds for the same
 * mapped columns.
 */
async function warmCategory(set: string, records: Record<string, string>[], columnTargets: Record<string, MappingTargetKey | null>, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const catalogItems = buildItemsFromMappedColumns(records, columnTargets);
  const items = catalogItems.map((item) => ({ id: item.id, name: item.name, description: item.description }));
  return warmCategoryStep(set, items, store, client, model);
}

async function warmExtraction(config: UnstructuredSetConfig, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const result =
    config.kind === "whatsapp_text"
      ? await runExtractionAgent({
          store,
          client,
          model,
          input: { source_format: "whatsapp_text", raw_text: readFileSync(join(DATA_DIR, config.sourceFile), "utf-8") },
        })
      : await runExtractionAgent({
          store,
          client,
          model,
          input: { source_format: "price_list_photo", image: readImageBase64(config.sourceFile) },
        });
  console.log(`  extraction: ${result.output.items.length} items, ${result.cached ? "cached" : "called model"}`);
  return result;
}

async function warmSet(set: string, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string, intakeOnly: boolean) {
  const config = SET_CONFIGS[set];
  if (!config) {
    console.log(`Set ${set}: nothing to warm (no catalog, or not configured).`);
    return;
  }
  console.log(`Set ${set}:`);
  await warmSellerIntake(set, store, client, model);
  if (intakeOnly) return;
  if (config.kind === "structured") {
    const { records, columnTargets } = await warmMapping(config, store, client, model);
    await warmCategory(set, records, columnTargets, store, client, model);
  } else {
    const extraction = await warmExtraction(config, store, client, model);
    // Matches catalogRunExtraction's item-building for unstructured
    // sources (src/app/demo/actions.ts): id "item-N", no description
    // (not in the extraction output schema).
    const items = extraction.output.items.map((item, index) => ({ id: `item-${index + 1}`, name: item.name }));
    await warmCategoryStep(set, items, store, client, model);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const intakeOnly = args.includes("--intake-only");
  const setArg = args.find((a) => a.startsWith("--set="))?.split("=")[1];
  const sets = all ? ["A", "B", "C", "D", "E", "F"] : [setArg ?? "B"];

  if (!all && !setArg) {
    console.log("No --set or --all given: defaulting to a dry run on set B only.");
    console.log("Review the output, then run with --all to warm every set.\n");
  }

  const store = createCacheStore();
  const client = getAnthropicClient();
  const model = defaultModelId();
  console.log(`Model: ${model}\n`);

  for (const set of sets) {
    await warmSet(set, store, client, model, intakeOnly);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
