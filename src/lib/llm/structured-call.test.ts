import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SchemaValidationError, structuredCall } from "./structured-call";

const outputSchema = z.object({ confidence: z.number().min(0).max(1) });

function fakeClient(responses: unknown[]): Anthropic {
  const create = vi.fn();
  for (const input of responses) {
    create.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "t1", name: "propose", input }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  }
  return { messages: { create } } as unknown as Anthropic;
}

describe("structuredCall", () => {
  it("returns the validated output on the first try", async () => {
    const client = fakeClient([{ confidence: 0.9 }]);
    const result = await structuredCall({
      client,
      model: "claude-sonnet-5-5",
      system: "sys",
      content: "user",
      outputSchema,
      toolName: "propose",
      toolDescription: "desc",
    });
    expect(result.output).toEqual({ confidence: 0.9 });
    expect(result.tokenUsage).toEqual({ input_tokens: 10, output_tokens: 5 });
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it("retries once with the validation error, then succeeds", async () => {
    const client = fakeClient([{ confidence: "not-a-number" }, { confidence: 0.4 }]);
    const result = await structuredCall({
      client,
      model: "claude-sonnet-5-5",
      system: "sys",
      content: "user",
      outputSchema,
      toolName: "propose",
      toolDescription: "desc",
    });
    expect(result.output).toEqual({ confidence: 0.4 });
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it("throws SchemaValidationError after a second failed attempt", async () => {
    const client = fakeClient([{ confidence: "nope" }, { confidence: "still nope" }]);
    await expect(
      structuredCall({
        client,
        model: "claude-sonnet-5-5",
        system: "sys",
        content: "user",
        outputSchema,
        toolName: "propose",
        toolDescription: "desc",
      }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it("steers with auto tool_choice and an explicit instruction naming the tool (forced tool_choice 400s on current models)", async () => {
    const client = fakeClient([{ confidence: 0.5 }]);
    await structuredCall({
      client,
      model: "claude-sonnet-5-5",
      system: "sys",
      content: "user",
      outputSchema,
      toolName: "propose",
      toolDescription: "desc",
    });
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: "auto" });
    expect(call.tools[0].name).toBe("propose");
    expect(call.system).toContain("propose");
  });
});
