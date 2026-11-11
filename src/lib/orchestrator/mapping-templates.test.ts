import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCacheStore } from "@/lib/cache";
import { loadMappingTemplate, saveMappingTemplate } from "./mapping-templates";

let dir: string;
let store: FileCacheStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mapping-template-test-"));
  store = new FileCacheStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("mapping templates", () => {
  it("returns null for a format never seen before", async () => {
    expect(await loadMappingTemplate(store, ["Item Naam", "Rate"], 1)).toBeNull();
  });

  it("saves and reloads a template for a header set", async () => {
    const headers = ["Item Naam", "Brand", "Rate"];
    const template = { "Item Naam": "descriptor.name" as const, Brand: "brand" as const, Rate: "price.value" as const };
    await saveMappingTemplate(store, headers, 1, template);
    expect(await loadMappingTemplate(store, headers, 1)).toEqual(template);
  });

  it("reuses the template regardless of header order (same format)", async () => {
    const template = { A: "brand" as const, B: "price.value" as const };
    await saveMappingTemplate(store, ["A", "B"], 1, template);
    expect(await loadMappingTemplate(store, ["B", "A"], 1)).toEqual(template);
  });

  it("does not match a different header set", async () => {
    await saveMappingTemplate(store, ["A", "B"], 1, { A: "brand" as const });
    expect(await loadMappingTemplate(store, ["A", "B", "C"], 1)).toBeNull();
  });
});
