import { describe, expect, it } from "vitest";
import { findUnsupportedClaim } from "./claims";

describe("findUnsupportedClaim", () => {
  it("catches set F's planted organic claim bait (TRP-017)", () => {
    expect(findUnsupportedClaim("Instant Coffee - customers say it tastes like organic")).toBe(
      "organic",
    );
  });

  it("catches handmade and sugar-free claims", () => {
    expect(findUnsupportedClaim("Handmade soap bar")).toBe("Handmade");
    expect(findUnsupportedClaim("Sugar-free candy")).toBe("Sugar-free");
  });

  it("returns null for a plain factual description", () => {
    expect(findUnsupportedClaim("Toor Dal, 1000 g pack")).toBeNull();
  });
});
