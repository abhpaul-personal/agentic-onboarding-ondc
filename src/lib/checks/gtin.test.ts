import { describe, expect, it } from "vitest";
import { gtinCheckDigitValid, usesRestrictedCirculationPrefix } from "./gtin";

describe("gtinCheckDigitValid", () => {
  it("accepts a valid GTIN from set A", () => {
    expect(gtinCheckDigitValid("2000001000014")).toBe(true);
  });

  it("rejects set F's planted invalid check digits", () => {
    expect(gtinCheckDigitValid("2000006000036")).toBe(false); // TRP-003
    expect(gtinCheckDigitValid("2000006000111")).toBe(false); // TRP-011
  });

  it("rejects malformed input", () => {
    expect(gtinCheckDigitValid("12345")).toBe(false);
    expect(gtinCheckDigitValid("")).toBe(false);
  });
});

describe("usesRestrictedCirculationPrefix", () => {
  it("flags GTINs starting with the kit's synthetic prefix", () => {
    expect(usesRestrictedCirculationPrefix("2000001000014")).toBe(true);
  });

  it("does not flag a GTIN outside that prefix", () => {
    expect(usesRestrictedCirculationPrefix("8901234567894")).toBe(false);
  });
});
