import { describe, expect, it } from "vitest";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
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
        Brand: "Rambhau Kirana Stores",
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
