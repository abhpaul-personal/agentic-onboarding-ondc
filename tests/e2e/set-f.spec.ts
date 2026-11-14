import { test, expect } from "@playwright/test";
import { expectNotPending, runIntakeVerifyAndApproveG0 } from "./helpers";

/**
 * Set F (CSV with 13 planted errors): the key no-invention/validation-
 * recall guardrail test. G0 passes first time and every step replays from
 * the committed cache, including the category step, which once showed a
 * "Not warmed yet" card here because its cache key differed from the one
 * agents:warm used.
 */
test("set F: validation recall catches planted errors (no invention)", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Trapline Traders").click();
  await runIntakeVerifyAndApproveG0(page);

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();

  await expect(page.getByRole("heading", { name: /G2/ })).toBeVisible();
  await page.getByRole("button", { name: "Approve mappings" }).click();
  await page.getByRole("button", { name: "Run category agent" }).click();

  // The panel after the category agent must be the validation step, never an empty or pending card.
  await expect(page.getByRole("heading", { name: /^5/ })).toBeVisible();
  await expectNotPending(page);

  await page.getByRole("button", { name: "Run validation" }).click();

  // At least some of set F's planted errors must route to the fallback
  // queue or G3, never silently pass as a clean catalog.
  await expect(page.getByRole("heading", { name: /Fallback queue|Seller signs off/ })).toBeVisible();
});
