import type Anthropic from "@anthropic-ai/sdk";
import type { CacheStore } from "@/lib/cache";
import { computeStepCacheKey, getOrCompute } from "@/lib/cache";
import { structuredCall } from "@/lib/llm/structured-call";
import {
  categoryInputSchema,
  categoryOutputSchema,
  type CategoryInput,
  type CategoryOutput,
} from "@/lib/schemas/agents/category";
import { categorySystemPrompt, categoryUserPrompt, PROMPT_VERSION } from "@/lib/agents/prompts/category.v1";

export const CATEGORY_SCHEMA_VERSION = 1;
export { PROMPT_VERSION as CATEGORY_PROMPT_VERSION };

export interface RunCategoryAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  input: CategoryInput;
}

export interface RunCategoryAgentResult {
  output: CategoryOutput;
  cached: boolean;
}

/** Classifies every item in one call, since they share the seller's catalog context. */
export async function runCategoryAgent(
  params: RunCategoryAgentParams,
): Promise<RunCategoryAgentResult> {
  const input = categoryInputSchema.parse(params.input);
  const key = computeStepCacheKey({
    step: "category",
    promptVersion: PROMPT_VERSION,
    schemaVersion: CATEGORY_SCHEMA_VERSION,
    modelId: params.model,
    input,
  });

  const { output, cached } = await getOrCompute({
    store: params.store,
    key,
    step: "category",
    modelId: params.model,
    compute: async () => {
      const result = await structuredCall({
        client: params.client,
        model: params.model,
        system: categorySystemPrompt(),
        content: categoryUserPrompt({
          items: input.items,
          allowedCategories: input.allowed_categories,
        }),
        outputSchema: categoryOutputSchema,
        toolName: "classify_items",
        toolDescription: "Assign each item to one of the allowed ONDC categories.",
      });
      return { output: result.output, tokenUsage: result.tokenUsage };
    },
  });

  return { output, cached };
}

/** Reads the cached category classification without ever calling the model (demo mode). */
export async function peekCategoryCache(
  store: CacheStore,
  model: string,
  input: CategoryInput,
): Promise<CategoryOutput | null> {
  const parsed = categoryInputSchema.parse(input);
  const key = computeStepCacheKey({
    step: "category",
    promptVersion: PROMPT_VERSION,
    schemaVersion: CATEGORY_SCHEMA_VERSION,
    modelId: model,
    input: parsed,
  });
  const entry = await store.get<CategoryOutput>(key);
  return entry ? entry.output : null;
}
