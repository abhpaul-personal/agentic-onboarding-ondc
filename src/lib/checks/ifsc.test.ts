import { describe, expect, it } from "vitest";
import { ifscValid } from "./ifsc";

describe("ifscValid", () => {
  it("accepts a well-formed IFSC code", () => {
    expect(ifscValid("DEMO0000001")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(ifscValid("DEMO000001")).toBe(false); // too short
    expect(ifscValid("DEM10000001")).toBe(false); // 5th char must be "0"
  });
});
