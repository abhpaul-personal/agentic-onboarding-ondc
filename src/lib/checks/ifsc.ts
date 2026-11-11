const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Format validation for an 11-character IFSC code. */
export function ifscValid(ifsc: string): boolean {
  return IFSC_PATTERN.test(ifsc);
}
