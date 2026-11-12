import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { MappingProposal } from "@/lib/schemas/field-mapping";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import { route } from "@/lib/routing";
import { appendAudit, type AuditLogEntry } from "./audit";
import { OrchestratorStateError } from "./errors";
import { buildItemsFromMappedColumns } from "./build-items";
import { preFillFromSellerProfile } from "./validate";
import type { CatalogItem, GateRecord, MappingDecisionRecord, SourceFormat, ValidationIssue } from "./types";

/**
 * Stage 2: onboards one catalog for an already-approved seller. The step
 * order is the PRD's, with one deliberate change: for a structured source
 * (CSV/Excel), category classification runs after mapping/G2, not before
 * it, since an item's name only exists once its name column is mapped.
 * For an unstructured source (WhatsApp text, a photo), extraction already
 * yields each item's name directly, mapping and G2 do not apply (there
 * are no spreadsheet columns to map), and category runs right after G1,
 * matching the PRD's literal order for that case.
 */
export const CATALOG_RUN_STEPS = [
  "intake",
  "extract",
  "g1",
  "mapping",
  "g2",
  "category",
  "validate",
  "queue",
  "g3",
  "build",
  "g4",
  "publish",
  "done",
] as const;
export type CatalogRunStep = (typeof CATALOG_RUN_STEPS)[number];

const STRUCTURED_FORMATS: readonly SourceFormat[] = ["csv", "excel"];

export interface CatalogRunState {
  runId: string;
  createdAt: string;
  updatedAt: string;
  step: CatalogRunStep;
  skippedSteps: CatalogRunStep[];
  sellerProfile: SellerProfile;
  sourceFormat: SourceFormat;
  rawRows?: Record<string, string>[]; // structured sources only, until mapping is applied
  items: CatalogItem[];
  columnMappings: Record<string, MappingDecisionRecord>;
  issues: ValidationIssue[];
  pilotApproved: boolean;
  catalogItems?: unknown[]; // OndcItem[], kept loosely typed here to avoid a cross-layer import cycle
  published: boolean;
  gates: GateRecord[];
  auditLog: AuditLogEntry[];
}

function isStructured(format: SourceFormat): boolean {
  return STRUCTURED_FORMATS.includes(format);
}

export function createCatalogRun(
  runId: string,
  sellerProfile: SellerProfile,
  sourceFormat: SourceFormat,
): CatalogRunState {
  const now = new Date().toISOString();
  return {
    runId,
    createdAt: now,
    updatedAt: now,
    step: "intake",
    skippedSteps: [],
    sellerProfile,
    sourceFormat,
    items: [],
    columnMappings: {},
    issues: [],
    pilotApproved: false,
    published: false,
    gates: [],
    auditLog: [],
  };
}

function assertStep(state: CatalogRunState, expected: CatalogRunStep) {
  if (state.step !== expected) {
    throw new OrchestratorStateError(
      `Expected catalog run ${state.runId} to be at "${expected}", but it is at "${state.step}".`,
    );
  }
}

/** Advances past the current step to the next one not in skippedSteps. */
function advance(state: CatalogRunState): CatalogRunState {
  let index = CATALOG_RUN_STEPS.indexOf(state.step) + 1;
  while (
    index < CATALOG_RUN_STEPS.length - 1 &&
    state.skippedSteps.includes(CATALOG_RUN_STEPS[index])
  ) {
    index++;
  }
  return { ...state, step: CATALOG_RUN_STEPS[index], updatedAt: new Date().toISOString() };
}

function skip(state: CatalogRunState, step: CatalogRunStep): CatalogRunState {
  return state.skippedSteps.includes(step)
    ? state
    : { ...state, skippedSteps: [...state.skippedSteps, step] };
}

/** 1. Source intake: detects and confirms the format. Deterministic, no model call. */
export function completeSourceIntake(state: CatalogRunState, note: string): CatalogRunState {
  assertStep(state, "intake");
  if (!isStructured(state.sourceFormat)) {
    state = skip(state, "mapping");
    state = skip(state, "g2");
  }
  const next = advance(appendAudit(state, "agent", `Source intake: ${note}`));
  return next;
}

export interface ExtractionResult {
  items?: CatalogItem[]; // unstructured sources: items with name already resolved
  rawRows?: Record<string, string>[]; // structured sources: parsed rows, mapping not yet applied
  hadParseErrors?: boolean; // structured sources only
}

/** 2. Extraction. Decides whether G1 is needed (PRD: always for photo/text; for CSV/Excel only on a parse error). */
export function completeExtraction(state: CatalogRunState, result: ExtractionResult): CatalogRunState {
  assertStep(state, "extract");
  const structured = isStructured(state.sourceFormat);
  const needsG1 = structured ? Boolean(result.hadParseErrors) : true;

  let next: CatalogRunState = {
    ...state,
    items: result.items ?? state.items,
    rawRows: result.rawRows ?? state.rawRows,
  };
  next = appendAudit(
    next,
    "agent",
    structured
      ? `Extraction: ${result.rawRows?.length ?? 0} rows read${needsG1 ? ", parser hit errors" : ""}`
      : `Extraction: ${result.items?.length ?? 0} items read`,
  );
  if (!needsG1) {
    next = skip(next, "g1");
    next = appendAudit(next, "sys", "G1 skipped: structured source parsed with no errors");
  }
  return advance(next);
}

/** G1: the seller confirms the item list as read (PRD: always for photo/text, conditionally for CSV/Excel). */
export function confirmG1(
  state: CatalogRunState,
  edits: Readonly<Record<string, Partial<CatalogItem>>> = {},
): CatalogRunState {
  assertStep(state, "g1");
  let editCount = 0;
  const items = state.items.map((item) => {
    const edit = edits[item.id];
    const edited = edit ? { ...item, ...edit } : item;
    if (edit) editCount++;
    // Unstructured sources skip mapping/G2, so pre-fill (FR-15) happens here instead.
    return preFillFromSellerProfile(edited, state.sellerProfile);
  });
  const next = appendAudit(
    { ...state, items },
    "human",
    `G1: seller confirmed ${items.length} items${editCount ? `, edited ${editCount} values` : ""}`,
  );
  next.gates = [...next.gates, { gate: "G1", outcome: `${items.length} items confirmed`, at: new Date().toISOString() }];
  return advance(next);
}

/** 4. Smart mapping: the orchestrator receives every column's proposal (the agent itself runs per column, M3). */
export function completeMapping(
  state: CatalogRunState,
  proposals: readonly MappingProposal[],
): CatalogRunState {
  assertStep(state, "mapping");
  const columnMappings: Record<string, MappingDecisionRecord> = {};
  let auto = 0;
  let review = 0;
  let fallback = 0;
  for (const proposal of proposals) {
    const decidedRoute = route(proposal);
    const isAuto = decidedRoute === "auto";
    if (isAuto) auto++;
    else if (decidedRoute === "review") review++;
    else fallback++;
    columnMappings[proposal.column] = {
      ...proposal,
      route: decidedRoute,
      final: proposal.proposed,
      edited: false,
      resolved: isAuto,
    };
  }
  const next = appendAudit(
    { ...state, columnMappings },
    "agent",
    `Mapping: ${proposals.length} columns · ${auto} auto-accepted · ${review} to G2 · ${fallback} to fallback queue`,
  );
  return advance(next);
}

/** G2: approves or edits every mapping that needs review, and resolves the fallback queue (PRD: both happen here). */
export function approveG2(
  state: CatalogRunState,
  resolutions: Readonly<Record<string, MappingTargetKey | null>> = {},
): CatalogRunState {
  assertStep(state, "g2");
  const columnMappings: Record<string, MappingDecisionRecord> = {};
  let editCount = 0;

  for (const [column, decision] of Object.entries(state.columnMappings)) {
    if (decision.route === "auto") {
      columnMappings[column] = decision;
      continue;
    }
    const hasResolution = Object.prototype.hasOwnProperty.call(resolutions, column);
    const final = hasResolution ? resolutions[column] : decision.resolved ? decision.final : undefined;
    if (final === undefined) {
      throw new OrchestratorStateError(`Column "${column}" has no decision at G2 for run ${state.runId}.`);
    }
    const edited = final !== decision.proposed;
    if (edited) editCount++;
    columnMappings[column] = { ...decision, final, edited, resolved: true };
  }

  const columnTargets: Record<string, MappingTargetKey | null> = {};
  for (const [column, decision] of Object.entries(columnMappings)) {
    columnTargets[column] = decision.final as MappingTargetKey | null;
  }
  const builtItems = state.rawRows ? buildItemsFromMappedColumns(state.rawRows, columnTargets) : state.items;
  // FR-15: pre-fill statutory fields from the approved seller profile before category/validation see the items.
  const items = builtItems.map((item) => preFillFromSellerProfile(item, state.sellerProfile));

  const next = appendAudit(
    { ...state, columnMappings, items },
    "human",
    `G2: approved ${Object.values(columnMappings).filter((m) => m.route !== "auto").length} reviewed mappings${editCount ? `, ${editCount} edits` : ""}`,
  );
  next.gates = [...next.gates, { gate: "G2", outcome: `${editCount} mapping edits`, at: new Date().toISOString() }];
  return advance(next);
}

/** 3. Category agent's output is applied once items have real names (see module doc). */
export function completeCategory(
  state: CatalogRunState,
  proposals: readonly { itemId: string; categoryId: string; confidence: number }[],
): CatalogRunState {
  assertStep(state, "category");
  const byId = new Map(proposals.map((p) => [p.itemId, p]));
  const items = state.items.map((item) => {
    const proposal = byId.get(item.id);
    return proposal ? { ...item, category: proposal.categoryId, categoryConfidence: proposal.confidence } : item;
  });
  const next = appendAudit({ ...state, items }, "agent", `Category: ${items.length} items classified`);
  return advance(next);
}

/** 5. Validation: deterministic checks (lib/checks/), run as real code. */
export function completeValidation(state: CatalogRunState, issues: readonly ValidationIssue[]): CatalogRunState {
  assertStep(state, "validate");
  const queueIssues = issues.filter((i) => i.severity === "queue");
  const g3Issues = issues.filter((i) => i.severity === "g3");
  let next: CatalogRunState = { ...state, issues: [...issues] };
  for (const issue of issues) {
    next = appendAudit(next, "check", issue.message);
  }
  if (!queueIssues.length) {
    next = skip(next, "queue");
    next = appendAudit(next, "sys", "Fallback queue skipped: nothing for the fallback queue");
  }
  if (g3Issues.length) {
    next = appendAudit(next, "check", `${g3Issues.length} statutory issue(s) for the seller at G3`);
  }
  return advance(next);
}

/** Fallback queue: resolves a validation issue of severity "queue" (duplicate, bad GTIN, unsupported claim). */
export type FallbackResolution =
  | "drop"
  | "clear_gtin"
  | "remove_claim"
  | { kind: "set_net_qty"; value: string }
  | { kind: "set_packed_month"; value: string };

export function resolveFallbackQueueItem(
  state: CatalogRunState,
  itemId: string,
  resolution: FallbackResolution,
): CatalogRunState {
  assertStep(state, "queue");
  let items = state.items;
  if (resolution === "drop") {
    items = items.filter((i) => i.id !== itemId);
  } else if (resolution === "clear_gtin") {
    items = items.map((i) => (i.id === itemId ? { ...i, gtin: undefined } : i));
  } else if (resolution === "remove_claim") {
    items = items.map((i) => (i.id === itemId ? { ...i, description: undefined } : i));
  } else if (typeof resolution === "object" && resolution.kind === "set_net_qty") {
    items = items.map((i) => (i.id === itemId ? { ...i, netQty: resolution.value } : i));
  } else if (typeof resolution === "object" && resolution.kind === "set_packed_month") {
    items = items.map((i) => (i.id === itemId ? { ...i, packedMonth: resolution.value } : i));
  }
  const issues = state.issues.filter((i) => !(i.itemId === itemId && i.severity === "queue"));
  const label = typeof resolution === "string" ? resolution : resolution.kind;
  return appendAudit({ ...state, items, issues }, "human", `Fallback queue: ${itemId} resolved (${label})`);
}

/** Finishes the fallback queue step once every queued issue is resolved. */
export function finishFallbackQueue(state: CatalogRunState): CatalogRunState {
  assertStep(state, "queue");
  const remaining = state.issues.filter((i) => i.severity === "queue");
  if (remaining.length) {
    throw new OrchestratorStateError(
      `${remaining.length} fallback queue item(s) still unresolved for run ${state.runId}.`,
    );
  }
  const next = appendAudit(state, "human", "Fallback queue: all items resolved");
  next.gates = [...next.gates, { gate: "FQ", outcome: `${state.items.length} items resolved`, at: new Date().toISOString() }];
  return advance(next);
}

export interface PackerLabelDetails {
  manufacturerOrPackerName: string;
  manufacturerOrPackerAddress: string;
  fssaiLicenceNo: string;
}

/**
 * G3: the seller enters a branded item's packer name, address and FSSAI
 * licence from the pack label, resolving the packer_missing/fssai issues
 * validate() raised for it. Never invented by an agent — only this
 * function, driven by the seller's own input, can set these for a
 * branded item (see preFillFromSellerProfile in validate.ts).
 */
function applyPackerDetails(item: CatalogItem, details: PackerLabelDetails): CatalogItem {
  return {
    ...item,
    manufacturerOrPackerName: details.manufacturerOrPackerName,
    manufacturerOrPackerAddress: details.manufacturerOrPackerAddress,
    fssaiLicenceNo: details.fssaiLicenceNo,
  };
}

function isPackerIssue(issue: ValidationIssue): boolean {
  return issue.type === "packer_missing" || issue.type === "fssai";
}

/** For an exception — one item that does not follow its brand's usual label (a one-off correction, a mislabelled unit). */
export function enterPackerDetailsAtG3(
  state: CatalogRunState,
  itemId: string,
  details: PackerLabelDetails,
): CatalogRunState {
  assertStep(state, "g3");
  const items = state.items.map((item) => (item.id === itemId ? applyPackerDetails(item, details) : item));
  const issues = state.issues.filter((i) => !(i.itemId === itemId && isPackerIssue(i)));
  return appendAudit(
    { ...state, items, issues },
    "human",
    `G3: seller entered packer details for ${itemId} from the pack label`,
  );
}

/**
 * The common case: one pack label covers every item of that brand. Applies
 * the same packer name, address and FSSAI licence to every item of
 * `brand` that still has a packer_missing or fssai issue, in one pass,
 * and writes a single audit entry for the whole brand rather than one per
 * item.
 */
export function enterPackerDetailsForBrandAtG3(
  state: CatalogRunState,
  brand: string,
  details: PackerLabelDetails,
): CatalogRunState {
  assertStep(state, "g3");
  const flaggedIds = new Set(state.issues.filter(isPackerIssue).map((i) => i.itemId));
  const affectedIds = new Set(
    state.items.filter((item) => item.brand === brand && flaggedIds.has(item.id)).map((item) => item.id),
  );
  if (affectedIds.size === 0) {
    throw new OrchestratorStateError(
      `No packer_missing or fssai issue for brand "${brand}" in run ${state.runId}.`,
    );
  }
  const items = state.items.map((item) => (affectedIds.has(item.id) ? applyPackerDetails(item, details) : item));
  const issues = state.issues.filter((i) => !(affectedIds.has(i.itemId) && isPackerIssue(i)));
  return appendAudit(
    { ...state, items, issues },
    "human",
    `G3: seller entered packer details for ${affectedIds.size} "${brand}" item(s) from the pack label`,
  );
}

/** G3: the seller signs off every statutory field (PRD: always required). */
export function signOffG3(state: CatalogRunState): CatalogRunState {
  assertStep(state, "g3");
  const remaining = state.issues.filter((i) => i.severity === "g3");
  if (remaining.length) {
    throw new OrchestratorStateError(
      `${remaining.length} statutory issue(s) still open for run ${state.runId}; resolve them before G3 sign-off.`,
    );
  }
  const next = appendAudit(state, "human", "G3: seller signed off all statutory fields");
  next.gates = [...next.gates, { gate: "G3", outcome: "Statutory fields signed off", at: new Date().toISOString() }];
  return advance(next);
}

/** 6. Catalog builder: the orchestrator receives the finished ONDC items (built by lib/orchestrator/build-catalog.ts). */
export function completeBuild(state: CatalogRunState, catalogItems: readonly unknown[]): CatalogRunState {
  assertStep(state, "build");
  const next = appendAudit(
    { ...state, catalogItems: [...catalogItems] },
    "agent",
    `Catalog builder: ${catalogItems.length} items, pilot phase of ${Math.min(10, catalogItems.length)}`,
  );
  return advance(next);
}

/** G4, phase 1: the reviewer publishes the pilot phase. */
export function approveG4Pilot(state: CatalogRunState): CatalogRunState {
  assertStep(state, "g4");
  if (state.pilotApproved) {
    throw new OrchestratorStateError(`Run ${state.runId}'s pilot phase is already approved.`);
  }
  return appendAudit({ ...state, pilotApproved: true }, "human", "G4: reviewer approved the pilot phase");
}

/** G4, phase 2: the seller approves the full catalog, only after the pilot phase passed. */
export function approveG4Full(state: CatalogRunState): CatalogRunState {
  assertStep(state, "g4");
  if (!state.pilotApproved) {
    throw new OrchestratorStateError(
      `Run ${state.runId} cannot approve the full catalog before the pilot phase is approved.`,
    );
  }
  const next = appendAudit(
    state,
    "human",
    `G4: seller approved the full catalog of ${state.catalogItems?.length ?? 0} items`,
  );
  next.gates = [...next.gates, { gate: "G4", outcome: "Pilot accepted, full catalog approved", at: new Date().toISOString() }];
  return advance(next);
}

/** 7. Publish: the remaining items go to the mock seller app. */
export function completePublish(state: CatalogRunState): CatalogRunState {
  assertStep(state, "publish");
  const remaining = (state.catalogItems?.length ?? 0) - 10;
  const next = appendAudit(
    { ...state, published: true },
    "agent",
    `Published ${Math.max(remaining, 0)} remaining items; monitoring started`,
  );
  return advance(next);
}
