import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import { targetRisk } from "@/lib/schemas/mapping-target";
import { parseCsvRecords } from "@/lib/parse/csv";
import { profileColumns } from "@/lib/parse/profile-columns";
import { OrchestratorStateError } from "./errors";
import {
  approveG2,
  approveG4Full,
  approveG4Pilot,
  completeBuild,
  completeCategory,
  completeExtraction,
  completeMapping,
  completePublish,
  completeSourceIntake,
  completeValidation,
  confirmG1,
  createCatalogRun,
  enterPackerDetailsAtG3,
  enterPackerDetailsForBrandAtG3,
  finishFallbackQueue,
  resolveFallbackQueueItem,
  signOffG3,
} from "./catalog-run";
import { validateItems } from "./validate";
import { buildOndcItem } from "./build-catalog";

const grocerySeller: SellerProfile = {
  seller_id: "SLR-B",
  business_name: "Rambhau Kirana Stores",
  owner: "Ramesh Bhosale",
  city: "Pune",
  state: "Maharashtra",
  category: "Grocery",
  gstin: "27ZZZPB0002B1Z9",
  pan: "ZZZPB0002B",
  fssai: "20000000000002",
  fssai_expiry: "2027-09-30",
  ifsc: "DEMO0000002",
  account: "000000000202",
  packer_address: "Shop 12, Demo Market Road, Pune 411000",
  returns: "Returnable within 2 days if damaged",
  time_to_ship: "PT4H",
  own_brands: [],
};

describe("catalog run: structured source (set B style)", () => {
  it("runs the whole flow from intake to publish", () => {
    let state = createCatalogRun("run-b", grocerySeller, "csv");
    expect(state.step).toBe("intake");

    state = completeSourceIntake(state, "Excel workbook, header found on row 3");
    expect(state.step).toBe("extract");

    const rawRows = [
      {
        "Item Naam": "Toor Dal",
        Brand: "", // loose item, no brand column value: pre-fills from the seller
        "M.R.P (Rs)": "165",
        Rate: "160",
        Wajan: "1 kg",
        Barcode: "2000002000013",
        "Stock (pcs)": "9",
        "Veg/NonVeg": "Veg",
        "Mfg Dt": "09/2026",
      },
    ];
    state = completeExtraction(state, { rawRows, hadParseErrors: false });
    // G1 skipped (clean parse), mapping skipped is false (structured): next step is mapping.
    expect(state.skippedSteps).toContain("g1");
    expect(state.step).toBe("mapping");

    state = completeMapping(state, [
      { column: "Item Naam", candidates: [], proposed: "descriptor.name", confidence: 0.95, risk: "low", reason: "x" },
      { column: "Brand", candidates: [], proposed: "brand", confidence: 0.95, risk: "low", reason: "x" },
      { column: "M.R.P (Rs)", candidates: [], proposed: "price.maximum_value", confidence: 0.92, risk: "high", reason: "x" },
      { column: "Rate", candidates: [], proposed: "price.value", confidence: 0.92, risk: "high", reason: "x" },
      { column: "Wajan", candidates: [], proposed: "net_quantity", confidence: 0.9, risk: "high", reason: "x" },
      { column: "Barcode", candidates: [], proposed: "descriptor.code", confidence: 0.85, risk: "medium", reason: "x" },
      { column: "Stock (pcs)", candidates: [], proposed: "quantity.available.count", confidence: 0.95, risk: "low", reason: "x" },
      { column: "Veg/NonVeg", candidates: [], proposed: "veg_non_veg", confidence: 0.9, risk: "high", reason: "x" },
      { column: "Mfg Dt", candidates: [], proposed: "month_year_of_manufacture_packing_import", confidence: 0.9, risk: "high", reason: "x" },
    ]);
    expect(state.step).toBe("g2");
    // Low-risk, high-confidence columns auto-accept; high-risk ones always need review.
    expect(state.columnMappings["Item Naam"].route).toBe("auto");
    expect(state.columnMappings["M.R.P (Rs)"].route).toBe("review");

    state = approveG2(state, {
      "M.R.P (Rs)": "price.maximum_value",
      Rate: "price.value",
      Wajan: "net_quantity",
      "Veg/NonVeg": "veg_non_veg",
      "Mfg Dt": "month_year_of_manufacture_packing_import",
      Barcode: "descriptor.code",
    });
    expect(state.step).toBe("category");
    expect(state.items[0].name).toBe("Toor Dal");
    expect(state.items[0].mrp).toBe(165);
    expect(state.items[0].vegNonVeg).toBe("veg");

    state = completeCategory(state, [{ itemId: "row-1", categoryId: "Dals and Pulses", confidence: 0.9 }]);
    expect(state.step).toBe("validate");
    expect(state.items[0].category).toBe("Dals and Pulses");

    const issues = validateItems(state.items, grocerySeller);
    expect(issues).toEqual([]); // clean row, no planted error
    state = completeValidation(state, issues);
    expect(state.skippedSteps).toContain("queue");
    expect(state.step).toBe("g3");

    state = signOffG3(state);
    expect(state.step).toBe("build");
    expect(state.gates.map((g) => g.gate)).toContain("G3");

    const catalogItems = state.items.map((item) => buildOndcItem(item, grocerySeller));
    state = completeBuild(state, catalogItems);
    expect(state.step).toBe("g4");

    state = approveG4Pilot(state);
    expect(state.pilotApproved).toBe(true);
    state = approveG4Full(state);
    expect(state.step).toBe("publish");
    expect(state.gates.map((g) => g.gate)).toContain("G4");

    state = completePublish(state);
    expect(state.step).toBe("done");
    expect(state.published).toBe(true);
  });

  it("a branded item with no packer column ends up in G3, never pre-filled with the seller", () => {
    let state = createCatalogRun("run-b2", grocerySeller, "csv");
    state = completeSourceIntake(state, "Excel workbook, header found on row 3");
    state = completeExtraction(state, {
      rawRows: [
        { "Item Naam": "Toor Dal", Brand: "Annakosh", "M.R.P (Rs)": "165", Rate: "160", "Mfg Dt": "09/2026" },
      ],
      hadParseErrors: false,
    });
    state = completeMapping(state, [
      { column: "Item Naam", candidates: [], proposed: "descriptor.name", confidence: 0.95, risk: "low", reason: "x" },
      { column: "Brand", candidates: [], proposed: "brand", confidence: 0.95, risk: "low", reason: "x" },
      { column: "M.R.P (Rs)", candidates: [], proposed: "price.maximum_value", confidence: 0.92, risk: "high", reason: "x" },
      { column: "Rate", candidates: [], proposed: "price.value", confidence: 0.92, risk: "high", reason: "x" },
      { column: "Mfg Dt", candidates: [], proposed: "month_year_of_manufacture_packing_import", confidence: 0.9, risk: "high", reason: "x" },
    ]);
    state = approveG2(state, {
      "M.R.P (Rs)": "price.maximum_value",
      Rate: "price.value",
      "Mfg Dt": "month_year_of_manufacture_packing_import",
    });
    // No column mapped to manufacturer_or_packer_name or brand_owner_FSSAI_license_no.
    expect(state.items[0].manufacturerOrPackerName).toBeUndefined();
    expect(state.items[0].fssaiLicenceNo).toBeUndefined();

    state = completeCategory(state, [{ itemId: "row-1", categoryId: "Dals and Pulses", confidence: 0.9 }]);
    const issues = validateItems(state.items, grocerySeller);
    expect(issues.some((i) => i.type === "packer_missing")).toBe(true);
    expect(issues.some((i) => i.type === "fssai")).toBe(true);
    state = completeValidation(state, issues);
    expect(state.step).toBe("g3");

    expect(() => signOffG3(state)).toThrow(OrchestratorStateError);

    state = enterPackerDetailsAtG3(state, "row-1", {
      manufacturerOrPackerName: "Annakosh Agro Pvt Ltd",
      manufacturerOrPackerAddress: "Demo Estate, Kolhapur 416000",
      fssaiLicenceNo: "20000000000903",
    });
    expect(state.items[0].manufacturerOrPackerName).toBe("Annakosh Agro Pvt Ltd");
    expect(state.issues.some((i) => i.type === "packer_missing" || i.type === "fssai")).toBe(false);

    state = signOffG3(state);
    expect(state.step).toBe("build");
  });

  it("routes a planted validation issue through the fallback queue and G3", () => {
    let state = createCatalogRun("run-f", grocerySeller, "csv");
    state = completeSourceIntake(state, "CSV, header found on row 1");
    state = completeExtraction(state, {
      rawRows: [{ sku: "TRP-003", name: "Chana Dal" }],
      hadParseErrors: false,
    });
    state = completeMapping(state, [
      { column: "sku", candidates: [], proposed: "id", confidence: 0.95, risk: "low", reason: "x" },
      { column: "name", candidates: [], proposed: "descriptor.name", confidence: 0.95, risk: "low", reason: "x" },
    ]);
    state = approveG2(state);
    state = completeCategory(state, []);

    const brokenItems = state.items.map((item) => ({ ...item, gtin: "2000006000036", mrp: 110, price: 105 }));
    const issues = validateItems(brokenItems, grocerySeller);
    state = { ...state, items: brokenItems };
    state = completeValidation(state, issues);
    expect(state.skippedSteps).not.toContain("queue");
    expect(state.step).toBe("queue");

    expect(() => signOffG3({ ...state, step: "g3" })).toThrow(OrchestratorStateError);

    state = resolveFallbackQueueItem(state, "TRP-003", "clear_gtin");
    state = finishFallbackQueue(state);
    expect(state.step).toBe("g3");
    expect(state.gates.map((g) => g.gate)).toContain("FQ");

    // The planted MRP-below-price issue (severity "g3") is still open: sign-off must fail until resolved.
    expect(() => signOffG3(state)).toThrow(OrchestratorStateError);
  });

  it("routes an unparseable net quantity to the fallback queue and lets the reviewer correct it", () => {
    let state = createCatalogRun("run-wajan", grocerySeller, "csv");
    state = completeSourceIntake(state, "CSV, header found on row 1");
    state = completeExtraction(state, {
      rawRows: [{ sku: "RKS-099", name: "Besan", wajan: "aadha kilo" }],
      hadParseErrors: false,
    });
    state = completeMapping(state, [
      { column: "sku", candidates: [], proposed: "id", confidence: 0.95, risk: "low", reason: "x" },
      { column: "name", candidates: [], proposed: "descriptor.name", confidence: 0.95, risk: "low", reason: "x" },
      { column: "wajan", candidates: [], proposed: "net_quantity", confidence: 0.95, risk: "high", reason: "x" },
    ]);
    state = approveG2(state, { wajan: "net_quantity" });
    expect(state.items[0].netQty).toBe("aadha kilo"); // kept raw, not blanked
    state = completeCategory(state, []);

    const issues = validateItems(state.items, grocerySeller);
    expect(issues.some((i) => i.type === "net_qty_unparsed" && i.severity === "queue")).toBe(true);
    state = completeValidation(state, issues);
    expect(state.step).toBe("queue");

    state = resolveFallbackQueueItem(state, "RKS-099", { kind: "set_net_qty", value: "500 g" });
    expect(state.items[0].netQty).toBe("500 g");
    expect(state.issues.some((i) => i.type === "net_qty_unparsed")).toBe(false);
  });

  it("resolves all 48 of set B's real packer_missing issues with four brand-level G3 entries", () => {
    const raw = readFileSync(join(process.cwd(), "data/sets/set-B/catalog_flat.csv"), "utf-8");
    const records = parseCsvRecords(raw);
    expect(records).toHaveLength(60);

    const fieldMap: Record<string, MappingTargetKey> = {
      "Sr No": "IGNORE",
      "Item Naam": "descriptor.name",
      Brand: "brand",
      "M.R.P (Rs)": "price.maximum_value",
      Rate: "price.value",
      Wajan: "net_quantity",
      Barcode: "descriptor.code",
      "Stock (pcs)": "quantity.available.count",
      "Veg/NonVeg": "veg_non_veg",
      "Mfg Dt": "month_year_of_manufacture_packing_import",
      Remarks: "IGNORE",
    };

    let state = createCatalogRun("run-b3", grocerySeller, "csv");
    state = completeSourceIntake(state, "Excel workbook, header found on row 3");
    state = completeExtraction(state, { rawRows: records, hadParseErrors: false });

    const columns = profileColumns(records);
    state = completeMapping(
      state,
      columns.map((column) => ({
        column: column.column,
        candidates: [],
        proposed: fieldMap[column.column],
        confidence: 0.95,
        risk: targetRisk(fieldMap[column.column]),
        reason: "ground truth",
      })),
    );
    state = approveG2(state, fieldMap);
    expect(state.items).toHaveLength(60);

    state = completeCategory(state, []);

    const issues = validateItems(state.items, grocerySeller);
    const packerIssues = issues.filter((i) => i.type === "packer_missing");
    const fssaiIssues = issues.filter((i) => i.type === "fssai");
    expect(packerIssues).toHaveLength(48);
    expect(fssaiIssues).toHaveLength(48);

    // Set B's real data has 3 rows with "aadha kilo" (a word form, needs the
    // LLM, not the rule): they land in the fallback queue, not g3 directly.
    const netQtyIssues = issues.filter((i) => i.type === "net_qty_unparsed");
    expect(netQtyIssues).toHaveLength(3);

    state = completeValidation(state, issues);
    expect(state.step).toBe("queue");
    for (const issue of netQtyIssues) {
      state = resolveFallbackQueueItem(state, issue.itemId, { kind: "set_net_qty", value: "500 g" });
    }
    state = finishFallbackQueue(state);
    expect(state.step).toBe("g3");

    const labels = JSON.parse(
      readFileSync(join(process.cwd(), "data/sets/set-B/seller_pack/brand_owner_labels.json"), "utf-8"),
    ).brands;

    for (const [brand, label] of Object.entries<{
      manufacturer_or_packer_name: string;
      manufacturer_or_packer_address: string;
      brand_owner_FSSAI_license_no: string;
    }>(labels)) {
      state = enterPackerDetailsForBrandAtG3(state, brand, {
        manufacturerOrPackerName: label.manufacturer_or_packer_name,
        manufacturerOrPackerAddress: label.manufacturer_or_packer_address,
        fssaiLicenceNo: label.brand_owner_FSSAI_license_no,
      });
    }

    expect(state.issues.filter((i) => i.type === "packer_missing" || i.type === "fssai")).toHaveLength(0);
    // Four brand-level entries, not one per item.
    const brandEntries = state.auditLog.filter((e) => e.text.includes('item(s) from the pack label'));
    expect(brandEntries).toHaveLength(4);

    state = signOffG3(state);
    expect(state.step).toBe("build");
  });
});

describe("catalog run: unstructured source (set D style)", () => {
  it("requires G1, skips mapping and G2 entirely", () => {
    let state = createCatalogRun("run-d", { ...grocerySeller, business_name: "Butterleaf Home Bakery" }, "whatsapp_text");
    state = completeSourceIntake(state, "WhatsApp chat export, 28 lines");
    expect(state.skippedSteps).toEqual(expect.arrayContaining(["mapping", "g2"]));

    state = completeExtraction(state, {
      items: [{ id: "item-1", name: "Chocolate Brownie", price: 60, extractionConfidence: 0.7, sourceExcerpt: "Brownie 60rs" }],
    });
    expect(state.step).toBe("g1");

    state = confirmG1(state, { "item-1": { mrp: 60 } });
    expect(state.step).toBe("category"); // mapping and g2 both skipped
    expect(state.items[0].mrp).toBe(60);
  });
});

describe("catalog run guards", () => {
  it("refuses to approve the full catalog before the pilot phase", () => {
    let state = createCatalogRun("run-g4", grocerySeller, "csv");
    state = { ...state, step: "g4" };
    expect(() => approveG4Full(state)).toThrow(OrchestratorStateError);
  });

  it("refuses to act on the wrong step", () => {
    const state = createCatalogRun("run-x", grocerySeller, "csv");
    expect(() => approveG2(state)).toThrow(OrchestratorStateError);
  });
});
