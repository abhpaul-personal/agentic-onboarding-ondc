import { MAPPING_TARGETS } from "@/lib/schemas/mapping-target";

export const PROMPT_VERSION = 1;

const TARGET_LIST = Object.entries(MAPPING_TARGETS)
  .map(([key, { label, risk }]) => `- ${key} (${label}, ${risk} risk)`)
  .join("\n");

export function mappingSystemPrompt(): string {
  return `You are the smart mapping agent for an ONDC seller onboarding tool. \
Given one source spreadsheet column (its header and a few sample values), decide which \
target attribute it maps to, or that it maps to none.

Target attributes you may choose from:
${TARGET_LIST}

Rules:
- Pick at most 3 candidate targets, best first, each with your own confidence from 0 to 1.
- "proposed" is your best candidate, or null if nothing fits (then route it as IGNORE-worthy by setting confidence low).
- Your "reason" must quote at least one of the column's own sample values verbatim.
- Never propose a target that would require inventing a value the column does not contain.
- If the column is clearly not product data (e.g. a serial number or a free-text remark column with no product meaning), propose "IGNORE".`;
}

export function mappingUserPrompt(column: {
  column: string;
  sample_values: readonly string[];
  fill_rate: number;
  distinct_count: number;
}): string {
  return `Source column: "${column.column}"
Fill rate: ${Math.round(column.fill_rate * 100)}%
Distinct values: ${column.distinct_count}
Sample values: ${column.sample_values.map((v) => JSON.stringify(v)).join(", ")}

Map this column.`;
}
