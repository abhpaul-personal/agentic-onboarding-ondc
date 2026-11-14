import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { sellerIntakeCacheKey, sellerIntakePromptsFor } from "./seller-intake";
import { buildIntakeInput, intakePromptVersionFor, priorAttemptFrom } from "@/lib/demo/intake-attempts";
import { defaultModelId } from "@/lib/llm/client";
import type { SellerProfile } from "@/lib/schemas/seller-profile";

const model = defaultModelId();

// Set C's first attempt is a real run of the original prompt that is already
// committed. If these edits changed its key, the demo would stop replaying
// the one deliberate misread, so the file name is pinned here.
const SET_C_ATTEMPT_1_ENTRY = "2713fefe54f6aea390e8b4f926c6702759db6c91f61cc64fe33638e6dc2a3754";

const failingProfile: SellerProfile = {
  seller_id: "SLR-C",
  business_name: "Neelkurinji Threads",
  owner: "Test Owner",
  city: "Kochi",
  state: "Kerala",
  category: "Fashion",
  gstin: "32ZZZZPV0003C1ZV",
  pan: "ZZZPV0003C",
  fssai: "",
  fssai_expiry: "",
  ifsc: "DEMO0000003",
  account: "000000000103",
  packer_address: "Test address",
  returns: "7 days",
  time_to_ship: "P2D",
  own_brands: [],
};

describe("seller intake cache keys", () => {
  it("keeps set C's first attempt on its original cache entry", () => {
    const key = sellerIntakeCacheKey(buildIntakeInput("C"), model, intakePromptVersionFor("C", 1));
    expect(key).toBe(SET_C_ATTEMPT_1_ENTRY);
    expect(existsSync(join(process.cwd(), "data/cache", `${key}.json`))).toBe(true);
  });

  it("gives the retry its own entry, different from the attempt that failed", () => {
    const first = sellerIntakeCacheKey(buildIntakeInput("C"), model, intakePromptVersionFor("C", 1));
    const prior = priorAttemptFrom(failingProfile);
    const second = sellerIntakeCacheKey(
      buildIntakeInput("C", { attempt: 2, prior }),
      model,
      intakePromptVersionFor("C", 2),
    );
    expect(second).not.toBe(first);
  });

  it("changes the key when only the attempt number changes", () => {
    const prior = priorAttemptFrom(failingProfile);
    const two = sellerIntakeCacheKey(buildIntakeInput("C", { attempt: 2, prior }), model, 2);
    const three = sellerIntakeCacheKey(buildIntakeInput("C", { attempt: 3, prior }), model, 2);
    expect(three).not.toBe(two);
  });

  it("changes the key when the previous reading changes", () => {
    const a = sellerIntakeCacheKey(
      buildIntakeInput("C", { attempt: 2, prior: priorAttemptFrom(failingProfile) }),
      model,
      2,
    );
    const b = sellerIntakeCacheKey(
      buildIntakeInput("C", { attempt: 2, prior: priorAttemptFrom({ ...failingProfile, gstin: "32ZZZZZPV0003C1ZV" }) }),
      model,
      2,
    );
    expect(b).not.toBe(a);
  });

  it("keys the two prompt versions apart for the same input", () => {
    const input = buildIntakeInput("B");
    expect(sellerIntakeCacheKey(input, model, 1)).not.toBe(sellerIntakeCacheKey(input, model, 2));
  });
});

describe("intake prompt version per set and attempt", () => {
  it("pins only the planted set's first attempt to the original prompt", () => {
    expect(intakePromptVersionFor("C", 1)).toBe(1);
    expect(intakePromptVersionFor("C", 2)).toBe(2);
    for (const set of ["A", "B", "D", "E", "F"]) {
      expect(intakePromptVersionFor(set, 1)).toBe(2);
    }
  });
});

describe("what the intake agent is told", () => {
  const input = buildIntakeInput("B");

  it("v2 states the 15-character GSTIN rule and to keep a valid form value", () => {
    const { system } = sellerIntakePromptsFor(input, 2);
    expect(system).toContain("exactly 15 characters");
    expect(system).toMatch(/keep the form's GSTIN/);
    // v1's example encouraged "correcting" the form; v2 must not carry it.
    expect(system).not.toContain("form had a typo");
  });

  it("v1 is left exactly as it was", () => {
    const { system } = sellerIntakePromptsFor(input, 1);
    expect(system).toContain("form had a typo");
    expect(system).not.toContain("exactly 15 characters");
  });

  it("a first attempt carries no retry text", () => {
    const { user } = sellerIntakePromptsFor(input, 2);
    expect(user).not.toContain("attempt");
  });

  it("a retry tells the agent the previous reading and which checks it failed", () => {
    const retry = buildIntakeInput("C", { attempt: 2, prior: priorAttemptFrom(failingProfile) });
    const { user } = sellerIntakePromptsFor(retry, 2);
    expect(user).toContain("attempt 2");
    expect(user).toContain("32ZZZZPV0003C1ZV");
    expect(user).toContain("GSTIN format and checksum");
    expect(user).toContain("PAN format and match inside GSTIN");
  });
});

describe("priorAttemptFrom", () => {
  it("names the failing GSTIN and PAN checks and nothing that passed", () => {
    const prior = priorAttemptFrom(failingProfile);
    expect(prior.gstin).toBe("32ZZZZPV0003C1ZV");
    expect(prior.failed_checks).toEqual(["GSTIN format and checksum", "PAN format and match inside GSTIN"]);
  });
});
