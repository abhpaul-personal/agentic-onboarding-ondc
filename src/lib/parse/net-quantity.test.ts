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
});

describe("formatNetQuantityGrams", () => {
  it("formats a whole number without decimals", () => {
    expect(formatNetQuantityGrams(500)).toBe("500 g");
  });

  it("matches the canonical pattern used by validateItems", () => {
    expect(NET_QUANTITY_CANONICAL_PATTERN.test(formatNetQuantityGrams(500))).toBe(true);
  });
});
