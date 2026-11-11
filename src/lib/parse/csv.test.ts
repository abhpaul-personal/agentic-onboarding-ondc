import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('a,b\n"1, 2",3\n')).toEqual([
      ["a", "b"],
      ["1, 2", "3"],
    ]);
  });

  it("handles an escaped quote inside a quoted field", () => {
    expect(parseCsv('a\n"say ""hi"""\n')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("parses set C's Shopify export, which quotes HTML and tag lists", () => {
    const raw = readFileSync(
      join(process.cwd(), "data/sets/set-C/products_export.csv"),
      "utf-8",
    );
    const rows = parseCsv(raw);
    expect(rows[0]).toContain("Body (HTML)");
    // 85 rows: 1 header + 84 variants (PRD: 30 products, 84 variants).
    expect(rows.length).toBe(85);
    const first = rows[1];
    expect(first[rows[0].indexOf("Tags")]).toBe("chanderi, festive, women");
  });
});

describe("parseCsvRecords", () => {
  it("parses set A's clean catalog into column-keyed records", () => {
    const raw = readFileSync(join(process.cwd(), "data/sets/set-A/catalog.csv"), "utf-8");
    const records = parseCsvRecords(raw);
    expect(records.length).toBe(40);
    expect(records[0].sku).toBe("TMG-001");
    expect(records[0].product_name).toBe("Turmeric Powder 200g");
  });
});
