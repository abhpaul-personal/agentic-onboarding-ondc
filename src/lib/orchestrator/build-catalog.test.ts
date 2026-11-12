import { describe, expect, it } from "vitest";
import { ondcItemSchema } from "@/lib/schemas/ondc-item";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import { buildOndcItem, MissingPackerDetailsError } from "./build-catalog";
import type { CatalogItem } from "./types";

const grocerySeller: SellerProfile = {
  seller_id: "SLR-A",
  business_name: "Tilwari Masala Ghar",
  owner: "Meena Tilwari",
  city: "Nashik",
  state: "Maharashtra",
  category: "Grocery",
  gstin: "27ZZZPT0001A1ZU",
  pan: "ZZZPT0001A",
  fssai: "20000000000001",
  fssai_expiry: "2028-03-31",
  ifsc: "DEMO0000001",
  account: "000000000101",
  packer_address: "Plot 4, Demo Industrial Lane, Nashik 422000",
  returns: "Not returnable (food)",
  time_to_ship: "P1D",
};

describe("buildOndcItem", () => {
  it("builds a valid, schema-passing Grocery item", () => {
    const item: CatalogItem = {
      id: "TMG-001",
      name: "Turmeric Powder 200g",
      category: "Masala and Seasoning",
      gtin: "2000001000014",
      netQty: "200 g",
      price: 90,
      mrp: 90,
      stock: 58,
      vegNonVeg: "veg",
      packedMonth: "09/2026",
    };
    const ondcItem = buildOndcItem(item, grocerySeller);
    expect(ondcItemSchema.safeParse(ondcItem).success).toBe(true);
    expect(ondcItem.descriptor.code).toBe("1:2000001000014");
    expect(ondcItem["@ondc/org/returnable"]).toBe(false);
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]?.manufacturer_or_packer_name).toBe(
      grocerySeller.business_name,
    );
    expect(ondcItem["@ondc/org/statutory_reqs_prepackaged_food"]?.brand_owner_FSSAI_license_no).toBe(
      grocerySeller.fssai,
    );
  });

  it("uses a branded item's packer details as entered by the seller at G3, not the seller's own", () => {
    // By the time buildOndcItem runs, enterPackerDetailsAtG3 (catalog-run.ts) has already
    // filled these in for a branded item; PRD G3, "Branded items packed by someone else".
    const item: CatalogItem = {
      id: "RKS-001",
      name: "Toor Dal",
      brand: "Annakosh",
      category: "Dals and Pulses",
      manufacturerOrPackerName: "Annakosh Agro Pvt Ltd",
      manufacturerOrPackerAddress: "Demo Estate, Kolhapur 416000",
      fssaiLicenceNo: "20000000000903",
    };
    const seller = { ...grocerySeller, business_name: "Rambhau Kirana Stores" };
    const ondcItem = buildOndcItem(item, seller);
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]?.manufacturer_or_packer_name).toBe(
      "Annakosh Agro Pvt Ltd",
    );
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]?.manufacturer_or_packer_address).toBe(
      "Demo Estate, Kolhapur 416000",
    );
    expect(ondcItem["@ondc/org/statutory_reqs_prepackaged_food"]?.brand_owner_FSSAI_license_no).toBe(
      "20000000000903",
    );
  });

  it("falls back to the seller's own name and address only when the item has none (a loose item)", () => {
    const item: CatalogItem = { id: "ITEM-01", name: "Besan" };
    const ondcItem = buildOndcItem(item, grocerySeller);
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]?.manufacturer_or_packer_name).toBe(
      grocerySeller.business_name,
    );
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]?.manufacturer_or_packer_address).toBe(
      grocerySeller.packer_address,
    );
  });

  it("throws rather than defaulting a branded item to the seller when G3 was skipped", () => {
    const item: CatalogItem = { id: "RKS-001", name: "Toor Dal", brand: "Annakosh" };
    expect(() => buildOndcItem(item, grocerySeller)).toThrow(MissingPackerDetailsError);
    expect(() => buildOndcItem(item, grocerySeller)).toThrow(/RKS-001/);
  });

  it("throws if only some of a branded item's packer fields were entered", () => {
    const item: CatalogItem = {
      id: "RKS-001",
      name: "Toor Dal",
      brand: "Annakosh",
      manufacturerOrPackerName: "Annakosh Agro Pvt Ltd",
      // address and FSSAI licence missing
    };
    expect(() => buildOndcItem(item, grocerySeller)).toThrow(MissingPackerDetailsError);
  });

  it("carries Fashion variant fields and omits statutory blocks", () => {
    const item: CatalogItem = {
      id: "NKT-01-S",
      name: "Chanderi Kurta Set 01 - S",
      brand: "Neelkurinji",
      category: "Kurtas and Kurta Sets",
      parentItemId: "chanderi-kurta-set-01",
      colour: "Teal",
      size: "S",
      material: "Chanderi",
      gender: "female",
      price: 1490,
      mrp: 1490,
      stock: 3,
    };
    const fashionSeller: SellerProfile = { ...grocerySeller, category: "Fashion", fssai: "" };
    const ondcItem = buildOndcItem(item, fashionSeller);
    expect(ondcItemSchema.safeParse(ondcItem).success).toBe(true);
    expect(ondcItem.parent_item_id).toBe("chanderi-kurta-set-01");
    expect(ondcItem.colour).toBe("Teal");
    expect(ondcItem["@ondc/org/statutory_reqs_packaged_commodities"]).toBeUndefined();
  });
});
