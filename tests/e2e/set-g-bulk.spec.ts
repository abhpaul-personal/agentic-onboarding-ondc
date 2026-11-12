import { test, expect } from "@playwright/test";

/**
 * Set G's bulk Stage 1 flow is fully deterministic (no model call), so
 * this runs against real logic end to end, including the scorecard.
 */
test("set G: bulk seller onboarding catches both planted errors and scores correctly", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Sakhi Annapurna cooperative").click();

  await page.getByRole("button", { name: "Run bulk intake" }).click();
  await expect(page.getByText(/12 seller profiles drafted/)).toBeVisible();

  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByRole("cell", { name: "GSTIN format and checksum" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "FSSAI licence in date" })).toBeVisible();

  await page.getByRole("button", { name: /Approve 10, send back 2/ }).click();
  await expect(page.getByText("Stage 1 complete")).toBeVisible();
  await expect(page.getByText(/10 sellers are approved/)).toBeVisible();

  await page.getByRole("button", { name: "Open the scorecard" }).click();
  await expect(page).toHaveURL(/\/scorecard\?run=/);
  await expect(page.getByText("2 / 12")).toBeVisible();
  await expect(page.getByText("Planted seller errors caught at verification")).toBeVisible();
});
