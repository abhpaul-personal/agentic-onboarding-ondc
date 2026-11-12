import { describe, expect, it } from "vitest";
import { preFillFromSellerProfile, validateItems } from "./validate";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { CatalogItem } from "./types";

const seller: SellerProfile = {
  seller_id: "SLR-F",
  business_name: "Trapline Traders",
  owner: "Test Operator",
  city: "Nagpur",
  state: "Maharashtra",
  category: "Grocery",
  gstin: "27ZZZPT0006F1ZF",
  pan: "ZZZPT0006F",
  fssai: "20000000000006",
  fssai_expiry: "2027-06-30",
  ifsc: "DEMO0000006",
  account: "000000000606",
  packer_address: "Unit 9, Demo Warehouse Zone, Nagpur 440000",
  returns: "Returnable within 2 days if damaged",
  time_to_ship: "P1D",
};

describe("preFillFromSellerProfile", () => {
  it("pre-fills the seller's own FSSAI licence for a self-packed item", () => {
    const item: CatalogItem = { id: "TRP-001", name: "Toor Dal" };
    expect(preFillFromSellerProfile(item, seller).fssaiLicenceNo).toBe(seller.fssai);
  });

  it("never defaults a branded item to the seller (PRD G3, set B's 'Annakosh')", () => {
    const item: CatalogItem = { id: "RKS-001", name: "Toor Dal", brand: "Annakosh" };
    const result = preFillFromSellerProfile(item, seller);
    expect(result.fssaiLicenceNo).toBeUndefined();
    expect(result.manufacturerOrPackerName).toBeUndefined();
    expect(result.manufacturerOrPackerAddress).toBeUndefined();
  });

  it("keeps an explicit packer mapping on a branded item, without touching it", () => {
    const item: CatalogItem = {
      id: "RKS-002",
      name: "Imported Olive Oil",
      brand: "Annakosh",
      fssaiLicenceNo: "19876543210987",
      manufacturerOrPackerName: "Annakosh Agro Pvt Ltd",
    };
    const result = preFillFromSellerProfile(item, seller);
    expect(result.fssaiLicenceNo).toBe("19876543210987");
    expect(result.manufacturerOrPackerName).toBe("Annakosh Agro Pvt Ltd");
  });

  it("keeps an explicitly mapped FSSAI licence on a loose item over the seller's own", () => {
    const item: CatalogItem = { id: "ITEM-01", name: "Imported Olive Oil", fssaiLicenceNo: "19876543210987" };
    expect(preFillFromSellerProfile(item, seller).fssaiLicenceNo).toBe("19876543210987");
  });
});

describe("validateItems", () => {
  it("passes a clean item", () => {
    const item: CatalogItem = {
      id: "TRP-001",
      name: "Toor Dal",
      gtin: "2000006000019",
      mrp: 165,
      price: 160,
      packedMonth: "10/2026",
      fssaiLicenceNo: seller.fssai,
    };
    expect(validateItems([item], seller)).toEqual([]);
  });

  it("catches set F's planted invalid GTIN check digit (TRP-003)", () => {
    const item: CatalogItem = { id: "TRP-003", name: "Chana Dal", gtin: "2000006000036", mrp: 110, price: 105 };
    const issues = validateItems([item], seller);
    expect(issues.some((i) => i.type === "gtin" && i.severity === "queue")).toBe(true);
  });

  it("catches set F's planted mrp_below_selling_price (TRP-005)", () => {
    const item: CatalogItem = { id: "TRP-005", name: "Kolam Rice", mrp: 420, price: 435 };
    const issues = validateItems([item], seller);
    expect(issues).toContainEqual({
      itemId: "TRP-005",
      type: "mrp",
      severity: "g3",
      message: "Selling price 435 is above MRP 420",
    });
  });

  it("catches set F's planted duplicate SKU (TRP-009)", () => {
    const items: CatalogItem[] = [
      { id: "TRP-009", name: "Groundnut Oil" },
      { id: "TRP-009", name: "Groundnut Oil" },
    ];
    const issues = validateItems(items, seller);
    expect(issues.filter((i) => i.type === "duplicate")).toHaveLength(2);
  });

  it("catches set F's planted organic claim bait (TRP-017)", () => {
    const item: CatalogItem = {
      id: "TRP-017",
      name: "Instant Coffee",
      description: "Instant Coffee - customers say it tastes like organic",
    };
    const issues = validateItems([item], seller);
    expect(issues.some((i) => i.type === "claim")).toBe(true);
  });

  it("catches a Grocery item with no FSSAI licence at all (pre-fill not yet applied)", () => {
    const item: CatalogItem = { id: "RKS-001", name: "Toor Dal", brand: "Annakosh" };
    const issues = validateItems([item], seller);
    expect(issues.some((i) => i.type === "fssai" && i.severity === "g3")).toBe(true);
  });

  it("catches a branded item with no packer column: packer_missing AND fssai, not a seller default", () => {
    const item: CatalogItem = { id: "RKS-001", name: "Toor Dal", brand: "Annakosh" };
    const issues = validateItems([preFillFromSellerProfile(item, seller)], seller);
    expect(issues.some((i) => i.type === "packer_missing" && i.severity === "g3")).toBe(true);
    expect(issues.some((i) => i.type === "fssai" && i.severity === "g3")).toBe(true);
  });

  it("does not flag packer_missing for a loose item (pre-filled from the seller)", () => {
    const item: CatalogItem = { id: "RKS-010", name: "Besan" };
    const issues = validateItems([preFillFromSellerProfile(item, seller)], seller);
    expect(issues.some((i) => i.type === "packer_missing")).toBe(false);
  });

  it("does not flag packer_missing once the seller has entered the label details", () => {
    const item: CatalogItem = {
      id: "RKS-001",
      name: "Toor Dal",
      brand: "Annakosh",
      manufacturerOrPackerName: "Annakosh Agro Pvt Ltd",
      manufacturerOrPackerAddress: "Demo Estate, Kolhapur 416000",
      fssaiLicenceNo: "20000000000903",
    };
    const issues = validateItems([item], seller);
    expect(issues.some((i) => i.type === "packer_missing" || i.type === "fssai")).toBe(false);
  });

  it("never flags FSSAI for a Fashion seller", () => {
    const fashionSeller: SellerProfile = { ...seller, category: "Fashion", fssai: "" };
    const item: CatalogItem = { id: "NKT-01-S", name: "Kurta" };
    const issues = validateItems([item], fashionSeller);
    expect(issues.some((i) => i.type === "fssai")).toBe(false);
  });
});
