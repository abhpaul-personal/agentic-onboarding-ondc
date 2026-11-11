import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ondcCatalogSchema } from "./ondc-item";

const SETS = ["A", "B", "C", "D", "E", "F"] as const;

describe("ondcCatalogSchema", () => {
  for (const set of SETS) {
    it(`parses set ${set}'s golden catalog`, () => {
      const path = join(
        process.cwd(),
        "data/sets",
        `set-${set}`,
        "ground_truth/golden_catalog.json",
      );
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const result = ondcCatalogSchema.safeParse(raw);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(
        true,
      );
    });
  }
});
