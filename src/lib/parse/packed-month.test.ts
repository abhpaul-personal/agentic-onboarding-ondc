import { describe, expect, it } from "vitest";
import { PACKED_MONTH_CANONICAL_PATTERN, parsePackedMonth } from "./packed-month";

describe("parsePackedMonth", () => {
  it('parses "Oct-26"', () => {
    expect(parsePackedMonth("Oct-26")).toBe("10/2026");
  });

  it('parses "10/2026" (already canonical)', () => {
    expect(parsePackedMonth("10/2026")).toBe("10/2026");
  });

  it('parses "Sept 2026"', () => {
    expect(parsePackedMonth("Sept 2026")).toBe("09/2026");
  });

  it('parses "09-2026"', () => {
    expect(parsePackedMonth("09-2026")).toBe("09/2026");
  });

  it("returns null for an out-of-range month", () => {
    expect(parsePackedMonth("13/2026")).toBeNull();
  });

  it("returns null for an unrecognised month name", () => {
    expect(parsePackedMonth("Xyz-26")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parsePackedMonth("")).toBeNull();
    expect(parsePackedMonth("whenever")).toBeNull();
  });

  it("every successful parse matches the canonical pattern used by validateItems", () => {
    for (const raw of ["Oct-26", "10/2026", "Sept 2026", "09-2026"]) {
      const result = parsePackedMonth(raw);
      expect(result).not.toBeNull();
      expect(PACKED_MONTH_CANONICAL_PATTERN.test(result!)).toBe(true);
    }
  });
});
