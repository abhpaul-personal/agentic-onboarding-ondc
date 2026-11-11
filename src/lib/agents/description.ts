import type Anthropic from "@anthropic-ai/sdk";
import type { CacheStore } from "@/lib/cache";
import { computeStepCacheKey, getOrCompute } from "@/lib/cache";
import { structuredCall } from "@/lib/llm/structured-call";
import { findUnsupportedClaim } from "@/lib/checks/claims";
import {
  descriptionInputSchema,
  descriptionOutputSchema,
  type DescriptionInput,
  type DescriptionOutput,
} from "@/lib/schemas/agents/description";
import {
  descriptionSystemPrompt,
  descriptionUserPrompt,
  PROMPT_VERSION,
} from "@/lib/agents/prompts/description.v1";

export const DESCRIPTION_SCHEMA_VERSION = 1;
export { PROMPT_VERSION as DESCRIPTION_PROMPT_VERSION };

/** Thrown when the model's description makes a claim none of the source facts support. */
export class UnsupportedClaimError extends Error {
  constructor(public readonly claim: string) {
    super(`Generated description makes an unsupported claim: "${claim}"`);
    this.name = "UnsupportedClaimError";
  }
}

export interface RunDescriptionAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  input: DescriptionInput;
}

export interface RunDescriptionAgentResult {
  output: DescriptionOutput;
  cached: boolean;
}

/**
 * Generates a short catalog description that may only restate the given
 * source facts. The no-invention guardrail is enforced here, not just by
 * prompt: a claim with no matching source fact throws rather than caching.
 */
export async function runDescriptionAgent(
  params: RunDescriptionAgentParams,
): Promise<RunDescriptionAgentResult> {
  const input = descriptionInputSchema.parse(params.input);
  const key = computeStepCacheKey({
    step: "description",
    promptVersion: PROMPT_VERSION,
    schemaVersion: DESCRIPTION_SCHEMA_VERSION,
    modelId: params.model,
    input,
  });

  const { output, cached } = await getOrCompute({
    store: params.store,
    key,
    step: "description",
    modelId: params.model,
    compute: async () => {
      const result = await structuredCall({
        client: params.client,
        model: params.model,
        system: descriptionSystemPrompt(),
        content: descriptionUserPrompt({ itemName: input.item_name, sourceFacts: input.source_facts }),
        outputSchema: descriptionOutputSchema,
        toolName: "write_description",
        toolDescription: "Write the short, source-grounded catalog description.",
      });
      const claim = findUnsupportedClaim(result.output.short_desc);
      const hasSourceSupport = (c: string) =>
        input.source_facts.some((fact) => findUnsupportedClaim(fact)?.toLowerCase() === c.toLowerCase());
      if (claim && !hasSourceSupport(claim)) {
        throw new UnsupportedClaimError(claim);
      }
      return { output: result.output, tokenUsage: result.tokenUsage };
    },
  });

  return { output, cached };
}
