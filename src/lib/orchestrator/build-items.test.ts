import { describe, expect, it } from "vitest";
import { buildItemsFromMappedColumns } from "./build-items";

describe("buildItemsFromMappedColumns", () => {
  it("applies set B's real mapping to a messy row", () => {
    const rows = [
      {
        "Sr No": "1",
        "Item Naam": "Toor Dal",
        Brand: "Annakosh",
        "M.R.P (Rs)": "165",
        Rate: "160",
        Wajan: "1 kg",
        Barcode: "2000002000013",
        "Stock (pcs)": "9",
        "Veg/NonVeg": "Veg",
        "Mfg Dt": "09/2026",
        Remarks: "fast seller",
      },
    ];
    const targets = {
      "Sr No": null,
      "Item Naam": "descriptor.name" as const,
      Brand: "brand" as const,
      "M.R.P (Rs)": "price.maximum_value" as const,
      Rate: "price.value" as const,
      Wajan: "net_quantity" as const,
      Barcode: "descriptor.code" as const,
      "Stock (pcs)": "quantity.available.count" as const,
      "Veg/NonVeg": "veg_non_veg" as const,
      "Mfg Dt": "month_year_of_manufacture_packing_import" as const,
      Remarks: "IGNORE" as const,
    };

    const [item] = buildItemsFromMappedColumns(rows, targets);
    expect(item.name).toBe("Toor Dal");
    expect(item.brand).toBe("Annakosh");
    expect(item.mrp).toBe(165);
    expect(item.price).toBe(160);
    expect(item.netQty).toBe("1000 g"); // "1 kg" normalised to grams
    expect(item.gtin).toBe("2000002000013");
    expect(item.stock).toBe(9);
    expect(item.vegNonVeg).toBe("veg");
    expect(item.packedMonth).toBe("09/2026");
  });

  it("normalises set B's real Wajan formats, never dropping to blank or NaN", () => {
    const rows = [
      { Wajan: "500gm" },
      { Wajan: "0.5 Kg" },
      { Wajan: "aadha kilo" }, // a word form: kept raw, flagged by validateItems
      { Wajan: "1/2 kg" },
      { Wajan: "1 kg" },
      { Wajan: "250GM" },
    ];
    const netQtys = buildItemsFromMappedColumns(rows, { Wajan: "net_quantity" as const }).map((i) => i.netQty);
    expect(netQtys).toEqual(["500 g", "500 g", "aadha kilo", "500 g", "1000 g", "250 g"]);
  });

  it("normalises set B's real Mfg Dt formats, never dropping to blank or NaN", () => {
    const rows = [
      { "Mfg Dt": "Oct-26" },
      { "Mfg Dt": "10/2026" },
      { "Mfg Dt": "Sept 2026" },
      { "Mfg Dt": "09-2026" },
    ];
    const months = buildItemsFromMappedColumns(rows, {
      "Mfg Dt": "month_year_of_manufacture_packing_import" as const,
    }).map((i) => i.packedMonth);
    expect(months).toEqual(["10/2026", "10/2026", "09/2026", "09/2026"]);
  });

  it("strips currency symbols before parsing a price (set B's real formats)", () => {
    const rows = [
      { A: "120" }, // plain
      { A: "Rs 165" },
      { A: "Rs. 75/-" },
      { A: "₹110.00" }, // "₹110.00"
      { A: "Rs. 1,250/-" }, // thousands separator
    ];
    const prices = buildItemsFromMappedColumns(rows, { A: "price.value" as const }).map((i) => i.price);
    expect(prices).toEqual([120, 165, 75, 110, 1250]);
  });

  it("recognises a non-veg value", () => {
    const [item] = buildItemsFromMappedColumns(
      [{ Mark: "Non-Veg" }],
      { Mark: "veg_non_veg" as const },
    );
    expect(item.vegNonVeg).toBe("non_veg");
  });

  it("leaves a field unset when the mapped value is blank", () => {
    const [item] = buildItemsFromMappedColumns([{ Brand: "" }], { Brand: "brand" as const });
    expect(item.brand).toBeUndefined();
  });

  it("falls back to a generated id when no column maps to id", () => {
    const [item] = buildItemsFromMappedColumns([{ Name: "Toor Dal" }], { Name: "descriptor.name" as const });
    expect(item.id).toBe("row-1");
  });

  it("set C's real Shopify shape: forward-fills name/brand/category across a variant group and appends each row's own size", () => {
    // A real Shopify export only fills Title/Vendor/Type on a product's first
    // row; later variant rows share Handle but leave them blank.
    const rows = [
      {
        Handle: "chanderi-kurta-set-01",
        Title: "Chanderi Kurta Set 01",
        Vendor: "Neelkurinji",
        Type: "Kurtas and Kurta Sets",
        "Option1 Value": "S",
        "Variant SKU": "NKT-01-S",
      },
      {
        Handle: "chanderi-kurta-set-01",
        Title: "",
        Vendor: "",
        Type: "",
        "Option1 Value": "M",
        "Variant SKU": "NKT-01-M",
      },
      {
        Handle: "chanderi-kurta-set-01",
        Title: "",
        Vendor: "",
        Type: "",
        "Option1 Value": "L",
        "Variant SKU": "NKT-01-L",
      },
    ];
    const targets = {
      Handle: "parent_item_id" as const,
      Title: "descriptor.name" as const,
      Vendor: "brand" as const,
      Type: "category_id" as const,
      "Option1 Value": "size" as const,
      "Variant SKU": "id" as const,
    };

    const items = buildItemsFromMappedColumns(rows, targets);
    expect(items.map((i) => i.name)).toEqual([
      "Chanderi Kurta Set 01 - S",
      "Chanderi Kurta Set 01 - M",
      "Chanderi Kurta Set 01 - L",
    ]);
    expect(items.every((i) => i.brand === "Neelkurinji")).toBe(true);
    expect(items.every((i) => i.category === "Kurtas and Kurta Sets")).toBe(true);
  });

  it("leaves non-variant items (no parent_item_id mapped) untouched", () => {
    const [item] = buildItemsFromMappedColumns([{ Name: "Toor Dal" }], { Name: "descriptor.name" as const });
    expect(item.name).toBe("Toor Dal");
    expect(item.parentItemId).toBeUndefined();
  });

  it("falls back to the item's id rather than a blank name when no column (and no variant group) resolves one", () => {
    // Mirrors a mapping agent misreading a Shopify "Handle" column as "id"
    // instead of "parent_item_id": no column maps to a name, and there is
    // no group to inherit one from, so buildItemsFromMappedColumns must
    // never hand the category agent a blank name (it would crash on
    // categoryInputSchema's name: z.string().min(1)).
    const [item] = buildItemsFromMappedColumns([{ Handle: "chanderi-kurta-set-01" }], {
      Handle: "id" as const,
    });
    expect(item.name).toBe("chanderi-kurta-set-01");
  });
});
