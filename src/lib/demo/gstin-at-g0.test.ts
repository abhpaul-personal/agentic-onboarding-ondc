import { describe, expect, it } from "vitest";
import { peekSellerIntakeCache } from "@/lib/agents/seller-intake";
import { verifySellerChecks } from "@/lib/agents/verification";
import { createReplayCacheStore } from "@/lib/cache";
import { defaultModelId } from "@/lib/llm/client";
import { gstinValid } from "@/lib/checks/gstin";
import { buildIntakeInput, intakePromptVersionFor, priorAttemptFrom } from "./intake-attempts";
import { loadRegistrationForm } from "./load-set-data";
import { SAMPLE_SETS } from "./sample-sets";

/**
 * These read the committed demo cache, exactly as a visitor's click does, and
 * run the real G0 checks on what comes back. They exist so a seller the
 * reviewer can never approve cannot be committed again: that happened when the
 * intake agent misread a GSTIN and the misread was cached for four sets.
 */
const store = createReplayCacheStore();
const model = defaultModelId();

const singleSellerSets = SAMPLE_SETS.filter((s) => !s.bulk);
const plantedSets = singleSellerSets.filter((s) => s.plantedIntakeMisread);
const cleanSets = singleSellerSets.filter((s) => !s.plantedIntakeMisread);

async function firstAttempt(setId: string) {
  const output = await peekSellerIntakeCache(
    store,
    model,
    buildIntakeInput(setId),
    intakePromptVersionFor(setId, 1),
  );
  return output;
}

describe("seller intake at G0, replayed from the committed cache", () => {
  it("has exactly one planted set, and it is set C", () => {
    expect(plantedSets.map((s) => s.id)).toEqual(["C"]);
  });

  for (const set of cleanSets) {
    it(`set ${set.id} (${set.title}): attempt 1 is warmed and passes every G0 check`, async () => {
      const output = await firstAttempt(set.id);
      expect(output, `no warmed seller-intake entry for set ${set.id}; run npm run agents:warm`).not.toBeNull();
      const failing = verifySellerChecks(output!.profile).filter((c) => !c.passed);
      expect(failing.map((c) => c.name)).toEqual([]);
    });

    it(`set ${set.id}: the GSTIN is the form's own valid 15-character value`, async () => {
      const output = await firstAttempt(set.id);
      const form = loadRegistrationForm(set.id);
      expect(output!.profile.gstin).toHaveLength(15);
      expect(gstinValid(output!.profile.gstin)).toBe(true);
      expect(output!.profile.gstin).toBe(form.gstin);
    });
  }

  it("set C: attempt 1 is the deliberate misread, failed by the real GSTIN checksum", async () => {
    const output = await firstAttempt("C");
    expect(output, "set C's first attempt must stay warmed").not.toBeNull();
    const gstin = output!.profile.gstin;
    expect(gstin).toHaveLength(16);
    expect(gstinValid(gstin)).toBe(false);
    const failing = verifySellerChecks(output!.profile)
      .filter((c) => !c.passed)
      .map((c) => c.name);
    expect(failing).toContain("GSTIN format and checksum");
  });

  it("set C: attempt 2 is warmed, replays a different run, and passes every G0 check", async () => {
    const first = await firstAttempt("C");
    const second = await peekSellerIntakeCache(
      store,
      model,
      buildIntakeInput("C", { attempt: 2, prior: priorAttemptFrom(first!.profile) }),
      intakePromptVersionFor("C", 2),
    );
    expect(second, "set C's retry (attempt 2) is not warmed; Send back would have nothing to replay").not.toBeNull();
    expect(second).not.toEqual(first);
    const failing = verifySellerChecks(second!.profile).filter((c) => !c.passed);
    expect(failing.map((c) => c.name)).toEqual([]);
    expect(second!.profile.gstin).toBe(loadRegistrationForm("C").gstin);
  });
});
