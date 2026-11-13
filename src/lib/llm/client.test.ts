import { afterEach, describe, expect, it } from "vitest";
import { defaultModelId } from "./client";

const ORIGINAL_MODEL = process.env.ANTHROPIC_MODEL;

afterEach(() => {
  if (ORIGINAL_MODEL === undefined) delete process.env.ANTHROPIC_MODEL;
  else process.env.ANTHROPIC_MODEL = ORIGINAL_MODEL;
});

describe("defaultModelId", () => {
  it("falls back to the current default when ANTHROPIC_MODEL is unset", () => {
    delete process.env.ANTHROPIC_MODEL;
    expect(defaultModelId()).toBe("claude-sonnet-5-5");
  });

  it("falls back to the current default when ANTHROPIC_MODEL is blank (.env.local convention: leave empty for the default)", () => {
    process.env.ANTHROPIC_MODEL = "";
    expect(defaultModelId()).toBe("claude-sonnet-5-5");
  });

  it("uses ANTHROPIC_MODEL when explicitly set", () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-5-5";
    expect(defaultModelId()).toBe("claude-opus-5-5");
  });
});
