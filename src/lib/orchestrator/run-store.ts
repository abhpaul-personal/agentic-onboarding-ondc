import { join } from "path";
import { FileCacheStore, UpstashCacheStore, type CacheStore } from "@/lib/cache";

/**
 * Holds mutable run state, keyed by a URL-safe run id rather than a
 * content hash (PRD: "Store run state in the URL-safe run ID plus the
 * cache store, not in the browser alone"). Built on the same storage
 * primitives as the agent-output cache, but rooted at data/runs/ (not
 * committed — runs are per-visitor state, not the sample-set cache) and
 * never shares a key with it.
 */
export interface RunStore {
  get<T>(runId: string): Promise<T | null>;
  set<T>(runId: string, state: T): Promise<void>;
}

const RUN_KEY_PREFIX = "run:";

function toRunStore(cacheStore: CacheStore): RunStore {
  return {
    async get<T>(runId: string) {
      const entry = await cacheStore.get<T>(`${RUN_KEY_PREFIX}${runId}`);
      return entry ? entry.output : null;
    },
    async set<T>(runId: string, state: T) {
      await cacheStore.set(`${RUN_KEY_PREFIX}${runId}`, {
        key: `${RUN_KEY_PREFIX}${runId}`,
        step: "run-state",
        model_id: "n/a",
        created_at: new Date().toISOString(),
        output: state,
      });
    },
  };
}

export function createRunStore(): RunStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return toRunStore(new UpstashCacheStore({ url, token }));
  }
  return toRunStore(new FileCacheStore(process.env.RUN_DIR ?? join(process.cwd(), "data/runs")));
}

/** For tests: wraps any CacheStore (e.g. one pointed at a temp dir) as a RunStore. */
export function runStoreFrom(cacheStore: CacheStore): RunStore {
  return toRunStore(cacheStore);
}
