import { describe, expect, it } from "vitest";
import { profileColumns } from "./profile-columns";

describe("profileColumns", () => {
  it("returns nothing for an empty table", () => {
    expect(profileColumns([])).toEqual([]);
  });

  it("computes fill rate, distinct count and up to 5 samples", () => {
    const records = [
      { Brand: "Tilwari", Rate: "90" },
      { Brand: "Tilwari", Rate: "180" },
      { Brand: "", Rate: "105" },
    ];
    const [brand, rate] = profileColumns(records);

    expect(brand.column).toBe("Brand");
    expect(brand.fill_rate).toBeCloseTo(2 / 3);
    expect(brand.distinct_count).toBe(1);
    expect(brand.sample_values).toEqual(["Tilwari"]);

    expect(rate.fill_rate).toBe(1);
    expect(rate.distinct_count).toBe(3);
    expect(rate.sample_values).toEqual(["90", "180", "105"]);
  });

  it("caps sample values at 5 even with more distinct values", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({ col: String(i) }));
    expect(profileColumns(records)[0].sample_values).toHaveLength(5);
  });
});
