import type Anthropic from "@anthropic-ai/sdk";
import type { CacheStore } from "@/lib/cache";
import { computeColumnCacheKey, getOrCompute } from "@/lib/cache";
import { structuredCall } from "@/lib/llm/structured-call";
import type { ColumnProfile, MappingProposal } from "@/lib/schemas/field-mapping";
import { mappingModelOutputSchema } from "@/lib/schemas/agents/mapping";
import { targetRisk } from "@/lib/schemas/mapping-target";
import { mappingSystemPrompt, mappingUserPrompt, PROMPT_VERSION } from "@/lib/agents/prompts/mapping.v1";

export const MAPPING_SCHEMA_VERSION = 1;

export interface RunMappingAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  column: ColumnProfile;
}

export interface RunMappingAgentResult {
  proposal: MappingProposal;
  cached: boolean;
}

/**
 * Maps one source column to a target attribute. Cached at the column
 * level (header + top 5 sample values + schema version), so a new file
 * that repeats a column already seen anywhere needs no new model call.
 */
export async function runMappingAgent(
  params: RunMappingAgentParams,
): Promise<RunMappingAgentResult> {
  const key = computeColumnCacheKey({
    header: params.column.column,
    sampleValues: params.column.sample_values,
    schemaVersion: MAPPING_SCHEMA_VERSION,
  });

  const { output, cached } = await getOrCompute({
    store: params.store,
    key,
    step: "mapping",
    modelId: params.model,
    compute: async () => {
      const result = await structuredCall({
        client: params.client,
        model: params.model,
        system: mappingSystemPrompt(),
        content: mappingUserPrompt(params.column),
        outputSchema: mappingModelOutputSchema,
        toolName: "propose_mapping",
        toolDescription: "Propose which target attribute this source column maps to.",
      });
      return { output: result.output, tokenUsage: result.tokenUsage };
    },
  });

  return {
    proposal: {
      column: params.column.column,
      candidates: output.candidates,
      proposed: output.proposed,
      confidence: output.confidence,
      risk: targetRisk(output.proposed),
      reason: output.reason,
    },
    cached,
  };
}

export { PROMPT_VERSION as MAPPING_PROMPT_VERSION };

/**
 * Reads this column's cached mapping decision without ever calling the
 * model — the demo site's "replay only" mode (PRD: demo mode never calls
 * the model, even when a key is configured).
 */
export async function peekMappingCache(
  store: CacheStore,
  column: ColumnProfile,
): Promise<MappingProposal | null> {
  const key = computeColumnCacheKey({
    header: column.column,
    sampleValues: column.sample_values,
    schemaVersion: MAPPING_SCHEMA_VERSION,
  });
  const entry = await store.get<import("@/lib/schemas/agents/mapping").MappingModelOutput>(key);
  if (!entry) return null;
  const output = entry.output;
  return {
    column: column.column,
    candidates: output.candidates,
    proposed: output.proposed,
    confidence: output.confidence,
    risk: targetRisk(output.proposed),
    reason: output.reason,
  };
}
