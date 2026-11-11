import { z } from "zod";
import { columnProfileSchema, mappingProposalSchema } from "@/lib/schemas/field-mapping";

/** 4. Smart mapping agent: judges a candidate target for each profiled column. */
export const mappingAgentInputSchema = z.object({
  columns: z.array(columnProfileSchema),
});
export type MappingAgentInput = z.infer<typeof mappingAgentInputSchema>;

export const mappingAgentOutputSchema = z.object({
  proposals: z.array(mappingProposalSchema),
});
export type MappingAgentOutput = z.infer<typeof mappingAgentOutputSchema>;
