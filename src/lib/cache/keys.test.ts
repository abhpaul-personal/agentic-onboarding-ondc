import { describe, expect, it } from "vitest";
import {
  computeColumnCacheKey,
  computeMappingTemplateFingerprint,
  computeStepCacheKey,
} from "./keys";

const base = {
  step: "mapping",
  promptVersion: 1,
  schemaVersion: 1,
  modelId: "claude-sonnet-5-5",
  input: { column: "M.R.P (Rs)" },
};

describe("computeStepCacheKey", () => {
  it("is stable for the same input", () => {
    expect(computeStepCacheKey(base)).toBe(computeStepCacheKey({ ...base }));
  });

  it("changes when the prompt version bumps", () => {
    expect(computeStepCacheKey(base)).not.toBe(
      computeStepCacheKey({ ...base, promptVersion: 2 }),
    );
  });

  it("changes when the schema version bumps", () => {
    expect(computeStepCacheKey(base)).not.toBe(
      computeStepCacheKey({ ...base, schemaVersion: 2 }),
    );
  });

  it("changes when the model changes", () => {
    expect(computeStepCacheKey(base)).not.toBe(
      computeStepCacheKey({ ...base, modelId: "claude-haiku-5-5" }),
    );
  });

  it("changes when the input changes", () => {
    expect(computeStepCacheKey(base)).not.toBe(
      computeStepCacheKey({ ...base, input: { column: "Rate" } }),
    );
  });
});

describe("computeColumnCacheKey", () => {
  it("normalises header case and whitespace", () => {
    const a = computeColumnCacheKey({
      header: "M.R.P (Rs)",
      sampleValues: ["120", "150"],
      schemaVersion: 1,
    });
    const b = computeColumnCacheKey({
      header: "  m.r.p (rs)  ",
      sampleValues: ["120", "150"],
      schemaVersion: 1,
    });
    expect(a).toBe(b);
  });

  it("only considers the top 5 sample values", () => {
    const a = computeColumnCacheKey({
      header: "Rate",
      sampleValues: ["1", "2", "3", "4", "5"],
      schemaVersion: 1,
    });
    const b = computeColumnCacheKey({
      header: "Rate",
      sampleValues: ["1", "2", "3", "4", "5", "6th value ignored"],
      schemaVersion: 1,
    });
    expect(a).toBe(b);
  });
});

describe("computeMappingTemplateFingerprint", () => {
  it("is order-independent in the header set", () => {
    const a = computeMappingTemplateFingerprint({
      headers: ["Item Naam", "Brand", "Rate"],
      schemaVersion: 1,
    });
    const b = computeMappingTemplateFingerprint({
      headers: ["Rate", "Item Naam", "Brand"],
      schemaVersion: 1,
    });
    expect(a).toBe(b);
  });

  it("changes when the header set changes", () => {
    const a = computeMappingTemplateFingerprint({
      headers: ["Item Naam", "Brand"],
      schemaVersion: 1,
    });
    const b = computeMappingTemplateFingerprint({
      headers: ["Item Naam", "Brand", "Stock"],
      schemaVersion: 1,
    });
    expect(a).not.toBe(b);
  });
});
