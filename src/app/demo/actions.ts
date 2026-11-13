"use server";

import { randomUUID } from "crypto";
import { createCacheStore } from "@/lib/cache";
import { createRunStore } from "@/lib/orchestrator/run-store";
import { defaultModelId, getAnthropicClient } from "@/lib/llm/client";
import { getSampleSet, type SampleSetId } from "@/lib/demo/sample-sets";
import {
  liveModeAvailable,
  verifyPassphrase,
  checkAndIncrementRateLimit,
} from "@/lib/demo/live-mode";
import {
  loadRawRows,
  loadSellerIntakeInput,
  loadWhatsappText,
  loadPriceListPhoto,
  loadBulkSellerRows,
  buildBulkSellerProfiles,
} from "@/lib/demo/load-set-data";
import type { DemoState } from "@/lib/demo/state";
import { peekSellerIntakeCache, runSellerIntakeAgent } from "@/lib/agents/seller-intake";
import { peekExtractionCache, runExtractionAgent } from "@/lib/agents/extraction";
import { peekMappingCache, runMappingAgent } from "@/lib/agents/mapping";
import { peekCategoryCache, runCategoryAgent } from "@/lib/agents/category";
import { runNameMatch, verifySellerChecks } from "@/lib/agents/verification";
import { profileColumns } from "@/lib/parse/profile-columns";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import {
  completeBulkIntake,
  completeBulkVerification,
  approveBulkG0,
  createBulkSellerOnboardingRun,
} from "@/lib/orchestrator/bulk-seller-onboarding";
import {
  completeSellerIntake,
  completeVerification,
  approveSellerG0,
  rejectSellerG0,
  createSellerOnboardingRun,
} from "@/lib/orchestrator/seller-onboarding";
import {
  completeSourceIntake,
  completeExtraction,
  confirmG1,
  completeMapping,
  approveG2,
  completeCategory,
  completeValidation,
  resolveFallbackQueueItem,
  finishFallbackQueue,
  enterPackerDetailsAtG3,
  enterPackerDetailsForBrandAtG3,
  signOffG3,
  completeBuild,
  approveG4Pilot,
  approveG4Full,
  completePublish,
  createCatalogRun,
  type CatalogRunState,
  type FallbackResolution,
} from "@/lib/orchestrator/catalog-run";
import { validateItems } from "@/lib/orchestrator/validate";
import { buildOndcItem } from "@/lib/orchestrator/build-catalog";

const store = createCacheStore();
const runStore = createRunStore();
const model = defaultModelId();

const NOT_WARMED = (step: string) =>
  `This step hasn't been warmed yet. Run "npm run agents:warm" with a valid ANTHROPIC_API_KEY, then it will replay here (step: ${step}).`;

/** Owner-only: can this request call the model live? Returns null for "no, use the cache-only path" (not requested). */
async function liveClientOrThrow(passphrase: string | undefined) {
  if (!passphrase) return null;
  if (!liveModeAvailable()) {
    throw new Error(
      "Live mode is not configured on this deployment (needs ANTHROPIC_API_KEY and LIVE_MODE_PASSPHRASE).",
    );
  }
  if (!verifyPassphrase(passphrase)) {
    throw new Error("Incorrect live-mode passphrase.");
  }
  const { allowed } = await checkAndIncrementRateLimit(store);
  if (!allowed) {
    throw new Error("Live mode rate limit reached (10 runs per hour). Try again later.");
  }
  return getAnthropicClient();
}

/** For the UI to check before prompting: is live mode even possible on this deployment? */
export async function isLiveModeAvailable(): Promise<boolean> {
  return liveModeAvailable();
}

export async function startDemo(setId: SampleSetId): Promise<DemoState> {
  const set = getSampleSet(setId);
  if (!set) throw new Error(`Unknown sample set "${setId}".`);
  if (set.bulk) {
    return { setId, kind: "bulk", bulk: createBulkSellerOnboardingRun(setId) };
  }
  return { setId, kind: "single", seller: createSellerOnboardingRun(setId) };
}

/* ---------------- bulk (set G) ---------------- */

export async function bulkRunIntake(state: DemoState): Promise<DemoState> {
  if (state.kind !== "bulk") throw new Error("Not a bulk run.");
  const rows = loadBulkSellerRows();
  const profiles = buildBulkSellerProfiles(rows);
  return { ...state, bulk: completeBulkIntake(state.bulk, profiles) };
}

export async function bulkRunVerification(state: DemoState): Promise<DemoState> {
  if (state.kind !== "bulk") throw new Error("Not a bulk run.");
  const checksByRow = state.bulk.rows.map((row) => verifySellerChecks(row.profile));
  return { ...state, bulk: completeBulkVerification(state.bulk, checksByRow) };
}

export async function bulkApproveG0(
  state: DemoState,
  reasons: Record<number, string> = {},
): Promise<DemoState> {
  if (state.kind !== "bulk") throw new Error("Not a bulk run.");
  return { ...state, bulk: approveBulkG0(state.bulk, reasons) };
}

/* ---------------- stage 1, single seller ---------------- */

export async function singleRunIntake(state: DemoState, liveModePassphrase?: string): Promise<DemoState> {
  if (state.kind !== "single") throw new Error("Not a single-seller run.");
  const input = loadSellerIntakeInput(state.setId);

  const liveClient = await liveClientOrThrow(liveModePassphrase);
  if (liveClient) {
    const result = await runSellerIntakeAgent({ store, client: liveClient, model, input });
    return { ...state, seller: completeSellerIntake(state.seller, result.output), pending: undefined };
  }

  const output = await peekSellerIntakeCache(store, model, input);
  if (!output) return { ...state, pending: { step: "s1", note: NOT_WARMED("seller-intake") } };
  return { ...state, seller: completeSellerIntake(state.seller, output), pending: undefined };
}

export async function singleRunVerification(state: DemoState): Promise<DemoState> {
  if (state.kind !== "single") throw new Error("Not a single-seller run.");
  if (!state.seller.profile) throw new Error("No profile to verify.");
  const checks = verifySellerChecks(state.seller.profile);
  const nameMatch = runNameMatch({ profile: state.seller.profile });
  return { ...state, seller: completeVerification(state.seller, { checks, nameMatch }) };
}

export async function singleApproveG0(state: DemoState): Promise<DemoState> {
  if (state.kind !== "single") throw new Error("Not a single-seller run.");
  const seller = approveSellerG0(state.seller);
  const set = getSampleSet(state.setId);
  if (!set || !set.sourceFormat || !seller.profile) throw new Error("Set has no catalog to onboard.");
  const catalog = createCatalogRun(state.setId, seller.profile, set.sourceFormat);
  return { ...state, seller, catalog };
}

/** G0 reject: a failing check means the reviewer cannot approve, so they send the seller back instead of being stuck. */
export async function singleRejectG0(state: DemoState): Promise<DemoState> {
  if (state.kind !== "single") throw new Error("Not a single-seller run.");
  const failing = state.seller.checks?.filter((c) => !c.passed).map((c) => c.name) ?? [];
  const reason = failing.length ? failing.join(", ") : "a verification check failed";
  return { ...state, seller: rejectSellerG0(state.seller, reason) };
}

/* ---------------- stage 2, catalog ---------------- */

type SingleDemoStateWithCatalog = Extract<DemoState, { kind: "single" }> & { catalog: CatalogRunState };

function assertCatalog(state: DemoState): asserts state is SingleDemoStateWithCatalog {
  if (state.kind !== "single" || !state.catalog) throw new Error("No catalog run in progress.");
}

export async function catalogRunIntake(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  const set = getSampleSet(state.setId)!;
  const note =
    set.sourceFormat === "csv" || set.sourceFormat === "excel"
      ? `${set.format}, parsed with no errors`
      : set.format;
  return { ...state, catalog: completeSourceIntake(catalog, note) };
}

export async function catalogRunExtraction(state: DemoState, liveModePassphrase?: string): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  const set = getSampleSet(state.setId)!;

  if (set.sourceFormat === "csv" || set.sourceFormat === "excel") {
    const rawRows = loadRawRows(state.setId);
    return { ...state, catalog: completeExtraction(catalog, { rawRows, hadParseErrors: false }) };
  }

  const input =
    set.sourceFormat === "whatsapp_text"
      ? ({ source_format: "whatsapp_text" as const, raw_text: loadWhatsappText(state.setId) })
      : ({ source_format: "price_list_photo" as const, image: loadPriceListPhoto(state.setId) });

  const liveClient = await liveClientOrThrow(liveModePassphrase);
  const output = liveClient
    ? (await runExtractionAgent({ store, client: liveClient, model, input })).output
    : await peekExtractionCache(store, model, input);
  if (!output) return { ...state, pending: { step: "extract", note: NOT_WARMED("extraction") } };
  const items = output.items.map((item, index) => ({
    id: `item-${index + 1}`,
    name: item.name,
    netQty: item.net_qty,
    price: item.price,
    mrp: item.price, // seller confirms/raises this at G1/G3; never invented here
    extractionConfidence: item.confidence,
    sourceExcerpt: item.source_excerpt,
  }));
  return { ...state, catalog: completeExtraction(catalog, { items }), pending: undefined };
}

export async function catalogConfirmG1(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: confirmG1(catalog, {}) };
}

export async function catalogRunMapping(state: DemoState, liveModePassphrase?: string): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  const rows = catalog.rawRows ?? [];
  const columns = profileColumns(rows);

  const liveClient = await liveClientOrThrow(liveModePassphrase);
  const proposals = [];
  for (const column of columns) {
    const proposal = liveClient
      ? (await runMappingAgent({ store, client: liveClient, model, column })).proposal
      : await peekMappingCache(store, column);
    if (!proposal) {
      return {
        ...state,
        pending: { step: "mapping", note: NOT_WARMED(`mapping column "${column.column}"`) },
      };
    }
    proposals.push(proposal);
  }
  return { ...state, catalog: completeMapping(catalog, proposals), pending: undefined };
}

export async function catalogApproveG2(
  state: DemoState,
  resolutions: Record<string, MappingTargetKey | null> = {},
): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: approveG2(catalog, resolutions) };
}

export async function catalogRunCategory(state: DemoState, liveModePassphrase?: string): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  const set = getSampleSet(state.setId)!;
  const allowedCategories = [...new Set(catalog.items.map((i) => i.category).filter((c): c is string => Boolean(c)))];
  const items = catalog.items.map((item) => ({ id: item.id, name: item.name, description: item.description }));
  const input = {
    items,
    allowed_categories: allowedCategories.length ? allowedCategories : [set.category ?? "Uncategorised"],
  };

  const liveClient = await liveClientOrThrow(liveModePassphrase);
  const output = liveClient
    ? (await runCategoryAgent({ store, client: liveClient, model, input })).output
    : await peekCategoryCache(store, model, input);
  if (!output) return { ...state, pending: { step: "category", note: NOT_WARMED("category") } };
  const proposals = output.proposals.map((p) => ({ itemId: p.item_id, categoryId: p.category_id, confidence: p.confidence }));
  return { ...state, catalog: completeCategory(catalog, proposals), pending: undefined };
}

export async function catalogRunValidation(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  const issues = validateItems(catalog.items, catalog.sellerProfile);
  return { ...state, catalog: completeValidation(catalog, issues) };
}

export async function catalogResolveQueueItem(
  state: DemoState,
  itemId: string,
  resolution: FallbackResolution,
): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: resolveFallbackQueueItem(catalog, itemId, resolution) };
}

export async function catalogFinishQueue(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: finishFallbackQueue(catalog) };
}

export async function catalogEnterPackerForItem(
  state: DemoState,
  itemId: string,
  details: { manufacturerOrPackerName: string; manufacturerOrPackerAddress: string; fssaiLicenceNo: string },
): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: enterPackerDetailsAtG3(catalog, itemId, details) };
}

export async function catalogEnterPackerForBrand(
  state: DemoState,
  brand: string,
  details: { manufacturerOrPackerName: string; manufacturerOrPackerAddress: string; fssaiLicenceNo: string },
): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: enterPackerDetailsForBrandAtG3(catalog, brand, details) };
}

export async function catalogSignOffG3(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: signOffG3(catalog) };
}

export async function catalogRunBuild(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  // Throws MissingPackerDetailsError if a branded item reached here without G3 resolving it.
  const built = catalog.items.map((item) => buildOndcItem(item, catalog.sellerProfile));
  return { ...state, catalog: completeBuild(catalog, built) };
}

export async function catalogApproveG4Pilot(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: approveG4Pilot(catalog) };
}

export async function catalogApproveG4Full(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: approveG4Full(catalog) };
}

export async function catalogPublish(state: DemoState): Promise<DemoState> {
  assertCatalog(state);
  const catalog = state.catalog;
  return { ...state, catalog: completePublish(catalog) };
}

/* ---------------- scorecard hand-off ---------------- */

/** Persists a finished run so /scorecard can load it after navigation (PRD: run state by a URL-safe id). */
export async function persistRun(state: DemoState): Promise<string> {
  const runId = randomUUID();
  await runStore.set(runId, state);
  return runId;
}

export async function loadRun(runId: string): Promise<DemoState | null> {
  return runStore.get<DemoState>(runId);
}
