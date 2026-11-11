import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCacheStore } from "./file-store";
import type { CacheEntry } from "./store";

let dir: string;
let store: FileCacheStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  store = new FileCacheStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FileCacheStore", () => {
  it("returns null for a key that was never set", async () => {
    expect(await store.get("missing")).toBeNull();
  });

  it("round-trips an entry", async () => {
    const entry: CacheEntry<{ value: number }> = {
      key: "abc123",
      step: "mapping",
      model_id: "claude-sonnet-5-5",
      created_at: "2026-11-12T00:00:00.000Z",
      output: { value: 42 },
    };
    await store.set("abc123", entry);
    expect(await store.get<{ value: number }>("abc123")).toEqual(entry);
  });

  it("creates the cache directory on first write", async () => {
    const nested = join(dir, "does-not-exist-yet");
    const nestedStore = new FileCacheStore(nested);
    await nestedStore.set("k", {
      key: "k",
      step: "s",
      model_id: "m",
      created_at: "2026-11-12T00:00:00.000Z",
      output: {},
    });
    expect(await nestedStore.get("k")).not.toBeNull();
  });
});
