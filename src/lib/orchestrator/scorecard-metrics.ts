import { readFileSync } from "fs";
import { join } from "path";
import { validateItems } from "./validate";
import { buildItemsFromMappedColumns } from "./build-items";
import type { CatalogItem, ValidationIssue } from "./types";
import type { CatalogRunState } from "./catalog-run";
import type { BulkSellerRow } from "./bulk-seller-onboarding";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";

const DATA_SETS_DIR = join(process.cwd(), "data/sets");

/**
 * Computes scorecard metrics from a finished run's own state (real code,
 * not a stored or hardcoded result) — see README "Scorecard" / PRD FR-14.
 * Kept separate from the page component so these are independently
 * testable: feed in two different states, assert the numbers differ.
 */

/* ---------------- planted errors (set F, catalog-level) ---------------- */

export interface PlantedErrorEntry {
  sku: string;
  error: string;
  caught_at: string;
  gate: string;
}

/** Which validateItems() issue type(s) a planted-error label is expected to surface as. */
const PLANTED_ERROR_TO_ISSUE_TYPES: Record<string, ValidationIssue["type"][]> = {
  invalid_gtin_check_digit: ["gtin"],
  mrp_below_selling_price: ["mrp"],
  missing_fssai_for_third_party_packer: ["fssai", "packer_missing"],
  invented_claim_bait_organic: ["claim"],
  duplicate_sku: ["duplicate"],
};

export interface PlantedErrorResult {
  total: number;
  caughtSkus: string[];
  missed: PlantedErrorEntry[];
  /** Entries whose error label this module doesn't know how to check yet — never silently counted as caught. */
  unmapped: PlantedErrorEntry[];
}

function loadPlantedErrorsForSet(setId: string): PlantedErrorEntry[] | null {
  try {
    const raw = readFileSync(join(DATA_SETS_DIR, `set-${setId}`, "ground_truth/planted_errors.json"), "utf-8");
    return JSON.parse(raw) as PlantedErrorEntry[];
  } catch {
    return null;
  }
}

/**
 * Compares the issues validateItems() actually raised against the set's
 * own ground_truth/planted_errors.json, matched by item id and error
 * type. Returns null when the set has no planted-errors file (most sets
 * — only an eval set built with deliberate traps has one).
 */
export function auditPlantedErrorsCatalog(setId: string, items: readonly CatalogItem[], seller: SellerProfile): PlantedErrorResult | null {
  const plantedErrors = loadPlantedErrorsForSet(setId);
  if (!plantedErrors) return null;

  const issues = validateItems(items, seller);
  const caughtSkus: string[] = [];
  const missed: PlantedErrorEntry[] = [];
  const unmapped: PlantedErrorEntry[] = [];

  for (const planted of plantedErrors) {
    const issueTypes = PLANTED_ERROR_TO_ISSUE_TYPES[planted.error];
    if (!issueTypes) {
      unmapped.push(planted);
      continue;
    }
    const caught = issues.some((i) => i.itemId === planted.sku && issueTypes.includes(i.type));
    if (caught) caughtSkus.push(planted.sku);
    else missed.push(planted);
  }

  return { total: plantedErrors.length, caughtSkus, missed, unmapped };
}

/* ---------------- planted errors (set G, bulk Stage 1) ---------------- */

export interface PlantedSellerErrorEntry {
  row: number;
  error: string;
  gate: string;
}

/** Which S2 check name a planted seller-error label is expected to fail. */
const PLANTED_SELLER_ERROR_TO_CHECK: Record<string, string> = {
  invalid_gstin_checksum: "GSTIN format and checksum",
  expired_fssai_licence: "FSSAI licence in date",
};

export interface PlantedSellerErrorResult {
  total: number;
  caughtRows: number[];
  missed: PlantedSellerErrorEntry[];
  unmapped: PlantedSellerErrorEntry[];
}

function loadPlantedErrorsForBulkSet(setId: string): PlantedSellerErrorEntry[] | null {
  try {
    const raw = readFileSync(join(DATA_SETS_DIR, `set-${setId}`, "planted_errors.json"), "utf-8");
    return JSON.parse(raw) as PlantedSellerErrorEntry[];
  } catch {
    return null;
  }
}

/** Same comparison as auditPlantedErrorsCatalog, for the bulk Stage 1 flow (set G): matched by row index and a failing S2 check. */
export function auditPlantedErrorsBulk(setId: string, rows: readonly BulkSellerRow[]): PlantedSellerErrorResult | null {
  const plantedErrors = loadPlantedErrorsForBulkSet(setId);
  if (!plantedErrors) return null;

  const caughtRows: number[] = [];
  const missed: PlantedSellerErrorEntry[] = [];
  const unmapped: PlantedSellerErrorEntry[] = [];

  for (const planted of plantedErrors) {
    const checkName = PLANTED_SELLER_ERROR_TO_CHECK[planted.error];
    if (!checkName) {
      unmapped.push(planted);
      continue;
    }
    const row = rows.find((r) => r.rowIndex === planted.row);
    const caught = Boolean(row?.checks?.some((c) => c.name === checkName && !c.passed));
    if (caught) caughtRows.push(planted.row);
    else missed.push(planted);
  }

  return { total: plantedErrors.length, caughtRows, missed, unmapped };
}

/* ---------------- invented statutory values ---------------- */

type StatutoryField =
  | "mrp"
  | "netQty"
  | "fssaiLicenceNo"
  | "manufacturerOrPackerName"
  | "manufacturerOrPackerAddress"
  | "packedMonth"
  | "vegNonVeg";

const STATUTORY_FIELDS: readonly StatutoryField[] = [
  "mrp",
  "netQty",
  "fssaiLicenceNo",
  "manufacturerOrPackerName",
  "manufacturerOrPackerAddress",
  "packedMonth",
  "vegNonVeg",
];

export interface InventedValueFinding {
  itemId: string;
  field: StatutoryField;
  value: string | number;
}

export interface InventedValuesResult {
  /** Items x fields actually carrying a value, across all 7 statutory fields. */
  checked: number;
  findings: InventedValueFinding[];
  /** Fields this module couldn't verify a source for (not "0 invented" — distinct from a real finding). */
  notMeasured: boolean;
}

function fieldsMatch(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return a === b;
}

function matchesSellerProfile(field: StatutoryField, value: string | number, seller: SellerProfile): boolean {
  switch (field) {
    case "fssaiLicenceNo":
      return value === seller.fssai;
    case "manufacturerOrPackerName":
      return value === seller.business_name;
    case "manufacturerOrPackerAddress":
      return value === seller.packer_address;
    default:
      return false;
  }
}

const PACKER_FIELDS: readonly StatutoryField[] = ["manufacturerOrPackerName", "manufacturerOrPackerAddress", "fssaiLicenceNo"];
// Never produced by the extraction agent's output schema (only mrp/net_qty/price are),
// so on an unstructured source these can only ever be pre-filled or G3-entered — never
// source-mapped — unlike the catalog-wide SOURCE_DERIVED fields below.
const SOURCE_DERIVED_FIELDS: readonly StatutoryField[] = ["mrp", "netQty", "packedMonth", "vegNonVeg"];

/**
 * Re-verifies every statutory value in the final catalog against the only
 * three legitimate sources (PRD no-invention guardrail): the raw source
 * file, the seller's approved profile, or a value the seller entered at a
 * gate (G3 packer-details entry; its audit entries are the only record of
 * that, so it's the third check). Re-derives from state rather than
 * trusting any write-time instrumentation, so it stays correct even if a
 * future code path forgets to tag itself.
 *
 * Packer/address/FSSAI are checked the same way regardless of source
 * format (never source-mapped on an unstructured source either). MRP,
 * net quantity, packing date and veg mark need the raw rows to re-derive
 * from (structured sources only); on an unstructured source a value in
 * mrp/netQty instead comes from the extraction agent and is checked
 * separately via its sourceExcerpt (see auditExtractionProvenance) — a
 * value found here with no raw rows to check against is reported as
 * notMeasured, never silently asserted clean.
 */
export function auditInventedStatutoryValues(catalog: CatalogRunState): InventedValuesResult {
  const rebuilt = catalog.rawRows
    ? (() => {
        const columnTargets: Record<string, MappingTargetKey | null> = {};
        for (const [column, decision] of Object.entries(catalog.columnMappings)) {
          columnTargets[column] = decision.final as MappingTargetKey | null;
        }
        return buildItemsFromMappedColumns(catalog.rawRows!, columnTargets);
      })()
    : null;

  const g3EnteredText = catalog.auditLog
    .filter((e) => e.kind === "human" && e.text.startsWith("G3: seller entered packer details"))
    .map((e) => e.text)
    .join(" | ");

  let checked = 0;
  let notMeasured = false;
  const findings: InventedValueFinding[] = [];

  catalog.items.forEach((item, index) => {
    const fresh = rebuilt?.[index];
    for (const field of STATUTORY_FIELDS) {
      const value = item[field] as string | number | undefined;
      if (value == null) continue;

      if (SOURCE_DERIVED_FIELDS.includes(field) && !rebuilt) {
        // Only mrp/netQty can legitimately appear here without raw rows
        // (extraction agent output); those are checked by
        // auditExtractionProvenance instead, so skip rather than double-count.
        if (field === "mrp" || field === "netQty") continue;
        checked++;
        notMeasured = true;
        continue;
      }

      checked++;
      if (fresh && fieldsMatch(fresh[field], value)) continue; // traced to the raw source row
      if (PACKER_FIELDS.includes(field) && matchesSellerProfile(field, value, catalog.sellerProfile)) continue; // traced to the approved profile
      // Traced to a seller G3 entry: those overwrite packer name, address
      // and FSSAI together, and every such action is audited by item id.
      if (
        PACKER_FIELDS.includes(field) &&
        (g3EnteredText.includes(item.id) || (item.brand && g3EnteredText.includes(`"${item.brand}"`)))
      ) {
        continue;
      }

      findings.push({ itemId: item.id, field, value });
    }
  });

  return { checked, findings, notMeasured };
}

/**
 * Unstructured sources (D, E): a statutory value here (mrp/netQty) only
 * ever comes from the extraction agent, so its provenance is the
 * sourceExcerpt carried on the item — required non-empty by the output
 * schema. A value with no excerpt behind it would be the invention this
 * function exists to catch; none should ever occur given the schema, but
 * this re-checks rather than assumes it.
 */
export function auditExtractionProvenance(items: readonly CatalogItem[]): InventedValuesResult {
  let checked = 0;
  const findings: InventedValueFinding[] = [];
  for (const item of items) {
    for (const field of ["mrp", "netQty"] as const) {
      const value = item[field] as string | number | undefined;
      if (value == null) continue;
      checked++;
      if (!item.sourceExcerpt || item.sourceExcerpt.trim() === "") {
        findings.push({ itemId: item.id, field, value });
      }
    }
  }
  return { checked, findings, notMeasured: false };
}
