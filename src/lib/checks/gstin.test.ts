import { describe, expect, it } from "vitest";
import { gstinStateCodeMatches, gstinValid } from "./gstin";

describe("gstinValid", () => {
  it("accepts a valid GSTIN from the eval kit", () => {
    expect(gstinValid("27ZZZPT0001A1ZU")).toBe(true);
    expect(gstinValid("32ZZZPV0003C1ZV")).toBe(true);
  });

  it("rejects a GSTIN with a wrong check digit", () => {
    expect(gstinValid("27ZZZPT0001A1ZZ")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(gstinValid("not-a-gstin")).toBe(false);
    expect(gstinValid("")).toBe(false);
  });
});

describe("gstinStateCodeMatches", () => {
  it("matches a GSTIN's prefix to the seller's state", () => {
    expect(gstinStateCodeMatches("27ZZZPT0001A1ZU", "Maharashtra")).toBe(true);
    expect(gstinStateCodeMatches("32ZZZPV0003C1ZV", "Kerala")).toBe(true);
  });

  it("rejects a mismatched state", () => {
    expect(gstinStateCodeMatches("27ZZZPT0001A1ZU", "Kerala")).toBe(false);
  });

  it("rejects an unknown state name", () => {
    expect(gstinStateCodeMatches("27ZZZPT0001A1ZU", "Narnia")).toBe(false);
  });
});
