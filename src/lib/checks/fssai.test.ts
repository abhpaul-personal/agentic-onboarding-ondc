import { describe, expect, it } from "vitest";
import { fssaiFormatValid, fssaiInDate } from "./fssai";

describe("fssaiFormatValid", () => {
  it("accepts a 14-digit licence starting with 1 or 2", () => {
    expect(fssaiFormatValid("20000000000001")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(fssaiFormatValid("2000000000001")).toBe(false); // 13 digits
    expect(fssaiFormatValid("30000000000001")).toBe(false); // bad leading digit
  });
});

describe("fssaiInDate", () => {
  it("treats a future expiry as in date", () => {
    expect(fssaiInDate("2028-03-31", new Date("2026-11-12"))).toBe(true);
  });

  it("treats a past expiry as expired (set G's planted error)", () => {
    expect(fssaiInDate("2025-01-01", new Date("2026-11-12"))).toBe(false);
  });

  it("treats an unparsable date as expired", () => {
    expect(fssaiInDate("not-a-date")).toBe(false);
  });
});
