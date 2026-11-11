import { join } from "path";
import { FileCacheStore } from "./file-store";
import type { CacheStore } from "./store";
import { UpstashCacheStore } from "./upstash-store";

export * from "./canonical-json";
export * from "./file-store";
export * from "./get-or-compute";
export * from "./keys";
export * from "./store";
export * from "./upstash-store";

/**
 * Picks the Upstash store when its env vars are set (production live
 * mode), otherwise the file store rooted at data/cache (local dev, tests,
 * and replaying the committed sample-set cache).
 */
export function createCacheStore(): CacheStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashCacheStore({ url, token });
  }
  return new FileCacheStore(process.env.CACHE_DIR ?? join(process.cwd(), "data/cache"));
}
