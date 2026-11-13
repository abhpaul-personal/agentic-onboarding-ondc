import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

/** Lazily constructed so importing this module never requires an API key. */
export function getAnthropicClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Only needed for `npm run agents:warm` or live mode; " +
          "the deployed public demo replays the committed cache and never calls this.",
      );
    }
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export function defaultModelId(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}
