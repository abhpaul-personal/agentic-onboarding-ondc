import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { CacheEntry, CacheStore } from "./store";

/**
 * Committed-JSON-file cache: used for local dev, tests, and the sample
 * sets committed under data/cache/ that the public demo replays.
 */
export class FileCacheStore implements CacheStore {
  constructor(private readonly dir: string) {}

  private pathFor(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const raw = await readFile(this.pathFor(key), "utf-8");
      return JSON.parse(raw) as CacheEntry<T>;
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(key), JSON.stringify(entry, null, 2) + "\n", "utf-8");
  }
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
