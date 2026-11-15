// Preloaded into the Next.js server process the e2e suite runs against
// (see playwright.config.ts's webServer.env.NODE_OPTIONS). The public demo
// must only ever replay from the committed cache; this makes any outbound
// call to the Anthropic API during the *entire* e2e run a hard, visible
// failure (tests/e2e/global-teardown.ts fails the whole run if it finds the
// sentinel file this writes), not something that could pass silently
// because no single test happened to assert against it.
const fs = require("fs");
const path = require("path");

const SENTINEL_PATH = path.join(__dirname, "..", "..", "test-results", "anthropic-call-detected.json");

function isAnthropicUrl(value) {
  try {
    const url = typeof value === "string" ? value : value?.url ?? String(value);
    return typeof url === "string" && url.includes("api.anthropic.com");
  } catch {
    return false;
  }
}

function recordViolation(url) {
  try {
    fs.mkdirSync(path.dirname(SENTINEL_PATH), { recursive: true });
    fs.writeFileSync(
      SENTINEL_PATH,
      JSON.stringify({ url, at: new Date().toISOString(), stack: new Error().stack }, null, 2),
    );
  } catch (writeErr) {
    // Still throw below even if we couldn't record the sentinel file.
    console.error("no-network-guard: failed to write sentinel file", writeErr);
  }
}

const realFetch = globalThis.fetch;
globalThis.fetch = function guardedFetch(input, init) {
  if (isAnthropicUrl(input)) {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    recordViolation(url);
    throw new Error(
      `no-network-guard: blocked a live call to the Anthropic API during e2e tests (${url}). ` +
        "The demo must only ever replay from the committed cache.",
    );
  }
  return realFetch.call(this, input, init);
};
