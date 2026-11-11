import { z } from "zod";
import { registrationFormSchema, sellerProfileSchema } from "@/lib/schemas/seller-profile";

const documentImageSchema = z.object({
  data: z.string().min(1), // base64
  media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});

/** S1 seller intake agent: fills the profile from the form and the specimen document images. */
export const sellerIntakeInputSchema = z.object({
  registration_form: registrationFormSchema,
  documents: z.object({
    gst_certificate: documentImageSchema,
    fssai_licence: documentImageSchema.optional(), // Grocery only
    cancelled_cheque: documentImageSchema,
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
