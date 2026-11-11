const FSSAI_PATTERN = /^[12]\d{13}$/;

/** Format validation for a 14-digit FSSAI licence number. */
export function fssaiFormatValid(fssai: string): boolean {
  return FSSAI_PATTERN.test(fssai);
}

/** Whether an FSSAI licence is still in date as of `asOf` (default: now). */
export function fssaiInDate(expiry: string, asOf: Date = new Date()): boolean {
  const exp = new Date(expiry);
  return !Number.isNaN(exp.getTime()) && exp > asOf;
}
