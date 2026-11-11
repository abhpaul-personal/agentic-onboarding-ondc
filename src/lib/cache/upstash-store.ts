import { Redis } from "@upstash/redis";
import type { CacheEntry, CacheStore } from "./store";

/** A minimal subset of the Upstash Redis client this store depends on, so tests can inject a fake. */
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
}

/**
 * Upstash Redis cache, used for the live-mode cache in production (Vercel
 * Marketplace). Behind the same CacheStore interface as FileCacheStore, so
 * the rest of the app does not know which one it is talking to.
 */
export class UpstashCacheStore implements CacheStore {
  private readonly redis: RedisLike;

  constructor(options: { url: string; token: string } | { client: RedisLike }) {
    this.redis = "client" in options ? options.client : new Redis(options);
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    const value = await this.redis.get<CacheEntry<T>>(key);
    return value ?? null;
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.redis.set(key, entry);
  }
}
