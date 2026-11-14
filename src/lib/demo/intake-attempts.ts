import { verifySellerChecks } from "@/lib/agents/verification";
import { SELLER_INTAKE_PROMPT_VERSION, type SellerIntakePromptVersion } from "@/lib/agents/seller-intake";
import type { SellerIntakeInput, SellerIntakePriorAttempt } from "@/lib/schemas/agents/seller-intake";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import { loadSellerIntakeInput } from "./load-set-data";
import { getSampleSet } from "./sample-sets";

/**
 * The one place that decides which intake prompt and input a given set and
 * attempt use. The demo's replay (actions.ts), agents:warm and the tests all
 * call these, so what a visitor's click looks up is always exactly what was
 * warmed.
 */

/**
 * The set flagged `plantedIntakeMisread` replays its first attempt from the
 * original prompt (the real misread the demo tells its story with). Every
 * other attempt uses the current prompt.
 */
export function intakePromptVersionFor(setId: string, attempt: number): SellerIntakePromptVersion {
  const planted = getSampleSet(setId)?.plantedIntakeMisread === true;
  return planted && attempt === 1 ? 1 : SELLER_INTAKE_PROMPT_VERSION;
}

/** What a Send back at G0 tells the next attempt: the GSTIN it produced and which checks it failed. */
export function priorAttemptFrom(profile: SellerProfile): SellerIntakePriorAttempt {
  return {
    gstin: profile.gstin,
    failed_checks: verifySellerChecks(profile)
      .filter((check) => !check.passed)
      .map((check) => check.name),
  };
}

/** Attempt 1 is the set's plain intake input; attempt 2 and up add the previous attempt's reading. */
export function buildIntakeInput(
  setId: string,
  retry?: { attempt: number; prior: SellerIntakePriorAttempt },
): SellerIntakeInput {
  const base = loadSellerIntakeInput(setId);
  if (!retry) return base;
  return { ...base, attempt: retry.attempt, prior_attempt: retry.prior };
}
