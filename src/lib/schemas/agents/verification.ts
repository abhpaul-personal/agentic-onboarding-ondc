import { z } from "zod";
import { sellerProfileSchema } from "@/lib/schemas/seller-profile";

/**
 * S2 verification agent. Format and checksum checks (GSTIN, PAN, IFSC,
 * FSSAI) run as real code in lib/checks/, not the model; this schema covers
 * only the one thing that is actually simulated here, mock ID verification
 * (name match against GST and bank records), since the project has no live
 * API for that.
 */
export const verificationInputSchema = z.object({
  profile: sellerProfileSchema,
});
export type VerificationInput = z.infer<typeof verificationInputSchema>;

export const nameMatchOutputSchema = z.object({
  matched: z.boolean(),
  reason: z.string().min(1),
});
export type NameMatchOutput = z.infer<typeof nameMatchOutputSchema>;
