/**
 * One cached step output. Human decisions are never cached (PRD "run once,
 * replay after") — this type and the stores below only ever hold agent
 * step and column-mapping outputs.
 */
export interface CacheEntry<T = unknown> {
  key: string;
  step: string;
  model_id: string;
  created_at: string; // ISO timestamp
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  output: T;
}

export interface CacheStore {
  get<T = unknown>(key: string): Promise<CacheEntry<T> | null>;
  set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void>;
}
