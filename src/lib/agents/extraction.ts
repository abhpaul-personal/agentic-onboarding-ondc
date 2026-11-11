import type Anthropic from "@anthropic-ai/sdk";
import type { CacheStore } from "@/lib/cache";
import { computeStepCacheKey, getOrCompute } from "@/lib/cache";
import { structuredCall } from "@/lib/llm/structured-call";
import {
  extractionInputSchema,
  extractionOutputSchema,
  type ExtractionInput,
  type ExtractionOutput,
} from "@/lib/schemas/agents/extraction";
import {
  extractionPhotoUserPrompt,
  extractionSystemPrompt,
  extractionTextUserPrompt,
  PROMPT_VERSION,
} from "@/lib/agents/prompts/extraction.v1";

export const EXTRACTION_SCHEMA_VERSION = 1;
export { PROMPT_VERSION as EXTRACTION_PROMPT_VERSION };

export interface RunExtractionAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  input: ExtractionInput;
}

export interface RunExtractionAgentResult {
  output: ExtractionOutput;
  cached: boolean;
}

/** Reads a WhatsApp chat or a price-list photo into draft items (G1 then confirms them). */
export async function runExtractionAgent(
  params: RunExtractionAgentParams,
): Promise<RunExtractionAgentResult> {
  const input = extractionInputSchema.parse(params.input);
  const key = computeStepCacheKey({
    step: "extraction",
    promptVersion: PROMPT_VERSION,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    modelId: params.model,
    input,
  });

  const content: Anthropic.MessageParam["content"] =
    input.source_format === "whatsapp_text"
      ? extractionTextUserPrompt(input.raw_text)
      : [
          { type: "image", source: { type: "base64", ...input.image } },
          { type: "text", text: extractionPhotoUserPrompt() },
        ];

  const { output, cached } = await getOrCompute({
    store: params.store,
    key,
    step: "extraction",
    modelId: params.model,
    compute: async () => {
      const result = await structuredCall({
        client: params.client,
        model: params.model,
        system: extractionSystemPrompt(),
        content,
        outputSchema: extractionOutputSchema,
        toolName: "extract_items",
        toolDescription: "Extract every catalog item from the source.",
      });
      return { output: result.output, tokenUsage: result.tokenUsage };
    },
  });

  return { output, cached };
}
