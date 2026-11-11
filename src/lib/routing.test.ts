import { describe, expect, it } from "vitest";
import { route } from "./routing";

describe("route", () => {
  it("auto-accepts a low-risk field at 0.90+ confidence", () => {
    expect(route({ proposed: "brand", confidence: 0.92 })).toBe("auto");
  });

  it("sends a low-risk field below 0.90 to review", () => {
    expect(route({ proposed: "brand", confidence: 0.85 })).toBe("review");
  });

  it("never auto-accepts a high-risk field, even at high confidence", () => {
    expect(route({ proposed: "price.value", confidence: 0.99 })).toBe("review");
  });

  it("sends anything below 0.60 to the fallback queue", () => {
    expect(route({ proposed: "brand", confidence: 0.5 })).toBe("fallback");
  });

  it("sends no-match proposals to the fallback queue", () => {
    expect(route({ proposed: null, confidence: 0.3 })).toBe("fallback");
  });

  it("sends a high-risk field between 0.60 and 0.89 to review", () => {
    expect(route({ proposed: "net_quantity", confidence: 0.75 })).toBe("review");
  });
});
