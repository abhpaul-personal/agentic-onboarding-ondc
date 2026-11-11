import { z } from "zod";

/**
 * Catalog builder's description step. Guardrail: generated descriptions may
 * only restate facts present in source_facts; claims like "organic" or
 * "handmade" need a source fact behind them (checked by
 * lib/checks/claims.ts, not by this schema).
 */
export const descriptionInputSchema = z.object({
  item_name: z.string().min(1),
  source_facts: z.array(z.string()).min(1),
});
export type DescriptionInput = z.infer<typeof descriptionInputSchema>;

export const descriptionOutputSchema = z.object({
  short_desc: z.string().min(1),
});
export type DescriptionOutput = z.infer<typeof descriptionOutputSchema>;
