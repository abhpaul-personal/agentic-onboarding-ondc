import type { ColumnProfile } from "@/lib/schemas/field-mapping";

/** Profiles every column of a parsed table: fill rate, distinct count, top 5 samples. */
export function profileColumns(records: readonly Record<string, string>[]): ColumnProfile[] {
  if (records.length === 0) return [];
  const headers = Object.keys(records[0]);

  return headers.map((column) => {
    const values = records.map((r) => r[column] ?? "");
    const nonEmpty = values.filter((v) => v.trim() !== "");
    const distinctValues = [...new Set(nonEmpty)];

    return {
      column,
      fill_rate: values.length === 0 ? 0 : nonEmpty.length / values.length,
      distinct_count: distinctValues.length,
      sample_values: distinctValues.slice(0, 5),
    };
  });
}
