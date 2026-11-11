import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Raised when the model's output still fails schema validation after one
 * retry. The caller routes this to the fallback queue rather than letting
 * it crash the run (PRD: "retry once on a schema failure, then route to
 * the fallback queue").
 */
export class SchemaValidationError extends Error {
  constructor(public readonly issues: z.core.$ZodIssue[]) {
    super(`Model output did not match the schema after one retry: ${JSON.stringify(issues)}`);
    this.name = "SchemaValidationError";
  }
}

export interface StructuredCallParams<TOut> {
  client: Anthropic;
  model: string;
  system: string;
  /** A plain user turn, or content blocks (e.g. images) for a multimodal call. */
  content: string | Exclude<Anthropic.MessageParam["content"], string>;
  outputSchema: z.ZodType<TOut>;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
}

export interface StructuredCallResult<TOut> {
  output: TOut;
  tokenUsage: { input_tokens: number; output_tokens: number };
}

/**
 * Asks the model for structured JSON via forced tool use, validates with
 * the step's zod schema, and retries once with the validation errors fed
 * back before giving up.
 */
export async function structuredCall<TOut>(
  params: StructuredCallParams<TOut>,
): Promise<StructuredCallResult<TOut>> {
  const jsonSchema = z.toJSONSchema(params.outputSchema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const tool: Anthropic.Tool = {
    name: params.toolName,
    description: params.toolDescription,
    input_schema: jsonSchema as Anthropic.Tool.InputSchema,
  };

  const callOnce = async (correction?: string) => {
    const content: Anthropic.MessageParam["content"] =
      correction == null
        ? params.content
        : typeof params.content === "string"
          ? `${params.content}\n\n${correction}`
          : [...params.content, { type: "text" as const, text: correction }];

    const response = await params.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1536,
      system: params.system,
      messages: [{ role: "user", content }],
      tools: [tool],
      tool_choice: { type: "tool", name: params.toolName },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      throw new Error(`Model did not return a ${params.toolName} tool call.`);
    }
    return { parsed: params.outputSchema.safeParse(toolUse.input), usage: response.usage };
  };

  let attempt = await callOnce();
  if (!attempt.parsed.success) {
    attempt = await callOnce(
      `Your previous answer did not match the required schema. Issues: ` +
        `${JSON.stringify(attempt.parsed.error.issues)}. Call ${params.toolName} again with a corrected input.`,
    );
  }
  if (!attempt.parsed.success) {
    throw new SchemaValidationError(attempt.parsed.error.issues);
  }

  return {
    output: attempt.parsed.data,
    tokenUsage: {
      input_tokens: attempt.usage.input_tokens,
      output_tokens: attempt.usage.output_tokens,
    },
  };
}
