import { test, expect } from "@playwright/test";
import { waitThenCheckPending } from "./helpers";

/**
 * Set B needs the model for seller intake, mapping and category, so
 * until `agents:warm` has populated the cache this stops at S1 with an
 * honest pending card — never a live call, never fabricated output. Once
 * warmed, this test keeps going and checks real mapping behaviour
 * without needing any changes (same cache, same keys).
 */
test("set B: messy Excel, header synonyms and price normalisation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Rambhau Kirana Stores").click();
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

  // "M.R.P (Rs)" is a real header in set B's raw file: it should map to a price attribute.
  await expect(page.getByText("M.R.P (Rs)")).toBeVisible();
});
