import { rmSync } from "fs";
import path from "path";

const SENTINEL_PATH = path.join(__dirname, "..", "..", "test-results", "anthropic-call-detected.json");

/** Clears any sentinel left over from a previous run, so global-teardown.ts only ever reports this run's own violations. */
export default async function globalSetup() {
  rmSync(SENTINEL_PATH, { force: true });
}
