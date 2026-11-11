import type { CacheStore } from "./store";

export interface GetOrComputeResult<T> {
  output: T;
  cached: boolean;
}

export interface ComputeResult<T> {
  output: T;
  tokenUsage?: { input_tokens: number; output_tokens: number };
}

export interface GetOrComputeParams<T> {
  store: CacheStore;
  key: string;
  step: string;
  modelId: string;
  /** Only called on a cache miss. Must not run on a hit. */
  compute: () => Promise<ComputeResult<T>>;
}

/**
 * The run-once-replay-after wrapper every agent step calls through. On a
 * hit, returns the stored output and never calls `compute`, so no model
 * call is made. On a miss, calls `compute` once and stores the result.
 */
export async function getOrCompute<T>(
  params: GetOrComputeParams<T>,
): Promise<GetOrComputeResult<T>> {
  const existing = await params.store.get<T>(params.key);
  if (existing) {
    return { output: existing.output, cached: true };
  }
  const { output, tokenUsage } = await params.compute();
  await params.store.set(params.key, {
    key: params.key,
    step: params.step,
    model_id: params.modelId,
    created_at: new Date().toISOString(),
    token_usage: tokenUsage,
    output,
  });
  return { output, cached: false };
}
