import { describe, expect, it } from "vitest";
import { mrpAtOrAboveSellingPrice } from "./mrp";

describe("mrpAtOrAboveSellingPrice", () => {
  it("passes when the selling price is below MRP", () => {
    expect(mrpAtOrAboveSellingPrice(165, 160)).toBe(true);
  });

  it("passes when the selling price equals MRP", () => {
    expect(mrpAtOrAboveSellingPrice(160, 160)).toBe(true);
  });

  it("fails set F's planted mrp_below_selling_price error (TRP-005)", () => {
    expect(mrpAtOrAboveSellingPrice(420, 435)).toBe(false);
  });
});
