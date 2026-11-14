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
import * as promptV1 from "@/lib/agents/prompts/seller-intake.v1";
import * as promptV2 from "@/lib/agents/prompts/seller-intake.v2";

export const SELLER_INTAKE_SCHEMA_VERSION = 1;

/** The two intake prompts that exist. v1 is kept because a replayed cache entry (set C, attempt 1) was produced by it. */
export type SellerIntakePromptVersion = 1 | 2;
export const SELLER_INTAKE_PROMPT_VERSION: SellerIntakePromptVersion = promptV2.PROMPT_VERSION;

export interface RunSellerIntakeAgentParams {
  store: CacheStore;
  client: Anthropic;
  model: string;
  input: SellerIntakeInput;
  /** Defaults to the current prompt. Only set to 1 to reproduce a run made with the original prompt. */
  promptVersion?: SellerIntakePromptVersion;
}

export interface RunSellerIntakeAgentResult {
  output: SellerIntakeOutput;
  cached: boolean;
}

/**
 * The cache key for one seller-intake run. Both the live run and the demo's
 * cache replay build their key here so they can never disagree. A retry's
 * `attempt` and `prior_attempt` are part of `input`, so each attempt has its
 * own entry; a first attempt omits them and keeps its original key.
 */
export function sellerIntakeCacheKey(
  input: SellerIntakeInput,
  model: string,
  promptVersion: SellerIntakePromptVersion = SELLER_INTAKE_PROMPT_VERSION,
): string {
  return computeStepCacheKey({
    step: "seller-intake",
    promptVersion,
    schemaVersion: SELLER_INTAKE_SCHEMA_VERSION,
    modelId: model,
    input: sellerIntakeInputSchema.parse(input),
  });
}

/** The system and user text sent for one run, exported so tests can check exactly what the model is told. */
export function sellerIntakePromptsFor(input: SellerIntakeInput, promptVersion: SellerIntakePromptVersion) {
  const formJson = JSON.stringify(input.registration_form);
  if (promptVersion === 1) {
    return { system: promptV1.sellerIntakeSystemPrompt(), user: promptV1.sellerIntakeUserPrompt(formJson) };
  }
  const prior =
    input.attempt && input.prior_attempt ? { attempt: input.attempt, reading: input.prior_attempt } : undefined;
  return { system: promptV2.sellerIntakeSystemPrompt(), user: promptV2.sellerIntakeUserPrompt(formJson, prior) };
}

/** S1: cross-fills the seller profile from the registration form and specimen documents. */
export async function runSellerIntakeAgent(
  params: RunSellerIntakeAgentParams,
): Promise<RunSellerIntakeAgentResult> {
  const input = sellerIntakeInputSchema.parse(params.input);
  const promptVersion = params.promptVersion ?? SELLER_INTAKE_PROMPT_VERSION;
  const key = sellerIntakeCacheKey(input, params.model, promptVersion);
  const prompts = sellerIntakePromptsFor(input, promptVersion);

  const docs = input.documents;
  const content: Anthropic.MessageParam["content"] = [
    { type: "text", text: prompts.user },
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
        system: prompts.system,
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

/** Reads the cached seller-intake output without ever calling the model (demo mode). */
export async function peekSellerIntakeCache(
  store: CacheStore,
  model: string,
  input: SellerIntakeInput,
  promptVersion: SellerIntakePromptVersion = SELLER_INTAKE_PROMPT_VERSION,
): Promise<SellerIntakeOutput | null> {
  const entry = await store.get<SellerIntakeOutput>(sellerIntakeCacheKey(input, model, promptVersion));
  return entry ? entry.output : null;
}
