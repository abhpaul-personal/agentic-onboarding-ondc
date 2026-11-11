import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { fieldMappingTruthSchema } from "./field-mapping";

const SETS = ["A", "B", "C", "F"] as const; // D and E are text/photo sources, no column mapping

describe("fieldMappingTruthSchema", () => {
  for (const set of SETS) {
    it(`parses set ${set}'s ground-truth field mapping`, () => {
      const path = join(
        process.cwd(),
        "data/sets",
        `set-${set}`,
        "ground_truth/field_mapping.json",
      );
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const result = fieldMappingTruthSchema.safeParse(raw);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(
        true,
      );
    });
  }
});
