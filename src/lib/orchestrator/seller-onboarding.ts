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
export const SELLER_ONBOARDING_STEPS = ["s1", "s2", "g0", "approved"] as const;
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
  let next = touch({ ...state, profile: output.profile, intakeNotes: output.notes }, "s2");
  next = appendAudit(
    next,
    "agent",
    `S1 drafted the seller profile for ${output.profile.business_name}` +
      (output.notes.length ? ` (${output.notes.length} field${output.notes.length > 1 ? "s" : ""} from documents)` : ""),
  );
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

/** G0 reject: sends the seller back for corrections. Loops back to intake, not terminal. */
export function rejectSellerG0(state: SellerOnboardingState, reason: string): SellerOnboardingState {
  assertStep(state, "g0");
  let next = appendAudit(state, "human", `G0: sent back to seller for corrections: ${reason}`);
  next = touch(next, "s1");
  next.checks = undefined;
  next.nameMatch = undefined;
  return next;
}
