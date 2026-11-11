import type { NameMatchOutput, VerificationInput } from "@/lib/schemas/agents/verification";

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
