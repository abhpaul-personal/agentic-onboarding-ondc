import { z } from "zod";
import { mappingTargetKeySchema, riskClassSchema } from "@/lib/schemas/mapping-target";
import { ROUTES } from "@/lib/routing";

/** A source column as the eval kit's ground_truth/field_mapping.json gives it. */
export const fieldMappingTruthSchema = z.record(z.string(), mappingTargetKeySchema);
export type FieldMappingTruth = z.infer<typeof fieldMappingTruthSchema>;

export const routeSchema = z.enum(ROUTES);

/**
 * One run's decision for a column, in the shape score.py expects:
 * { "decisions": { "<source column>": { "target": "<attr>", "route": "auto|review|fallback" } } }
 */
export const mappingDecisionSchema = z.object({
  target: mappingTargetKeySchema.nullable(),
  route: routeSchema,
});
export type MappingDecision = z.infer<typeof mappingDecisionSchema>;

export const mappingRunSchema = z.object({
  decisions: z.record(z.string(), mappingDecisionSchema),
});
export type MappingRun = z.infer<typeof mappingRunSchema>;

/** One of the mapping agent's top candidates for a column, before routing. */
export const mappingCandidateSchema = z.object({
  target: mappingTargetKeySchema.nullable(),
  confidence: z.number().min(0).max(1),
});
export type MappingCandidate = z.infer<typeof mappingCandidateSchema>;

/** Column profile the agent reasons over: no raw PII beyond what the seller already gave. */
export const columnProfileSchema = z.object({
  column: z.string().min(1),
  fill_rate: z.number().min(0).max(1),
  distinct_count: z.number().int().nonnegative(),
  sample_values: z.array(z.string()).max(5),
});
export type ColumnProfile = z.infer<typeof columnProfileSchema>;

/** The mapping agent's proposal for one column, before routing is applied. */
export const mappingProposalSchema = z.object({
  column: z.string().min(1),
  candidates: z.array(mappingCandidateSchema).max(3),
  proposed: mappingTargetKeySchema.nullable(),
  confidence: z.number().min(0).max(1),
  risk: riskClassSchema,
  // Must quote at least one sample value (PRD "Judge" step); checked by the caller, not the schema.
  reason: z.string().min(1),
});
export type MappingProposal = z.infer<typeof mappingProposalSchema>;
