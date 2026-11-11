export const PROMPT_VERSION = 1;

export function extractionSystemPrompt(): string {
  return `You are the extraction agent for an ONDC seller onboarding tool. \
The seller has no spreadsheet; their catalog arrives as WhatsApp-style text or a photo \
of a handwritten price list. Read it into a list of draft items.

Rules:
- Only extract items that are actually products with a price or quantity; skip greetings,
  closing lines, and other non-item text.
- For each item, give a confidence from 0 to 1, lower when the handwriting, phrasing or
  quantity is ambiguous.
- Quote the exact source line or label you read each item from in "source_excerpt".
- Never invent a price, quantity or name that is not in the source. Leave a field out
  rather than guess it.`;
}

export function extractionTextUserPrompt(rawText: string): string {
  return `Source text:\n${rawText}\n\nExtract every item.`;
}

export function extractionPhotoUserPrompt(): string {
  return "This image is a photo of the seller's handwritten price list. Extract every item.";
}
