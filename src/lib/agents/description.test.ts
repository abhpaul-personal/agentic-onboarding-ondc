import type Anthropic from "@anthropic-ai/sdk";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileCacheStore } from "@/lib/cache";
import { runDescriptionAgent, UnsupportedClaimError } from "./description";

let dir: string;
let store: FileCacheStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  store = new FileCacheStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fakeClient(shortDesc: string): Anthropic {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", id: "t1", name: "write_description", input: { short_desc: shortDesc } }],
    usage: { input_tokens: 30, output_tokens: 10 },
  });
  return { messages: { create } } as unknown as Anthropic;
}

describe("runDescriptionAgent", () => {
  it("accepts a description that only restates given facts", async () => {
    const client = fakeClient("Toor Dal, 1 kg pack.");
    const result = await runDescriptionAgent({
      store,
      client,
      model: "claude-sonnet-5-5",
      input: { item_name: "Toor Dal", source_facts: ["Toor Dal, 1 kg pack"] },
    });
    expect(result.output.short_desc).toBe("Toor Dal, 1 kg pack.");
  });

  it("rejects an invented claim with no matching source fact (set F's bait)", async () => {
    const client = fakeClient("Instant Coffee - tastes like organic.");
    await expect(
      runDescriptionAgent({
        store,
        client,
        model: "claude-sonnet-5-5",
        input: { item_name: "Instant Coffee", source_facts: ["Instant Coffee, 100 g pack"] },
      }),
    ).rejects.toBeInstanceOf(UnsupportedClaimError);
  });

  it("allows a claim when the source facts actually contain it", async () => {
    const client = fakeClient("Organic Turmeric Powder, 200 g.");
    const result = await runDescriptionAgent({
      store,
      client,
      model: "claude-sonnet-5-5",
      input: { item_name: "Turmeric Powder", source_facts: ["Labelled organic by a certified body", "200 g pack"] },
    });
    expect(result.output.short_desc).toContain("Organic");
  });
});
