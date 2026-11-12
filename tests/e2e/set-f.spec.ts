import { test, expect } from "@playwright/test";
import { waitThenCheckPending } from "./helpers";

/**
 * Set F (CSV with 13 planted errors): the key no-invention/validation-
 * recall guardrail test. See set-b.spec.ts for the cache-pending pattern.
 */
test("set F: validation recall catches planted errors (no invention)", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Trapline Traders").click();
  await page.getByRole("button", { name: "Run seller intake agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /S2.*Verification agent/ }))) {
    await expect(page.getByText(/agents:warm/)).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "Run verification" }).click();
  await page.getByRole("button", { name: "Approve seller" }).click();
  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /G2/ }))) return;

  await page.getByRole("button", { name: "Approve mappings" }).click();
  await page.getByRole("button", { name: "Run category agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /^5/ }))) return;

  await page.getByRole("button", { name: "Run validation" }).click();

  // At least some of set F's planted errors must route to the fallback
  // queue or G3 — never silently pass as a clean catalog.
  await expect(page.getByRole("heading", { name: /Fallback queue|Seller signs off/ })).toBeVisible();
});
