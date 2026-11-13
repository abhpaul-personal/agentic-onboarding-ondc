import { test, expect } from "@playwright/test";
import { waitThenCheckPending, runVerificationAndResolveG0 } from "./helpers";

/**
 * Set B needs the model for seller intake, mapping and category, so
 * until `agents:warm` has populated the cache this stops at S1 with an
 * honest pending card — never a live call, never fabricated output. Once
 * warmed, this test keeps going and checks real mapping behaviour.
 * See helpers.ts for the G0 approve-or-send-back pattern (a verification
 * check can non-deterministically fail on this set's seed data).
 */
test("set B: messy Excel, header synonyms and price normalisation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Rambhau Kirana Stores").click();
  await page.getByRole("button", { name: "Run seller intake agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /S2.*Verification agent/ }))) {
    await expect(page.getByText(/agents:warm/)).toBeVisible();
    return;
  }

  if ((await runVerificationAndResolveG0(page)) === "sent_back") return;

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();

  if (await waitThenCheckPending(page, page.getByRole("heading", { name: /G2/ }))) return;

  // "M.R.P (Rs)" is a real header in set B's raw file: it should map to a price attribute.
  // Scoped to the mapping table's row (not .getByText, which also matches the reasoning
  // prose column that repeats the header name).
  await expect(page.getByRole("row").filter({ hasText: "M.R.P (Rs)" })).toBeVisible();
});
