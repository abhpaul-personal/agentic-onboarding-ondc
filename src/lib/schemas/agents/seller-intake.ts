import { z } from "zod";
import { registrationFormSchema, sellerProfileSchema } from "@/lib/schemas/seller-profile";

/** S1 seller intake agent: fills the profile from the form and OCR'd documents. */
export const sellerIntakeInputSchema = z.object({
  registration_form: registrationFormSchema,
  documents: z.object({
    gst_certificate_text: z.string().optional(),
    fssai_licence_text: z.string().optional(),
    cancelled_cheque_text: z.string().optional(),
  }),
});
export type SellerIntakeInput = z.infer<typeof sellerIntakeInputSchema>;

export const sellerIntakeOutputSchema = z.object({
  profile: sellerProfileSchema,
  // One line per field the agent filled from a document rather than the form,
  // so a later guardrail test can trace every value back to the input.
  notes: z.array(z.string()).default([]),
});
export type SellerIntakeOutput = z.infer<typeof sellerIntakeOutputSchema>;
