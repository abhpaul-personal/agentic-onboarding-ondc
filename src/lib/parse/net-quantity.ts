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
 *
 * `assumeGramsIfUnitless`: a bare number ("500") has no unit to parse, so
 * by default this still returns null rather than guess. The one place
 * that may pass true is build-items.ts's net_quantity column, which only
 * ever runs after a reviewer has approved that column as net_quantity at
 * G2 — at that point a human has already signed off that the column holds
 * a quantity, and that quantity is grams by this project's convention, so
 * a unitless number there is no longer ambiguous.
 */
export function parseNetQuantityGrams(raw: string, opts?: { assumeGramsIfUnitless?: boolean }): number | null {
  const trimmed = raw.trim().toLowerCase();

  if (opts?.assumeGramsIfUnitless) {
    const bare = trimmed.match(/^\d+(\.\d+)?$/);
    if (bare) return Number(bare[0]);
  }

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
