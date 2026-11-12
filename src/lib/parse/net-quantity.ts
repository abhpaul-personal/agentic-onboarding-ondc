const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gm: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

/**
 * Rule-based net-quantity normalisation (PRD: "500gm", "0.5 kg" -> 500 g,
 * handled by a rule; a word form like "aadha kilo" needs the LLM and is
 * out of scope here — this returns null rather than guess).
 */
export function parseNetQuantityGrams(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();

  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)\s*(g|gm|gram|grams|kg|kgs|kilograms?)$/);
  if (fraction) {
    const [, num, den, unit] = fraction;
    const gramsPerUnit = UNIT_TO_GRAMS[unit];
    const denominator = Number(den);
    if (gramsPerUnit && denominator !== 0) {
      return (Number(num) / denominator) * gramsPerUnit;
    }
  }

  const plain = trimmed.match(/^(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|kg|kgs|kilograms?)$/);
  if (plain) {
    const [, amount, unit] = plain;
    const gramsPerUnit = UNIT_TO_GRAMS[unit];
    if (gramsPerUnit) {
      return Number(amount) * gramsPerUnit;
    }
  }

  return null;
}

/** Canonical form for a parsed amount, e.g. 500 -> "500 g". */
export function formatNetQuantityGrams(grams: number): string {
  const rounded = Math.round(grams * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} g`;
}

/** The pattern a value must match to count as already-canonical (used by validateItems). */
export const NET_QUANTITY_CANONICAL_PATTERN = /^\d+(\.\d+)?\s?g$/;
