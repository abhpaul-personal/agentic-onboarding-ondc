const GTIN13_PATTERN = /^\d{13}$/;

/** GS1 check-digit validation for a 13-digit GTIN. */
export function gtinCheckDigitValid(gtin: string): boolean {
  if (!GTIN13_PATTERN.test(gtin)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(gtin[i]) * (i % 2 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(gtin[12]);
}

/**
 * Informational only, not a validity check: the eval kit's README states
 * its synthetic GTINs use the GS1 restricted-circulation prefix 2, so they
 * cannot collide with a real retail product's barcode.
 */
export function usesRestrictedCirculationPrefix(gtin: string): boolean {
  return gtin.startsWith("2");
}
