import { describe, expect, it } from "vitest";
import { panMatchesGstin, panValid } from "./pan";

describe("panValid", () => {
  it("accepts a well-formed PAN", () => {
    expect(panValid("ZZZPT0001A")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(panValid("ZZZPT0001")).toBe(false); // too short
    expect(panValid("zzzpt0001a")).toBe(false); // lowercase
  });
});

describe("panMatchesGstin", () => {
  it("matches the PAN embedded in a seller's GSTIN", () => {
    expect(panMatchesGstin("ZZZPT0001A", "27ZZZPT0001A1ZU")).toBe(true);
  });

  it("rejects a PAN that does not appear in the GSTIN", () => {
    expect(panMatchesGstin("ZZZPQ0004D", "27ZZZPT0001A1ZU")).toBe(false);
  });
});
