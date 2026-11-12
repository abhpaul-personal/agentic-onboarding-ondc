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
    expect(item.netQty).toBe("1 kg");
    expect(item.gtin).toBe("2000002000013");
    expect(item.stock).toBe(9);
    expect(item.vegNonVeg).toBe("veg");
    expect(item.packedMonth).toBe("09/2026");
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
});
