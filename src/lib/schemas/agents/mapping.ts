import { z } from "zod";
import { columnProfileSchema, mappingCandidateSchema } from "@/lib/schemas/field-mapping";
import { mappingTargetKeySchema } from "@/lib/schemas/mapping-target";

/**
 * 4. Smart mapping agent, run once per column (not batched) so the
 * column-level cache can reuse a decision across files and sellers that
 * repeat a known header. `risk` and the routed decision are computed from
 * `proposed` afterward (lib/routing.ts), not asked of the model.
 */
export const mappingAgentInputSchema = columnProfileSchema;
export type MappingAgentInput = z.infer<typeof mappingAgentInputSchema>;

export const mappingModelOutputSchema = z.object({
  candidates: z.array(mappingCandidateSchema).max(3),
  proposed: mappingTargetKeySchema.nullable(),
  confidence: z.number().min(0).max(1),
  // Must quote at least one sample value (PRD "Judge" step); checked by the caller, not the schema.
  reason: z.string().min(1),
});
export type MappingModelOutput = z.infer<typeof mappingModelOutputSchema>;
