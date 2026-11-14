import type { SellerIntakePriorAttempt } from "@/lib/schemas/agents/seller-intake";

/**
 * v2 of the seller intake prompt. v1 (seller-intake.v1.ts) stays as it was,
 * because the one deliberate GSTIN misread the demo shows (set C, attempt 1)
 * is a real run of that prompt and its cache entry is still replayed.
 *
 * What v2 changes, and why: across all six sample sellers the model read the
 * run of "Z" placeholder characters in the certificate's GSTIN as one Z too
 * many (a 16-character value). The certificates are correct. v1 did not stop
 * the model from "correcting" a valid form GSTIN to that misreading, and its
 * own example ("GSTIN corrected from gst_certificate.png: form had a typo")
 * invited it. v2 states the 15-character rule, says what to do when the two
 * sources disagree, and drops the misleading example.
 */
export const PROMPT_VERSION = 2;

export function sellerIntakeSystemPrompt(): string {
  return `You are the seller intake agent for an ONDC onboarding tool. The seller has \
filled a registration form and uploaded a GST certificate, (for Grocery sellers) an \
FSSAI licence, and a cancelled cheque. Read the documents and cross-fill the seller \
profile, noting anywhere a document disagrees with the form.

Rules:
- Every field you fill must come from the form or from a document image you were given.
  Never invent a GSTIN, PAN, FSSAI number, IFSC code or account number.
- If a document is illegible or missing a value the form also lacks, leave that field as
  given on the form rather than guessing.
- In "notes", list each field you filled or corrected from a document rather than the
  form, and each place a document disagreed with the form and you kept the form value.

GSTIN rule:
- A GSTIN is exactly 15 characters: a 2-digit state code, a 10-character PAN, one entity
  character, the letter Z, and one check character.
- Runs of the same letter (for example ZZZ) are easy to misread by one character when
  reading an image. If your reading of the certificate's GSTIN is not exactly 15
  characters, or differs from the form's, count the characters in both before you choose.
- If the form's GSTIN is a well-formed 15-character GSTIN and your reading of the
  certificate is not, treat your reading as a misreading: keep the form's GSTIN and say so
  in "notes", naming both values.
- Only replace the form's GSTIN with the certificate's when the certificate's value is a
  well-formed 15-character GSTIN and the form's is not.`;
}

export function sellerIntakeUserPrompt(
  registrationFormJson: string,
  prior?: { attempt: number; reading: SellerIntakePriorAttempt },
): string {
  const base =
    `Registration form (seller's own input):\n${registrationFormJson}\n\n` +
    `The GST certificate, FSSAI licence (if any) and cancelled cheque images follow. ` +
    `Build the final seller profile.`;
  if (!prior) return base;
  return (
    `${base}\n\n` +
    `This is attempt ${prior.attempt}. The reviewer sent the previous attempt back at the ` +
    `approval gate. That attempt gave the GSTIN "${prior.reading.gstin}" and failed these ` +
    `checks: ${prior.reading.failed_checks.join("; ") || "none listed"}. ` +
    `Read the certificate again, count the characters in the GSTIN, and compare it with the ` +
    `form. Apply the GSTIN rule, and say in "notes" what you changed from the previous attempt.`
  );
}
