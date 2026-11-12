import { timingSafeEqual } from "crypto";
import type { CacheStore } from "@/lib/cache";

/** Live mode is only possible when both the API key and the passphrase are configured. */
export function liveModeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.LIVE_MODE_PASSPHRASE);
}

/** Constant-time comparison so a wrong guess can't be timed to narrow down the right one. */
export function verifyPassphrase(input: string): boolean {
  const expected = process.env.LIVE_MODE_PASSPHRASE;
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const RATE_LIMIT_PER_HOUR = 10; // PRD: "for example 10 runs per hour"

interface RateLimitBucket {
  count: number;
}

/** One shared bucket per hour: live mode is owner-only, not multi-tenant. */
export async function checkAndIncrementRateLimit(
  store: CacheStore,
): Promise<{ allowed: boolean; remaining: number }> {
  const hourBucket = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  const key = `live-mode-rate:${hourBucket}`;
  const entry = await store.get<RateLimitBucket>(key);
  const count = entry?.output.count ?? 0;
  if (count >= RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }
  await store.set(key, {
    key,
    step: "live-mode-rate-limit",
    model_id: "n/a",
    created_at: new Date().toISOString(),
    output: { count: count + 1 },
  });
  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count - 1 };
}
