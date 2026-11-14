import { test, expect } from "@playwright/test";
import { expectNotPending, runIntakeVerifyAndApproveG0 } from "./helpers";

/**
 * Set B (messy Excel, Hinglish headers). Every step replays from the
 * committed cache, and G0 passes first time, so this runs straight through
 * to the G2 mapping review. See helpers.ts for why nothing here stops early
 * on a "Not warmed yet" card.
 */
test("set B: messy Excel, header synonyms and price normalisation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Rambhau Kirana Stores").click();
  await runIntakeVerifyAndApproveG0(page);

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();

  await expect(page.getByRole("heading", { name: /G2/ })).toBeVisible();
  await expectNotPending(page);

  // "M.R.P (Rs)" is a real header in set B's raw file: it should map to a price attribute.
  // Scoped to the mapping table's row (not .getByText, which also matches the reasoning
  // prose column that repeats the header name).
  await expect(page.getByRole("row").filter({ hasText: "M.R.P (Rs)" })).toBeVisible();
});
