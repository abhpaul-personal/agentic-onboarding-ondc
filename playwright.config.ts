import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the demo site. Runs only against the
 * committed cache (no live model calls, no API key needed) — see
 * tests/e2e/README.md for which steps are exercised for real today
 * versus shown as a pending card until agents:warm has run.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
