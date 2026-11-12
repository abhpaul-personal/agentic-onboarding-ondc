const MONTH_NAMES: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Rule-based packing-date normalisation to canonical "MM/YYYY". Handles
 * numeric ("10/2026", "09-2026") and month-name ("Oct-26", "Sept 2026")
 * forms; returns null for anything else rather than guess.
 */
export function parsePackedMonth(raw: string): string | null {
  const trimmed = raw.trim();

  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const [, month, year] = numeric;
    const mm = Number(month);
    if (mm >= 1 && mm <= 12) {
      return `${month.padStart(2, "0")}/${year}`;
    }
    return null;
  }

  const named = trimmed.match(/^([A-Za-z]{3,9})[\s-]?(\d{2}|\d{4})$/);
  if (named) {
    const [, monthName, year] = named;
    const key = monthName.toLowerCase();
    const mm = MONTH_NAMES[key] ?? MONTH_NAMES[key.slice(0, 3)];
    if (mm) {
      const yyyy = year.length === 2 ? `20${year}` : year;
      return `${mm}/${yyyy}`;
    }
  }

  return null;
}

/** The pattern a value must match to count as already-canonical (used by validateItems). */
export const PACKED_MONTH_CANONICAL_PATTERN = /^\d{2}\/\d{4}$/;
