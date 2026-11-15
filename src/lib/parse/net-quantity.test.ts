import { describe, expect, it } from "vitest";
import { formatNetQuantityGrams, NET_QUANTITY_CANONICAL_PATTERN, parseNetQuantityGrams } from "./net-quantity";

describe("parseNetQuantityGrams", () => {
  it('parses "500gm"', () => {
    expect(parseNetQuantityGrams("500gm")).toBe(500);
  });

  it('parses "0.5 Kg" (case-insensitive unit)', () => {
    expect(parseNetQuantityGrams("0.5 Kg")).toBe(500);
  });

  it('parses "1/2 kg" (a fraction)', () => {
    expect(parseNetQuantityGrams("1/2 kg")).toBe(500);
  });

  it('parses "1 kg"', () => {
    expect(parseNetQuantityGrams("1 kg")).toBe(1000);
  });

  it('parses "250GM" (no space, uppercase)', () => {
    expect(parseNetQuantityGrams("250GM")).toBe(250);
  });

  it('returns null for a word form ("aadha kilo"), which needs the LLM per the PRD', () => {
    expect(parseNetQuantityGrams("aadha kilo")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseNetQuantityGrams("")).toBeNull();
    expect(parseNetQuantityGrams("lots")).toBeNull();
  });

  it('returns null for a bare unitless number ("500") by default', () => {
    expect(parseNetQuantityGrams("500")).toBeNull();
  });

  it('with assumeGramsIfUnitless, treats a bare number ("500") as grams', () => {
    expect(parseNetQuantityGrams("500", { assumeGramsIfUnitless: true })).toBe(500);
    expect(parseNetQuantityGrams("1000", { assumeGramsIfUnitless: true })).toBe(1000);
  });

  it("with assumeGramsIfUnitless, still returns null for anything that isn't a bare number", () => {
    expect(parseNetQuantityGrams("aadha kilo", { assumeGramsIfUnitless: true })).toBeNull();
    expect(parseNetQuantityGrams("500 pcs", { assumeGramsIfUnitless: true })).toBeNull();
    expect(parseNetQuantityGrams("", { assumeGramsIfUnitless: true })).toBeNull();
  });
});

describe("formatNetQuantityGrams", () => {
  it("formats a whole number without decimals", () => {
    expect(formatNetQuantityGrams(500)).toBe("500 g");
  });

  it("matches the canonical pattern used by validateItems", () => {
    expect(NET_QUANTITY_CANONICAL_PATTERN.test(formatNetQuantityGrams(500))).toBe(true);
  });
});
