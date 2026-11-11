import { z } from "zod";

/** 3. Category agent: classifies each item into an ONDC Grocery or Fashion category. */
export const categoryInputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  ),
  allowed_categories: z.array(z.string()).min(1),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryProposalSchema = z.object({
  item_id: z.string().min(1),
  category_id: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type CategoryProposal = z.infer<typeof categoryProposalSchema>;

export const categoryOutputSchema = z.object({
  proposals: z.array(categoryProposalSchema),
});
export type CategoryOutput = z.infer<typeof categoryOutputSchema>;
