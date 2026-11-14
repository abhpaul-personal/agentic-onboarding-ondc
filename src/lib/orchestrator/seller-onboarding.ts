import type { SellerIntakePriorAttempt } from "@/lib/schemas/agents/seller-intake";
import type { NameMatchOutput } from "@/lib/schemas/agents/verification";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import { appendAudit, type AuditLogEntry } from "./audit";
import { OrchestratorStateError } from "./errors";
import type { GateRecord } from "./types";

/**
 * Stage 1: onboards one seller, once. The orchestrator is a state machine
 * that can pause at any gate and resume — these are pure transition
 * functions over a plain state object, so pausing is just "don't call the
 * next transition yet" and resuming is "load the state and call it".
 */
export const SELLER_ONBOARDING_STEPS = ["s1", "s2", "g0", "correct", "approved"] as const;
export type SellerOnboardingStep = (typeof SELLER_ONBOARDING_STEPS)[number];

export interface SellerCheckResult {
  name: string;
  passed: boolean;
  value: string;
}

export interface SellerOnboardingState {
  runId: string;
  createdAt: string;
  updatedAt: string;
  step: SellerOnboardingStep;
  profile?: SellerProfile;
  intakeNotes?: string[];
  checks?: SellerCheckResult[];
  nameMatch?: NameMatchOutput;
  gate?: GateRecord;
  /** Which seller-intake attempt the run is on. Absent means the first; Send back at G0 makes it 2, then 3. */
  intakeAttempt?: number;
  /** What the previous attempt produced and failed, handed to the next attempt. Set by Send back. */
  priorAttempt?: SellerIntakePriorAttempt;
  auditLog: AuditLogEntry[];
}

export function createSellerOnboardingRun(runId: string): SellerOnboardingState {
  const now = new Date().toISOString();
  return { runId, createdAt: now, updatedAt: now, step: "s1", auditLog: [] };
}

function touch(state: SellerOnboardingState, step: SellerOnboardingStep): SellerOnboardingState {
  return { ...state, step, updatedAt: new Date().toISOString() };
}

function assertStep(state: SellerOnboardingState, expected: SellerOnboardingStep) {
  if (state.step !== expected) {
    throw new OrchestratorStateError(
      `Expected seller onboarding run ${state.runId} to be at "${expected}", but it is at "${state.step}".`,
    );
  }
}

/** S1: the seller intake agent's output becomes the draft profile. */
export function completeSellerIntake(
  state: SellerOnboardingState,
  output: { profile: SellerProfile; notes: string[] },
): SellerOnboardingState {
  assertStep(state, "s1");
  const attempt = state.intakeAttempt ?? 1;
  let next = touch({ ...state, profile: output.profile, intakeNotes: output.notes }, "s2");
  next = appendAudit(
    next,
    "agent",
    `S1${attempt > 1 ? ` (attempt ${attempt})` : ""} drafted the seller profile for ${output.profile.business_name}` +
      (output.notes.length ? ` (${output.notes.length} field${output.notes.length > 1 ? "s" : ""} from documents)` : ""),
  );
  if (attempt > 1) {
    // A retry's notes are the point of the retry (what changed from the attempt
    // that was sent back), so they go in the log in full.
    for (const note of output.notes) next = appendAudit(next, "agent", `S1 note: ${note}`);
  }
  return next;
}

/** S2: deterministic checks (lib/checks/) plus the simulated name match. */
export function completeVerification(
  state: SellerOnboardingState,
  result: { checks: SellerCheckResult[]; nameMatch: NameMatchOutput },
): SellerOnboardingState {
  assertStep(state, "s2");
  let next = touch({ ...state, checks: result.checks, nameMatch: result.nameMatch }, "g0");
  for (const check of result.checks) {
    next = appendAudit(next, "check", `${check.name}: ${check.passed ? "pass" : "fail"} (${check.value})`);
  }
  next = appendAudit(next, "agent", result.nameMatch.reason);
  return next;
}

/** G0: the SNP reviewer approves the seller. Always required, once per seller. */
export function approveSellerG0(state: SellerOnboardingState): SellerOnboardingState {
  assertStep(state, "g0");
  if (!state.checks?.length || !state.checks.every((c) => c.passed)) {
    throw new OrchestratorStateError(
      `Cannot approve G0 for run ${state.runId}: not every verification check passed.`,
    );
  }
  let next = touch(state, "approved");
  next = appendAudit(next, "human", "G0: SNP reviewer approved the seller profile");
  next.gate = { gate: "G0", outcome: "Seller approved", at: new Date().toISOString() };
  return next;
}

/**
 * G0 reject, route 1 of 2: sends the seller back for corrections. Not
 * terminal — goes to "correct". Used when no retry attempt has been warmed
 * for this seller: re-running seller intake would replay the exact same
 * cached (and possibly wrong) output, so the seller corrects the flagged
 * field directly instead. Keeps the failing checks on state so the
 * correction step can show what was wrong. When a retry attempt exists,
 * sendBackForRetry is used instead.
 */
export function rejectSellerG0(state: SellerOnboardingState, reason: string): SellerOnboardingState {
  assertStep(state, "g0");
  const next = appendAudit(state, "human", `G0: sent back to seller for corrections: ${reason}`);
  return touch(next, "correct");
}

/**
 * G0 reject, route 2 of 2: sends the run back to seller intake for another
 * attempt. Each attempt is its own cache entry (the attempt number and the
 * previous reading are part of the agent's input), so unlike a plain re-run
 * this replays a different, real model output than the one that failed. The
 * failed attempt's audit entries stay above; the next attempt appends below.
 */
export function sendBackForRetry(
  state: SellerOnboardingState,
  reason: string,
  next: { attempt: number; prior: SellerIntakePriorAttempt },
): SellerOnboardingState {
  assertStep(state, "g0");
  const log = appendAudit(
    state,
    "human",
    `G0: sent back to seller intake for attempt ${next.attempt}: ${reason}`,
  );
  return touch(
    { ...log, intakeAttempt: next.attempt, priorAttempt: next.prior, checks: undefined, nameMatch: undefined },
    "s1",
  );
}

/**
 * The seller corrects one or more profile fields a failing check flagged
 * (e.g. a GSTIN the seller-intake agent misread from the certificate
 * image), the real checks run again on the corrected profile, and the run
 * returns to G0. The original misread and its check failures stay in the
 * audit log above this entry — never edited, only superseded.
 */
export function submitSellerCorrection(
  state: SellerOnboardingState,
  corrections: Readonly<Record<string, string>>,
  result: { checks: SellerCheckResult[]; nameMatch: NameMatchOutput },
): SellerOnboardingState {
  assertStep(state, "correct");
  if (!state.profile) {
    throw new OrchestratorStateError(`No profile to correct for run ${state.runId}.`);
  }
  const profile = { ...state.profile, ...corrections };
  let next = touch({ ...state, profile, checks: result.checks, nameMatch: result.nameMatch }, "g0");
  for (const [field, value] of Object.entries(corrections)) {
    next = appendAudit(next, "human", `Seller corrected ${field} to "${value}"`);
  }
  for (const check of result.checks) {
    next = appendAudit(next, "check", `${check.name}: ${check.passed ? "pass" : "fail"} (${check.value})`);
  }
  return next;
}
