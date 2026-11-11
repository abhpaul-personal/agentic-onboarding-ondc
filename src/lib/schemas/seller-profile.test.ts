import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { registrationFormSchema } from "./seller-profile";

const SETS = ["A", "B", "C", "D", "E", "F"] as const;

describe("registrationFormSchema", () => {
  for (const set of SETS) {
    it(`parses set ${set}'s registration form`, () => {
      const path = join(
        process.cwd(),
        "data/sets",
        `set-${set}`,
        "seller_pack/registration_form.json",
      );
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const result = registrationFormSchema.safeParse(raw);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(
        true,
      );
    });
  }
});
