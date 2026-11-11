import type { SellerProfile } from "@/lib/schemas/seller-profile";
import { appendAudit, type AuditLogEntry } from "./audit";
import { OrchestratorStateError } from "./errors";
import type { GateRecord } from "./types";
import type { SellerCheckResult } from "./seller-onboarding";

/**
 * Stage 1, bulk variant: the SNP onboards many sellers from one CSV (PRD
 * FR-01), e.g. a cooperative. One G0 decision covers the whole batch, per
 * row, rather than one seller at a time.
 */
export const BULK_SELLER_ONBOARDING_STEPS = ["s1", "s2", "g0", "done"] as const;
export type BulkSellerOnboardingStep = (typeof BULK_SELLER_ONBOARDING_STEPS)[number];

export interface BulkSellerRow {
  rowIndex: number;
  profile: SellerProfile;
  checks?: SellerCheckResult[];
  approved?: boolean;
}

export interface BulkSellerOnboardingState {
  runId: string;
  createdAt: string;
  updatedAt: string;
  step: BulkSellerOnboardingStep;
  rows: BulkSellerRow[];
  gate?: GateRecord;
  auditLog: AuditLogEntry[];
}

export function createBulkSellerOnboardingRun(runId: string): BulkSellerOnboardingState {
  const now = new Date().toISOString();
  return { runId, createdAt: now, updatedAt: now, step: "s1", rows: [], auditLog: [] };
}

function touch(
  state: BulkSellerOnboardingState,
  step: BulkSellerOnboardingStep,
): BulkSellerOnboardingState {
  return { ...state, step, updatedAt: new Date().toISOString() };
}

function assertStep(state: BulkSellerOnboardingState, expected: BulkSellerOnboardingStep) {
  if (state.step !== expected) {
    throw new OrchestratorStateError(
      `Expected bulk onboarding run ${state.runId} to be at "${expected}", but it is at "${state.step}".`,
    );
  }
}

/** S1: drafts one profile per row of the bulk CSV. */
export function completeBulkIntake(
  state: BulkSellerOnboardingState,
  profiles: SellerProfile[],
): BulkSellerOnboardingState {
  assertStep(state, "s1");
  const rows: BulkSellerRow[] = profiles.map((profile, index) => ({ rowIndex: index + 1, profile }));
  let next = touch({ ...state, rows }, "s2");
  next = appendAudit(next, "agent", `S1 drafted ${rows.length} seller profiles from the bulk CSV`);
  return next;
}

/** S2: deterministic checks per row (same checks as the single-seller flow). */
export function completeBulkVerification(
  state: BulkSellerOnboardingState,
  checksByRow: readonly SellerCheckResult[][],
): BulkSellerOnboardingState {
  assertStep(state, "s2");
  if (checksByRow.length !== state.rows.length) {
    throw new OrchestratorStateError(
      `Expected checks for ${state.rows.length} rows, got ${checksByRow.length}.`,
    );
  }
  const rows = state.rows.map((row, i) => ({ ...row, checks: checksByRow[i] }));
  let next = touch({ ...state, rows }, "g0");

  for (const row of rows) {
    const failed = row.checks!.filter((c) => !c.passed);
    if (failed.length) {
      next = appendAudit(
        next,
        "check",
        `Row ${row.rowIndex} (${row.profile.business_name}): ${failed.map((c) => c.name).join(", ")}`,
      );
    }
  }
  const totalChecks = rows.reduce((sum, r) => sum + (r.checks?.length ?? 0), 0);
  next = appendAudit(next, "check", `Verification ran ${totalChecks} real checks across ${rows.length} sellers`);
  return next;
}

/** G0: approves every clean row and sends every flagged row back, in one reviewer decision. */
export function approveBulkG0(
  state: BulkSellerOnboardingState,
  reasons: Readonly<Record<number, string>> = {},
): BulkSellerOnboardingState {
  assertStep(state, "g0");
  const rows = state.rows.map((row) => ({ ...row, approved: row.checks!.every((c) => c.passed) }));
  const approved = rows.filter((r) => r.approved);
  const sentBack = rows.filter((r) => !r.approved);

  let next = touch({ ...state, rows }, "done");
  next = appendAudit(next, "human", `G0: approved ${approved.length} sellers`);
  for (const row of sentBack) {
    const reason = reasons[row.rowIndex] ?? "a verification check failed";
    next = appendAudit(next, "human", `G0: sent row ${row.rowIndex} (${row.profile.business_name}) back to the seller: ${reason}`);
  }
  next.gate = {
    gate: "G0",
    outcome: `${approved.length} approved, ${sentBack.length} sent back`,
    at: new Date().toISOString(),
  };
  return next;
}
