/**
 * Claims that imply a certification or process the agent cannot verify from
 * source data alone. Finding one of these in a description with no backing
 * source fact means the agent is inventing a claim, which the no-invention
 * guardrail forbids.
 */
const UNSUPPORTED_CLAIM_PATTERN =
  /\b(organic|handmade|sugar[- ]free|chemical[- ]free|100% natural)\b/i;

/** Returns the first unsupported claim phrase found in `text`, or null. */
export function findUnsupportedClaim(text: string): string | null {
  const match = text.match(UNSUPPORTED_CLAIM_PATTERN);
  return match ? match[0] : null;
}
