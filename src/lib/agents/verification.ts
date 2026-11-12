import type { NameMatchOutput, VerificationInput } from "@/lib/schemas/agents/verification";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { SellerCheckResult } from "@/lib/orchestrator/seller-onboarding";
import { gstinStateCodeMatches, gstinValid } from "@/lib/checks/gstin";
import { panMatchesGstin, panValid } from "@/lib/checks/pan";
import { ifscValid } from "@/lib/checks/ifsc";
import { fssaiFormatValid, fssaiInDate } from "@/lib/checks/fssai";

/**
 * S2's "mock ID verification" (name match against GST and bank records).
 * The project has no live API for this, so it is simulated in code rather
 * than spending a model call on it — the real verification work (GSTIN,
 * PAN, IFSC, FSSAI checks) runs as deterministic code in lib/checks/.
 */
export function runNameMatch(input: VerificationInput): NameMatchOutput {
  return {
    matched: true,
    reason: `Simulated: legal name "${input.profile.business_name}" matches the GST record and bank account holder.`,
  };
}

/** FR-03: GSTIN, PAN, FSSAI and IFSC checks, run as real code against the seller profile. */
export function verifySellerChecks(profile: SellerProfile): SellerCheckResult[] {
  const checks: SellerCheckResult[] = [];
  checks.push({
    name: "GSTIN format and checksum",
    passed: gstinValid(profile.gstin),
    value: profile.gstin,
  });
  checks.push({
    name: "GSTIN state code matches state",
    passed: gstinStateCodeMatches(profile.gstin, profile.state),
    value: `${profile.gstin.slice(0, 2)} for ${profile.state}`,
  });
  if (profile.pan) {
    checks.push({
      name: "PAN format and match inside GSTIN",
      passed: panValid(profile.pan) && panMatchesGstin(profile.pan, profile.gstin),
      value: profile.pan,
    });
  }
  if (profile.category === "Grocery") {
    checks.push({
      name: "FSSAI licence format",
      passed: fssaiFormatValid(profile.fssai),
      value: profile.fssai,
    });
    checks.push({
      name: "FSSAI licence in date",
      passed: fssaiInDate(profile.fssai_expiry),
      value: `valid up to ${profile.fssai_expiry}`,
    });
  }
  checks.push({ name: "IFSC format", passed: ifscValid(profile.ifsc), value: profile.ifsc });
  return checks;
}
