import { describe, expect, it } from "vitest";
import { OrchestratorStateError } from "./errors";
import {
  approveSellerG0,
  completeSellerIntake,
  completeVerification,
  createSellerOnboardingRun,
  rejectSellerG0,
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

  it("rejecting G0 loops back to s1 and clears verification results", () => {
    const state = runThroughS2(false);
    const rejected = rejectSellerG0(state, "GSTIN does not match the state code");
    expect(rejected.step).toBe("s1");
    expect(rejected.checks).toBeUndefined();
    expect(rejected.auditLog.at(-1)?.text).toContain("sent back to seller");
  });

  it("refuses to act on the wrong step", () => {
    const state = createSellerOnboardingRun("run-1");
    expect(() => approveSellerG0(state)).toThrow(OrchestratorStateError);
  });
});
