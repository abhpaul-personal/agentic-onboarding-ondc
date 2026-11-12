import { test, expect } from "@playwright/test";
import { waitThenCheckPending } from "./helpers";

/** Set C (Fashion, Shopify-style export with size/colour variants). See set-b.spec.ts for the cache-pending pattern. */
test("set C: Shopify-style export, variant handling", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Neelkurinji Threads").click();
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

  // "Option1 Value" (size) and "Option2 Value" (colour) are real headers in set C's export.
  await expect(page.getByText("Option1 Value")).toBeVisible();
  await expect(page.getByText("Option2 Value")).toBeVisible();
});
