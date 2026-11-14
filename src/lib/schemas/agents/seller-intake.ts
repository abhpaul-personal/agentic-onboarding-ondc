import { z } from "zod";
import { registrationFormSchema, sellerProfileSchema } from "@/lib/schemas/seller-profile";

const documentImageSchema = z.object({
  data: z.string().min(1), // base64
  media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});

/**
 * What the reviewer's Send back at G0 hands to the next attempt: the GSTIN the
 * previous attempt produced and the names of the checks it failed.
 */
export const sellerIntakePriorAttemptSchema = z.object({
  gstin: z.string(),
  failed_checks: z.array(z.string()),
});
export type SellerIntakePriorAttempt = z.infer<typeof sellerIntakePriorAttemptSchema>;

/**
 * S1 seller intake agent: fills the profile from the form and the specimen document images.
 *
 * `attempt` and `prior_attempt` are only present on a retry after Send back at
 * G0 (attempt 2 and up). They are left out of a first attempt entirely, so a
 * first attempt's cache key is the same as it was before retries existed.
 */
export const sellerIntakeInputSchema = z.object({
  registration_form: registrationFormSchema,
  documents: z.object({
    gst_certificate: documentImageSchema,
    fssai_licence: documentImageSchema.optional(), // Grocery only
    cancelled_cheque: documentImageSchema,
  }),
  attempt: z.number().int().min(2).optional(),
  prior_attempt: sellerIntakePriorAttemptSchema.optional(),
});
export type SellerIntakeInput = z.infer<typeof sellerIntakeInputSchema>;

export const sellerIntakeOutputSchema = z.object({
  profile: sellerProfileSchema,
  // One line per field the agent filled from a document rather than the form,
  // so a later guardrail test can trace every value back to the input.
  notes: z.array(z.string()).default([]),
});
export type SellerIntakeOutput = z.infer<typeof sellerIntakeOutputSchema>;
