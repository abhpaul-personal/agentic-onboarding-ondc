import { describe, expect, it } from "vitest";
import { OrchestratorStateError } from "./errors";
import {
  approveSellerG0,
  completeSellerIntake,
  completeVerification,
  createSellerOnboardingRun,
  rejectSellerG0,
  sendBackForRetry,
  submitSellerCorrection,
} from "./seller-onboarding";
import type { SellerProfile } from "@/lib/schemas/seller-profile";

const profile: SellerProfile = {
  seller_id: "SLR-A",
  business_name: "Tilwari Masala Ghar",
  owner: "Meena Tilwari",
  city: "Nashik",
  state: "Maharashtra",
  category: "Grocery",
  gstin: "27ZZZPT0001A1ZU",
  pan: "ZZZPT0001A",
  fssai: "20000000000001",
  fssai_expiry: "2028-03-31",
  ifsc: "DEMO0000001",
  account: "000000000101",
  packer_address: "Plot 4, Demo Industrial Lane, Nashik 422000",
  returns: "Not returnable (food)",
  time_to_ship: "P1D",
  own_brands: ["Tilwari"],
};

function runThroughS2(passing: boolean) {
  let state = createSellerOnboardingRun("run-1");
  state = completeSellerIntake(state, { profile, notes: [] });
  state = completeVerification(state, {
    checks: [{ name: "GSTIN format and checksum", passed: true, value: profile.gstin }, { name: "IFSC format", passed: passing, value: profile.ifsc }],
    nameMatch: { matched: true, reason: "Simulated: name matches." },
  });
  return state;
}

describe("seller onboarding state machine", () => {
  it("moves s1 -> s2 -> g0 on the happy path", () => {
    let state = createSellerOnboardingRun("run-1");
    expect(state.step).toBe("s1");
    state = completeSellerIntake(state, { profile, notes: [] });
    expect(state.step).toBe("s2");
    state = completeVerification(state, {
      checks: [{ name: "GSTIN format and checksum", passed: true, value: profile.gstin }],
      nameMatch: { matched: true, reason: "Simulated: name matches." },
    });
    expect(state.step).toBe("g0");
  });

  it("refuses to approve G0 when a check failed", () => {
    const state = runThroughS2(false);
    expect(() => approveSellerG0(state)).toThrow(OrchestratorStateError);
  });

  it("approves G0 and records the gate when every check passed", () => {
    const state = runThroughS2(true);
    const approved = approveSellerG0(state);
    expect(approved.step).toBe("approved");
    expect(approved.gate).toEqual({ gate: "G0", outcome: "Seller approved", at: approved.gate!.at });
    expect(approved.auditLog.some((e) => e.kind === "human")).toBe(true);
  });

  it("rejecting G0 goes to correct, not s1, and keeps the failing checks visible", () => {
    // Re-running seller intake in demo mode would just replay the exact same
    // cached (possibly wrong) output again, so a reject must not loop back
    // to s1: it needs a step where the seller can actually fix the value.
    const state = runThroughS2(false);
    const rejected = rejectSellerG0(state, "IFSC format invalid");
    expect(rejected.step).toBe("correct");
    expect(rejected.checks).toEqual(state.checks);
    expect(rejected.auditLog.at(-1)?.text).toContain("sent back to seller");
  });

  it("submitting a correction applies it, re-runs checks, and returns to g0", () => {
    const rejected = rejectSellerG0(runThroughS2(false), "IFSC format invalid");
    const corrected = submitSellerCorrection(
      rejected,
      { ifsc: "DEMO0000009" },
      {
        checks: [
          { name: "GSTIN format and checksum", passed: true, value: profile.gstin },
          { name: "IFSC format", passed: true, value: "DEMO0000009" },
        ],
        nameMatch: { matched: true, reason: "Simulated: name matches." },
      },
    );
    expect(corrected.step).toBe("g0");
    expect(corrected.profile?.ifsc).toBe("DEMO0000009");
    expect(corrected.checks?.every((c) => c.passed)).toBe(true);
    // The original (wrong) reading and its failure stay in the audit log —
    // never edited, only superseded by later entries.
    expect(corrected.auditLog.some((e) => e.text.includes("IFSC format: fail"))).toBe(true);
    expect(corrected.auditLog.some((e) => e.text.includes('corrected ifsc to "DEMO0000009"'))).toBe(true);
  });

  describe("sending back for another intake attempt", () => {
    const prior = { gstin: profile.gstin, failed_checks: ["IFSC format"] };

    it("goes back to s1 on the next attempt, carrying the previous reading", () => {
      const state = runThroughS2(false);
      const sent = sendBackForRetry(state, "IFSC format invalid", { attempt: 2, prior });
      expect(sent.step).toBe("s1");
      expect(sent.intakeAttempt).toBe(2);
      expect(sent.priorAttempt).toEqual(prior);
      // The failed checks belong to the attempt that was sent back, not the next one.
      expect(sent.checks).toBeUndefined();
      expect(sent.auditLog.at(-1)?.text).toContain("attempt 2");
      // What the first attempt did stays in the log above, never edited.
      expect(sent.auditLog.some((e) => e.text.includes("IFSC format: fail"))).toBe(true);
    });

    it("labels the retry's S1 line with its attempt and logs the agent's notes in full", () => {
      const sent = sendBackForRetry(runThroughS2(false), "IFSC format invalid", { attempt: 2, prior });
      const next = completeSellerIntake(sent, { profile, notes: ["Kept the form's value, certificate misread."] });
      expect(next.step).toBe("s2");
      const log = next.auditLog.map((e) => e.text);
      expect(log.some((t) => t.startsWith("S1 (attempt 2) drafted the seller profile"))).toBe(true);
      expect(log).toContain("S1 note: Kept the form's value, certificate misread.");
    });

    it("does not mention attempts on a first intake", () => {
      const state = completeSellerIntake(createSellerOnboardingRun("run-1"), { profile, notes: ["a note"] });
      const log = state.auditLog.map((e) => e.text).join("\n");
      expect(log).toContain("S1 drafted the seller profile");
      expect(log).not.toContain("attempt");
      expect(log).not.toContain("S1 note:");
    });

    it("lets the reviewer approve once the retry passes every check", () => {
      let state = sendBackForRetry(runThroughS2(false), "IFSC format invalid", { attempt: 2, prior });
      state = completeSellerIntake(state, { profile, notes: [] });
      state = completeVerification(state, {
        checks: [{ name: "IFSC format", passed: true, value: profile.ifsc }],
        nameMatch: { matched: true, reason: "Simulated: name matches." },
      });
      expect(state.step).toBe("g0");
      expect(approveSellerG0(state).step).toBe("approved");
    });

    it("refuses to send back outside g0", () => {
      expect(() =>
        sendBackForRetry(createSellerOnboardingRun("run-1"), "x", { attempt: 2, prior }),
      ).toThrow(OrchestratorStateError);
    });
  });

  it("refuses to submit a correction outside the correct step", () => {
    const state = runThroughS2(true);
    expect(() =>
      submitSellerCorrection(state, { ifsc: "x" }, { checks: [], nameMatch: { matched: true, reason: "x" } }),
    ).toThrow(OrchestratorStateError);
  });

  it("refuses to act on the wrong step", () => {
    const state = createSellerOnboardingRun("run-1");
    expect(() => approveSellerG0(state)).toThrow(OrchestratorStateError);
  });
});
