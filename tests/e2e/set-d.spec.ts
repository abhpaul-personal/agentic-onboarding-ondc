import { test, expect } from "@playwright/test";
import { expectNotPending, runIntakeVerifyAndApproveG0 } from "./helpers";

/**
 * Set D (WhatsApp-style text, free-text extraction, always needs G1). G0
 * passes first time and every step replays from the committed cache.
 */
test("set D: WhatsApp text, free-text extraction and G1 confirmation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Butterleaf Home Bakery").click();
  await runIntakeVerifyAndApproveG0(page);

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();

  // Unstructured sources always need G1 (PRD): mapping and G2 should not appear for this set.
  await expect(page.getByRole("heading", { name: /G1.*Seller confirms/ })).toBeVisible();
  await expectNotPending(page);
  await expect(page.getByText("Smart mapping agent")).toHaveCount(0);
});
