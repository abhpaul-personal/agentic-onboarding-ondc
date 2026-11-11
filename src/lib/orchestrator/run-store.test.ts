import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCacheStore } from "@/lib/cache";
import { runStoreFrom } from "./run-store";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "run-store-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("RunStore", () => {
  it("returns null for an unknown run id", async () => {
    const store = runStoreFrom(new FileCacheStore(dir));
    expect(await store.get("missing")).toBeNull();
  });

  it("round-trips arbitrary run state", async () => {
    const store = runStoreFrom(new FileCacheStore(dir));
    const state = { step: "g0", items: [1, 2, 3] };
    await store.set("run-abc", state);
    expect(await store.get("run-abc")).toEqual(state);
  });

  it("overwrites on a second set (mutable, unlike the content-addressed agent cache)", async () => {
    const store = runStoreFrom(new FileCacheStore(dir));
    await store.set("run-abc", { step: "s1" });
    await store.set("run-abc", { step: "g0" });
    expect(await store.get("run-abc")).toEqual({ step: "g0" });
  });
});
