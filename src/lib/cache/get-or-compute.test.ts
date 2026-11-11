import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileCacheStore } from "./file-store";
import { getOrCompute } from "./get-or-compute";
import { computeStepCacheKey } from "./keys";

let dir: string;
let store: FileCacheStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  store = new FileCacheStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("getOrCompute", () => {
  it("calls compute on a miss and stores the result", async () => {
    const compute = vi.fn(async () => ({ output: { mapped: "brand" } }));
    const key = computeStepCacheKey({
      step: "mapping",
      promptVersion: 1,
      schemaVersion: 1,
      modelId: "claude-sonnet-5-5",
      input: { column: "Brand" },
    });

    const result = await getOrCompute({ store, key, step: "mapping", modelId: "claude-sonnet-5-5", compute });

    expect(result).toEqual({ output: { mapped: "brand" }, cached: false });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("a second identical call makes no model request (M2 acceptance test)", async () => {
    const compute = vi.fn(async () => ({ output: { mapped: "brand" } }));
    const key = computeStepCacheKey({
      step: "mapping",
      promptVersion: 1,
      schemaVersion: 1,
      modelId: "claude-sonnet-5-5",
      input: { column: "Brand" },
    });
    const params = { store, key, step: "mapping", modelId: "claude-sonnet-5-5", compute };

    const first = await getOrCompute(params);
    const second = await getOrCompute(params);

    expect(first).toEqual({ output: { mapped: "brand" }, cached: false });
    expect(second).toEqual({ output: { mapped: "brand" }, cached: true });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("different inputs get different keys and both call compute", async () => {
    const compute = vi.fn(async () => ({ output: { called: true } }));
    const keyA = computeStepCacheKey({
      step: "mapping",
      promptVersion: 1,
      schemaVersion: 1,
      modelId: "claude-sonnet-5-5",
      input: { column: "Brand" },
    });
    const keyB = computeStepCacheKey({
      step: "mapping",
      promptVersion: 1,
      schemaVersion: 1,
      modelId: "claude-sonnet-5-5",
      input: { column: "Rate" },
    });

    await getOrCompute({ store, key: keyA, step: "mapping", modelId: "claude-sonnet-5-5", compute });
    await getOrCompute({ store, key: keyB, step: "mapping", modelId: "claude-sonnet-5-5", compute });

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("records token usage and model id in the stored entry", async () => {
    const key = computeStepCacheKey({
      step: "mapping",
      promptVersion: 1,
      schemaVersion: 1,
      modelId: "claude-sonnet-5-5",
      input: { column: "Brand" },
    });
    await getOrCompute({
      store,
      key,
      step: "mapping",
      modelId: "claude-sonnet-5-5",
      compute: async () => ({
        output: { mapped: "brand" },
        tokenUsage: { input_tokens: 120, output_tokens: 40 },
      }),
    });

    const entry = await store.get(key);
    expect(entry?.step).toBe("mapping");
    expect(entry?.model_id).toBe("claude-sonnet-5-5");
    expect(entry?.token_usage).toEqual({ input_tokens: 120, output_tokens: 40 });
  });
});
