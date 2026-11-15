import { existsSync, readFileSync, rmSync } from "fs";
import path from "path";

const SENTINEL_PATH = path.join(__dirname, "..", "..", "test-results", "anthropic-call-detected.json");

/**
 * Runs once after the whole e2e suite, regardless of which spec files ran.
 * no-network-guard.cjs (preloaded into the server process under test via
 * webServer.env.NODE_OPTIONS) writes this file the instant anything in the
 * app calls the real Anthropic API. Its absence is the actual guarantee
 * this project makes about the public demo; this makes a violation fail the
 * whole test run loudly, not just leave it unasserted.
 */
export default async function globalTeardown() {
  if (!existsSync(SENTINEL_PATH)) return;
  const detail = readFileSync(SENTINEL_PATH, "utf-8");
  rmSync(SENTINEL_PATH, { force: true });
  throw new Error(
    `A live call to the Anthropic API happened during the e2e run. The demo must only ever replay ` +
      `from the committed cache. Details:\n${detail}`,
  );
}
