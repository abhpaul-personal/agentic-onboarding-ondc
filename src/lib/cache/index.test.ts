import { afterEach, describe, expect, it } from "vitest";
import { createCacheStore, createReplayCacheStore, FileCacheStore, UpstashCacheStore } from "./index";

const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL;
  if (ORIGINAL_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN;
});

describe("createReplayCacheStore", () => {
  it("is always the committed file store, even when Upstash is configured (e.g. for RunStore)", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(createReplayCacheStore()).toBeInstanceOf(FileCacheStore);
  });
});

describe("createCacheStore", () => {
  it("uses Upstash when both env vars are set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(createCacheStore()).toBeInstanceOf(UpstashCacheStore);
  });

  it("falls back to the file store without Upstash env vars", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(createCacheStore()).toBeInstanceOf(FileCacheStore);
  });
});
