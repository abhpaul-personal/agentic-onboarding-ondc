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

/** Walks set F to the fallback queue, on the replayed cache, with no resolution yet. */
async function runSetFToQueue(page: import("@playwright/test").Page) {
  await page.goto("/demo");
  await page.getByText("Trapline Traders").click();
  await runIntakeVerifyAndApproveG0(page);

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();
  await page.getByRole("button", { name: "Approve mappings" }).click();
  await page.getByRole("button", { name: "Run category agent" }).click();
  await expectNotPending(page);
  await page.getByRole("button", { name: "Run validation" }).click();
  await expect(page.getByRole("heading", { name: /Fallback queue/ })).toBeVisible();
}

/**
 * Guardrail for a bug where pack_size's bare numbers ("500", "1000")
 * flooded the fallback queue with 34 false "net quantity could not be
 * parsed" issues: a human had already approved pack_size as net_quantity
 * at G2, so a unitless number there is grams, not ambiguous. Checked on
 * the fresh, unresolved validation result, matching how the scorecard
 * itself re-derives these numbers from the run.
 */
test("set F: fallback queue holds only the 7 real planted issues, and the scorecard shows 13 of 13 caught with 0 invented", async ({
  page,
}) => {
  await runSetFToQueue(page);

  // Exactly the 7 planted queue issues: 4 GTIN, 2 duplicate, 1 claim. No
  // net_qty_unparsed entries: pack_size's bare numbers are grams by the
  // reviewer-approved mapping, not ambiguous.
  await expect(page.getByText(/7 item\(s\) still open/)).toBeVisible();
  await expect(page.getByText(/could not be parsed into a standard unit/)).toHaveCount(0);

  await page.getByRole("button", { name: "Open the scorecard" }).click();
  await expect(page).toHaveURL(/\/scorecard\?run=/);

  await expect(page.getByText("13 of 13 planted errors caught")).toBeVisible();
  const inventedCard = page.getByText("Invented statutory values").locator("..");
  await expect(inventedCard.locator("b")).toHaveText("0");
});

test("set F: resolving the fallback queue in bulk routes to G3 with exactly the 9 real statutory issues", async ({ page }) => {
  await runSetFToQueue(page);

  // Bulk-resolve the two multi-item issue types, then the single claim by itself.
  await page.getByRole("button", { name: "Resolve all 4" }).click();
  await page.getByRole("button", { name: "Resolve all 2" }).click();
  await page
    .locator("div", { has: page.getByText("TRP-017") })
    .getByRole("button", { name: "Resolve" })
    .first()
    .click();

  await expect(page.getByText("All items resolved.")).toBeVisible();
  const finish = page.getByRole("button", { name: "Finish fallback queue" });
  await expect(finish).toBeEnabled();
  await finish.click();

  // G3: 3 third-party-packed items x 2 issues each (fssai, packer_missing),
  // plus 3 mrp_below_selling_price = 9.
  await expect(page.getByRole("heading", { name: /G3/ })).toBeVisible();
  await expect(page.getByText("9 statutory issue(s) still open.")).toBeVisible();
  const unbrandedPackerRows = page.getByText(/named packer/);
  await expect(unbrandedPackerRows).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Enter from label" }).first().click();
  }
  // The 3 mrp_below_selling_price issues need a real source-data correction
  // the demo doesn't offer, so sign-off stays disabled: that is the honest
  // outcome, not a bug to route around.
  await expect(page.getByText("3 statutory issue(s) still open.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign off statutory fields" })).toBeDisabled();
});
