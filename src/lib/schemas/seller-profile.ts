import { z } from "zod";

/**
 * Stage 1 output: the seller profile approved at G0. Field names match the
 * eval kit's registration_form.json and the demo's DATA.sellers records.
 */
export const sellerCategorySchema = z.enum(["Grocery", "Fashion"]);
export type SellerCategory = z.infer<typeof sellerCategorySchema>;

export const sellerProfileSchema = z.object({
  seller_id: z.string().min(1),
  business_name: z.string().min(1),
  owner: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  category: sellerCategorySchema,
  gstin: z.string(),
  pan: z.string(),
  // FSSAI is required for Grocery, not applicable for Fashion.
  fssai: z.string().optional().default(""),
  fssai_expiry: z.string().optional().default(""), // ISO date "YYYY-MM-DD"
  ifsc: z.string(),
  account: z.string(),
  packer_address: z.string().min(1),
  returns: z.string().min(1),
  time_to_ship: z.string().min(1), // ISO 8601 duration
});
export type SellerProfile = z.infer<typeof sellerProfileSchema>;

/** The registration form the seller fills before document OCR cross-fill. */
export const registrationFormSchema = sellerProfileSchema
  .omit({ seller_id: true })
  .extend({
    seller_id: z.string().min(1).optional(),
  });
export type RegistrationForm = z.infer<typeof registrationFormSchema>;
