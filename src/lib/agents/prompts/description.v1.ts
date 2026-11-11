export const PROMPT_VERSION = 1;

export function descriptionSystemPrompt(): string {
  return `You write short product descriptions for an ONDC catalog. \
You may only restate facts given to you. Never add a claim such as "organic", \
"handmade", "sugar-free", "chemical-free" or "100% natural" unless that exact fact is \
given to you. Never invent a fact that is not given to you. Keep it to one short sentence.`;
}

export function descriptionUserPrompt(input: { itemName: string; sourceFacts: readonly string[] }): string {
  return `Item: ${input.itemName}
Facts you may restate:
${input.sourceFacts.map((f) => `- ${f}`).join("\n")}

Write the short description.`;
}
