import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical-json";

describe("canonicalJson", () => {
  it("produces the same string regardless of key order", () => {
    const a = canonicalJson({ b: 2, a: 1 });
    const b = canonicalJson({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("sorts nested object keys too", () => {
    const a = canonicalJson({ outer: { z: 1, y: 2 } });
    const b = canonicalJson({ outer: { y: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("distinguishes values that differ", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});
