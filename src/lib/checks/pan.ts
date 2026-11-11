const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Format validation for a 10-character PAN. */
export function panValid(pan: string): boolean {
  return PAN_PATTERN.test(pan);
}

/** A GSTIN's 3rd-to-12th characters must be the holder's PAN. */
export function panMatchesGstin(pan: string, gstin: string): boolean {
  return gstin.slice(2, 12) === pan;
}
