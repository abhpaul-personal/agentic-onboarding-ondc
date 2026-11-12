import { test, expect } from "@playwright/test";
import { waitThenCheckPending } from "./helpers";

/** Set D (WhatsApp-style text, free-text extraction, always needs G1). See set-b.spec.ts for the cache-pending pattern. */
test("set D: WhatsApp text, free-text extraction and G1 confirmation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Butterleaf Home Bakery").click();
  await page.getByRole("button", { name: "Run seller intake agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /S2.*Verification agent/ }))) {
    await expect(page.getByText(/agents:warm/)).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "Run verification" }).click();
  await page.getByRole("button", { name: "Approve seller" }).click();
  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /G1/ }))) return;

  // Unstructured sources always need G1 (PRD): mapping and G2 should not appear for this set.
  await expect(page.getByRole("heading", { name: /G1.*Seller confirms/ })).toBeVisible();
  await expect(page.getByText("Smart mapping agent")).toHaveCount(0);
});
