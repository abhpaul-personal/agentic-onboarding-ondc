import { describe, expect, it, vi } from "vitest";
import type { CacheEntry } from "./store";
import { UpstashCacheStore, type RedisLike } from "./upstash-store";

function fakeRedis(): RedisLike & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)) as RedisLike["get"],
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return "OK";
    }),
  };
}

describe("UpstashCacheStore", () => {
  it("returns null for a key that was never set", async () => {
    const redis = fakeRedis();
    const store = new UpstashCacheStore({ client: redis });
    expect(await store.get("missing")).toBeNull();
  });

  it("round-trips an entry through the injected client", async () => {
    const redis = fakeRedis();
    const store = new UpstashCacheStore({ client: redis });
    const entry: CacheEntry<{ value: number }> = {
      key: "abc123",
      step: "mapping",
      model_id: "claude-sonnet-5-5",
      created_at: "2026-11-12T00:00:00.000Z",
      output: { value: 42 },
    };
    await store.set("abc123", entry);
    expect(redis.set).toHaveBeenCalledWith("abc123", entry);
    expect(await store.get<{ value: number }>("abc123")).toEqual(entry);
  });
});
