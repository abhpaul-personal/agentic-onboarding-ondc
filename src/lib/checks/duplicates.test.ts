import { describe, expect, it } from "vitest";
import { findDuplicateSkus } from "./duplicates";

describe("findDuplicateSkus", () => {
  it("returns nothing when every id is unique", () => {
    expect(findDuplicateSkus(["TRP-001", "TRP-002", "TRP-003"])).toEqual([]);
  });

  it("finds set F's two planted duplicate SKUs", () => {
    const ids = ["TRP-009", "TRP-021", "TRP-030", "TRP-009", "TRP-021"];
    expect(findDuplicateSkus(ids).sort()).toEqual(["TRP-009", "TRP-021"]);
  });

  it("reports a repeated id only once", () => {
    expect(findDuplicateSkus(["A", "A", "A"])).toEqual(["A"]);
  });
});
