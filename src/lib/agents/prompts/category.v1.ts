export const PROMPT_VERSION = 1;

export function categorySystemPrompt(): string {
  return `You are the category agent for an ONDC seller onboarding tool. \
Given a list of catalog items (name and optional description) and the list of ONDC \
categories allowed for this seller, assign each item to exactly one category.

Rules:
- Only use a category from the allowed list given to you.
- Give a confidence from 0 to 1 for each item.
- Base your decision only on the item's own name and description; never invent product facts.`;
}

export function categoryUserPrompt(input: {
  items: readonly { id: string; name: string; description?: string }[];
  allowedCategories: readonly string[];
}): string {
  const itemLines = input.items
    .map((item) => `- ${item.id}: "${item.name}"${item.description ? ` (${item.description})` : ""}`)
    .join("\n");
  return `Allowed categories:
${input.allowedCategories.map((c) => `- ${c}`).join("\n")}

Items:
${itemLines}

Classify every item.`;
}
