import type Anthropic from "@anthropic-ai/sdk";
import type { CacheStore } from "@/lib/cache";
import { computeStepCacheKey, getOrCompute } from "@/lib/cache";
import { structuredCall } from "@/lib/llm/structured-call";
import {
  sellerIntakeInputSchema,
  sellerIntakeOutputSchema,
  type SellerIntakeInput,
  type SellerIntakeOutput,
} from "@/lib/schemas/agents/seller-intake";
import {
  PROMPT_VERSION,
  sellerIntakeSystemPrompt,
  sellerIntakeUserPrompt,
} from "@/lib/agents/prompts/seller-intake.v1";

export const SELLER_INTAKE_SCHEMA_VERSION = 1;
export { PROMPT_VERSION as SELLER_INTAKE_PROMPT_VERSION };

export interface RunSellerIntakeAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  input: SellerIntakeInput;
}

export interface RunSellerIntakeAgentResult {
  output: SellerIntakeOutput;
  cached: boolean;
}

/** S1: cross-fills the seller profile from the registration form and specimen documents. */
export async function runSellerIntakeAgent(
  params: RunSellerIntakeAgentParams,
): Promise<RunSellerIntakeAgentResult> {
  const input = sellerIntakeInputSchema.parse(params.input);
  const key = computeStepCacheKey({
    step: "seller-intake",
    promptVersion: PROMPT_VERSION,
    schemaVersion: SELLER_INTAKE_SCHEMA_VERSION,
    modelId: params.model,
    input,
  });

  const docs = input.documents;
  const content: Anthropic.MessageParam["content"] = [
    { type: "text", text: sellerIntakeUserPrompt(JSON.stringify(input.registration_form)) },
    { type: "text", text: "gst_certificate:" },
    { type: "image", source: { type: "base64", ...docs.gst_certificate } },
    ...(docs.fssai_licence
      ? ([
          { type: "text", text: "fssai_licence:" },
          { type: "image", source: { type: "base64", ...docs.fssai_licence } },
        ] as const)
      : []),
    { type: "text", text: "cancelled_cheque:" },
    { type: "image", source: { type: "base64", ...docs.cancelled_cheque } },
  ];

  const { output, cached } = await getOrCompute({
    store: params.store,
    key,
    step: "seller-intake",
    modelId: params.model,
    compute: async () => {
      const result = await structuredCall({
        client: params.client,
        model: params.model,
        system: sellerIntakeSystemPrompt(),
        content,
        outputSchema: sellerIntakeOutputSchema,
        toolName: "build_seller_profile",
        toolDescription: "Build the final seller profile from the form and documents.",
      });
      return { output: result.output, tokenUsage: result.tokenUsage };
    },
  });

  return { output, cached };
}
