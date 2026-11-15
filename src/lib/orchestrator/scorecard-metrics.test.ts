import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  auditPlantedErrorsCatalog,
  auditPlantedErrorsBulk,
  auditInventedStatutoryValues,
  auditExtractionProvenance,
} from "./scorecard-metrics";
import { buildItemsFromMappedColumns } from "./build-items";
import { preFillFromSellerProfile, validateItems } from "./validate";
import { parseCsvRecords } from "@/lib/parse/csv";
import { registrationFormSchema, type SellerProfile } from "@/lib/schemas/seller-profile";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import type { CatalogItem } from "./types";
import type { CatalogRunState } from "./catalog-run";
import type { BulkSellerRow } from "./bulk-seller-onboarding";

function loadSellerProfile(set: string): SellerProfile {
  const raw = readFileSync(join(process.cwd(), "data/sets", `set-${set}`, "seller_pack/registration_form.json"), "utf-8");
  return registrationFormSchema.parse(JSON.parse(raw)) as SellerProfile;
}

function buildSetFItems(): { items: CatalogItem[]; seller: SellerProfile; rawRows: Record<string, string>[]; columnTargets: Record<string, MappingTargetKey | null> } {
  const seller = loadSellerProfile("F");
  const raw = readFileSync(join(process.cwd(), "data/sets/set-F/catalog.csv"), "utf-8");
  const rawRows = parseCsvRecords(raw);
  const fieldMap = JSON.parse(
    readFileSync(join(process.cwd(), "data/sets/set-F/ground_truth/field_mapping.json"), "utf-8"),
  ) as Record<string, MappingTargetKey>;
  const items = buildItemsFromMappedColumns(rawRows, fieldMap).items.map((i) => preFillFromSellerProfile(i, seller));
  return { items, seller, rawRows, columnTargets: fieldMap };
}

function fakeCatalogState(overrides: Partial<CatalogRunState>): CatalogRunState {
  const { items, seller, rawRows, columnTargets } = buildSetFItems();
  const columnMappings = Object.fromEntries(
    Object.entries(columnTargets).map(([col, target]) => [
      col,
      { column: col, candidates: [], proposed: target, confidence: 1, reason: "", risk: "low" as const, route: "auto" as const, final: target, edited: false, resolved: true },
    ]),
  );
  return {
    runId: "test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    step: "g3",
    skippedSteps: [],
    sellerProfile: seller,
    sourceFormat: "csv",
    rawRows,
    items,
    columnMappings,
    issues: [],
    validationIssues: [],
    pilotApproved: false,
    published: false,
    gates: [],
    auditLog: [],
    ...overrides,
  };
}

describe("auditPlantedErrorsCatalog (set F)", () => {
  it("catches all 13 planted errors against the real, fixed set F pipeline", () => {
    const { items, seller } = buildSetFItems();
    const issues = validateItems(items, seller);
    const result = auditPlantedErrorsCatalog("F", issues);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(13);
    expect(result!.caughtSkus).toHaveLength(13);
    expect(result!.missed).toEqual([]);
    expect(result!.unmapped).toEqual([]);
  });

  it("reports a miss (not a silent pass) when a planted error stops being caught", () => {
    // Simulates the real bug this project had: a third-party packer's
    // FSSAI silently defaulted to the seller instead of being flagged.
    const { items, seller } = buildSetFItems();
    const broken = items.map((i) =>
      i.id === "TRP-008" ? { ...i, fssaiLicenceNo: seller.fssai, manufacturerOrPackerAddress: seller.packer_address } : i,
    );
    const issues = validateItems(broken, seller);
    const result = auditPlantedErrorsCatalog("F", issues);
    expect(result!.caughtSkus).toHaveLength(12);
    expect(result!.missed).toEqual([
      { sku: "TRP-008", error: "missing_fssai_for_third_party_packer", caught_at: "validation", gate: "G3" },
    ]);
  });

  it("still reports an issue as caught once the item it lived on has been resolved or removed", () => {
    // The whole point of taking a validation-time snapshot: the scorecard
    // must keep reporting a caught error even after the fallback queue or
    // G3 has resolved (and possibly removed) the item it was raised on.
    const { items, seller } = buildSetFItems();
    const issues = validateItems(items, seller);
    const resolved = issues.filter((i) => i.itemId !== "TRP-003"); // as if the queue had cleared TRP-003's GTIN issue
    const result = auditPlantedErrorsCatalog("F", issues);
    const resultFromResolved = auditPlantedErrorsCatalog("F", resolved);
    expect(result!.caughtSkus).toContain("TRP-003");
    expect(resultFromResolved!.caughtSkus).not.toContain("TRP-003"); // proves this reads the issues passed in, not a live re-validation
  });

  it("returns null for a set with no planted_errors.json", () => {
    const { items, seller } = buildSetFItems();
    const issues = validateItems(items, seller);
    expect(auditPlantedErrorsCatalog("A", issues)).toBeNull();
  });
});

describe("auditPlantedErrorsBulk (set G)", () => {
  const plantedPassing = (overrides: Record<number, boolean>) => {
    const rows: BulkSellerRow[] = Array.from({ length: 12 }, (_, i) => {
      const rowIndex = i + 1;
      const gstinFails = rowIndex === 5;
      const fssaiFails = rowIndex === 9;
      return {
        rowIndex,
        profile: {} as SellerProfile,
        checks: [
          { name: "GSTIN format and checksum", passed: overrides[rowIndex] ?? !gstinFails, value: "x" },
          { name: "FSSAI licence in date", passed: overrides[rowIndex] ?? !fssaiFails, value: "x" },
        ],
      };
    });
    return rows;
  };

  it("catches both of set G's planted seller errors (rows 5 and 9)", () => {
    const result = auditPlantedErrorsBulk("G", plantedPassing({}));
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.caughtRows.sort()).toEqual([5, 9]);
    expect(result!.missed).toEqual([]);
  });

  it("reports a miss when a planted row's check doesn't actually fail", () => {
    const rows = plantedPassing({ 5: true }); // row 5's GSTIN check wrongly passes
    const result = auditPlantedErrorsBulk("G", rows);
    expect(result!.caughtRows).toEqual([9]);
    expect(result!.missed).toEqual([{ row: 5, error: "invalid_gstin_checksum", gate: "G0" }]);
  });
});

describe("auditInventedStatutoryValues", () => {
  it("finds zero invented values on the real, fixed set F catalog", () => {
    const state = fakeCatalogState({});
    const result = auditInventedStatutoryValues(state);
    expect(result.notMeasured).toBe(false);
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it("flags a statutory value with no traceable source (simulated invention)", () => {
    const state = fakeCatalogState({});
    const tampered = state.items.map((i) =>
      i.id === "TRP-001" ? { ...i, fssaiLicenceNo: "99999999999999" } : i,
    );
    const result = auditInventedStatutoryValues({ ...state, items: tampered });
    expect(result.findings).toContainEqual({ itemId: "TRP-001", field: "fssaiLicenceNo", value: "99999999999999" });
  });

  it("does not flag a value the seller entered at G3 (audited by item id)", () => {
    const state = fakeCatalogState({});
    const items = state.items.map((i) =>
      i.id === "TRP-008"
        ? { ...i, manufacturerOrPackerName: "Real Packer Ltd", manufacturerOrPackerAddress: "123 Pack St", fssaiLicenceNo: "11111111111111" }
        : i,
    );
    const auditLog = [
      { at: new Date().toISOString(), kind: "human" as const, text: "G3: seller entered packer details for TRP-008 from the pack label" },
    ];
    const result = auditInventedStatutoryValues({ ...state, items, auditLog });
    expect(result.findings.filter((f) => f.itemId === "TRP-008")).toEqual([]);
  });

  it("still matches by id, not position, once an earlier item has been dropped (fallback queue/G3 removals)", () => {
    // Set F's own duplicate-drop and mrp "remove item" paths both remove an
    // item from catalog.items without removing its row from rawRows, so a
    // positional match against rebuilt rows would silently compare every
    // later item against the wrong raw row.
    const state = fakeCatalogState({});
    const items = state.items.filter((i) => i.id !== state.items[0].id);
    const result = auditInventedStatutoryValues({ ...state, items });
    expect(result.findings).toEqual([]);
  });

  it("does not flag an mrp value the seller corrected at G3 (audited by item id)", () => {
    const state = fakeCatalogState({});
    const items = state.items.map((i) => (i.id === "TRP-005" ? { ...i, mrp: 500 } : i));
    const auditLog = [
      { at: new Date().toISOString(), kind: "human" as const, text: "G3: seller resolved MRP/price issue for TRP-005 (MRP corrected to 500)" },
    ];
    const result = auditInventedStatutoryValues({ ...state, items, auditLog });
    expect(result.findings.filter((f) => f.itemId === "TRP-005")).toEqual([]);
  });

  it("reports notMeasured, not a false 0, when there is no raw source to re-check against (unstructured sources)", () => {
    // A realistic D/E-style state: extraction output, never column-mapped,
    // so there is no rawRows to rebuild against. Packer fields still trace
    // to the approved profile (never source-mapped on any format), but
    // packedMonth has no raw source and no gate entry to trace to.
    const { seller } = buildSetFItems();
    const state: CatalogRunState = {
      runId: "test-unstructured",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      step: "g3",
      skippedSteps: [],
      sellerProfile: seller,
      sourceFormat: "whatsapp_text",
      rawRows: undefined,
      items: [
        {
          id: "item-1",
          name: "Rosogolla",
          manufacturerOrPackerName: seller.business_name,
          packedMonth: "2026-01",
        },
      ],
      columnMappings: {},
      issues: [],
      validationIssues: [],
      pilotApproved: false,
      published: false,
      gates: [],
      auditLog: [],
    };
    const result = auditInventedStatutoryValues(state);
    expect(result.notMeasured).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

describe("auditExtractionProvenance", () => {
  it("passes an item with a source excerpt behind its MRP and net quantity", () => {
    const items: CatalogItem[] = [
      { id: "item-1", name: "Rosogolla", mrp: 360, netQty: "1 kg", sourceExcerpt: "1. Rosogolla (1 kg) .......... Rs 360" },
    ];
    const result = auditExtractionProvenance(items);
    expect(result.findings).toEqual([]);
    expect(result.checked).toBe(2);
  });

  it("flags an MRP with no excerpt behind it", () => {
    const items: CatalogItem[] = [{ id: "item-1", name: "Rosogolla", mrp: 360 }];
    const result = auditExtractionProvenance(items);
    expect(result.findings).toEqual([{ itemId: "item-1", field: "mrp", value: 360 }]);
  });
});
