import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileCacheStore } from "@/lib/cache";
import { checkAndIncrementRateLimit, liveModeAvailable, verifyPassphrase } from "./live-mode";

describe("verifyPassphrase", () => {
  beforeEach(() => {
    vi.stubEnv("LIVE_MODE_PASSPHRASE", "correct-horse-battery-staple");
  });

  it("accepts the correct passphrase", () => {
    expect(verifyPassphrase("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong passphrase", () => {
    expect(verifyPassphrase("wrong")).toBe(false);
  });

  it("rejects an empty passphrase", () => {
    expect(verifyPassphrase("")).toBe(false);
  });

  it("rejects everything when no passphrase is configured", () => {
    vi.stubEnv("LIVE_MODE_PASSPHRASE", "");
    expect(verifyPassphrase("correct-horse-battery-staple")).toBe(false);
  });
});

describe("liveModeAvailable", () => {
  it("is false unless both the API key and passphrase are set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LIVE_MODE_PASSPHRASE", "x");
    expect(liveModeAvailable()).toBe(false);

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-x");
    vi.stubEnv("LIVE_MODE_PASSPHRASE", "");
    expect(liveModeAvailable()).toBe(false);

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-x");
    vi.stubEnv("LIVE_MODE_PASSPHRASE", "x");
    expect(liveModeAvailable()).toBe(true);
  });
});

describe("checkAndIncrementRateLimit", () => {
  let dir: string;
  let store: FileCacheStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rate-limit-test-"));
    store = new FileCacheStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows the first 10 calls in an hour, then blocks the 11th", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await checkAndIncrementRateLimit(store);
      expect(result.allowed).toBe(true);
    }
    const blocked = await checkAndIncrementRateLimit(store);
    expect(blocked).toEqual({ allowed: false, remaining: 0 });
  });

  it("reports the remaining count correctly", async () => {
    const first = await checkAndIncrementRateLimit(store);
    expect(first.remaining).toBe(9);
    const second = await checkAndIncrementRateLimit(store);
    expect(second.remaining).toBe(8);
  });
});
