import type Anthropic from "@anthropic-ai/sdk";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileCacheStore } from "@/lib/cache";
import { runMappingAgent } from "./mapping";

let dir: string;
let store: FileCacheStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  store = new FileCacheStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fakeClient(modelOutput: unknown): Anthropic {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", id: "t1", name: "propose_mapping", input: modelOutput }],
    usage: { input_tokens: 50, output_tokens: 20 },
  });
  return { messages: { create } } as unknown as Anthropic;
}

const column = {
  column: "M.R.P (Rs)",
  fill_rate: 1,
  distinct_count: 40,
  sample_values: ["120", "150", "165"],
};

describe("runMappingAgent", () => {
  it("routes a high-confidence high-risk proposal to review, not auto", async () => {
    const client = fakeClient({
      candidates: [{ target: "price.maximum_value", confidence: 0.95 }],
      proposed: "price.maximum_value",
      confidence: 0.95,
      reason: 'Header reads "M.R.P (Rs)" and values like "120" look like currency amounts.',
    });
    const result = await runMappingAgent({ store, client, model: "claude-sonnet-5-5", column });

    expect(result.cached).toBe(false);
    expect(result.proposal.risk).toBe("high");
    expect(result.proposal.proposed).toBe("price.maximum_value");
  });

  it("reuses the column-level cache for the same header and samples", async () => {
    const client = fakeClient({
      candidates: [{ target: "brand", confidence: 0.92 }],
      proposed: "brand",
      confidence: 0.92,
      reason: 'Column "Brand" has values like "Tilwari".',
    });
    const brandColumn = { column: "Brand", fill_rate: 1, distinct_count: 5, sample_values: ["Tilwari"] };

    const first = await runMappingAgent({ store, client, model: "claude-sonnet-5-5", column: brandColumn });
    const second = await runMappingAgent({ store, client, model: "claude-sonnet-5-5", column: brandColumn });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });
});
