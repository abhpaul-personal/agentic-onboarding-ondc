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
 * For live agent runs and rate limiting: picks the Upstash store when its
 * env vars are set (needed in production, where a serverless function has
 * no shared writable filesystem to persist a new write to), otherwise the
 * file store rooted at data/cache.
 *
 * Do not use this for replaying the committed sample-set cache (the
 * peek*Cache functions) — use createReplayCacheStore instead. Upstash's
 * env vars may be present for a reason unrelated to the agent cache (e.g.
 * RunStore needs it for every demo run, not just live mode), and an empty
 * Upstash database has none of the committed sample-set entries, so this
 * store finding Upstash configured must never be read as "live mode is
 * on" or "the committed cache is unavailable".
 */
export function createCacheStore(): CacheStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashCacheStore({ url, token });
  }
  return new FileCacheStore(process.env.CACHE_DIR ?? join(process.cwd(), "data/cache"));
}

/**
 * Always the committed data/cache file store, regardless of Upstash
 * configuration (see createCacheStore's doc comment for why that
 * distinction matters). The public demo's guarantee — it replays from the
 * committed cache and never calls the model, even if an API key is
 * configured (PRD) — depends on peek reads never silently moving to a
 * store that doesn't have these entries.
 */
export function createReplayCacheStore(): CacheStore {
  return new FileCacheStore(process.env.CACHE_DIR ?? join(process.cwd(), "data/cache"));
}
