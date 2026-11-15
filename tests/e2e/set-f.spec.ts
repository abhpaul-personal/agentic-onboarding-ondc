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
  await expect(page.getByText("3 statutory issue(s) still open.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign off statutory fields" })).toBeDisabled();

  // The 3 remaining mrp_below_selling_price issues each get resolved with the
  // prefilled "correct the selling price" default (MRP minus 5).
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Use this price" }).first().click();
  }
  await expect(page.getByText("All statutory fields resolved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign off statutory fields" })).toBeEnabled();
});

/**
 * Previously a dead end: set F's 3 mrp_below_selling_price issues had no
 * resolution path anywhere in the app, so G3 sign-off (and therefore build,
 * G4 and publish) could never complete for this set through the UI.
 */
test("set F: resolving MRP issues at G3 completes the run through build, G4 and publish", async ({ page }) => {
  await runSetFToQueue(page);

  await page.getByRole("button", { name: "Resolve all 4" }).click();
  await page.getByRole("button", { name: "Resolve all 2" }).click();
  await page
    .locator("div", { has: page.getByText("TRP-017") })
    .getByRole("button", { name: "Resolve" })
    .first()
    .click();
  await page.getByRole("button", { name: "Finish fallback queue" }).click();

  await expect(page.getByRole("heading", { name: /G3/ })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Enter from label" }).first().click();
  }

  // Resolve each mrp issue with a different one of the three paths: correct
  // the selling price, correct the MRP, and remove the item.
  const mrpSection = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "Selling price above MRP", level: 4 }) })
    .last();
  const mrpRows = mrpSection.locator("> div");
  await expect(mrpRows).toHaveCount(3);

  await mrpRows.nth(0).getByRole("button", { name: "Use this price" }).click();
  await expect(mrpRows).toHaveCount(2);

  const mrpInput = mrpRows.nth(0).getByLabel("Correct MRP");
  await mrpInput.fill("500");
  await mrpRows.nth(0).getByRole("button", { name: "Use this MRP" }).click();
  await expect(mrpRows).toHaveCount(1);

  await mrpRows.nth(0).getByRole("button", { name: "Remove item" }).click();
  await expect(mrpRows).toHaveCount(0);

  await expect(page.getByText("All statutory fields resolved.")).toBeVisible();
  await page.getByRole("button", { name: "Sign off statutory fields" }).click();

  await expect(page.getByRole("heading", { name: /Catalog builder/ })).toBeVisible();
  // Two drop'd duplicate rows (TRP-009 and TRP-021 each appeared twice) plus
  // the one item removed for its MRP issue leaves the rest of set F's rows.
  const itemsText = await page.getByText(/Builds the ONDC catalog JSON for \d+ items/).textContent();
  const itemCount = Number(itemsText?.match(/for (\d+) items/)?.[1]);
  expect(itemCount).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Build catalog" }).click();

  await expect(page.getByRole("heading", { name: /G4/ })).toBeVisible();
  await page.getByRole("button", { name: /Reviewer: publish pilot phase/ }).click();
  await page.getByRole("button", { name: /Seller: approve the full catalog/ }).click();

  await expect(page.getByRole("heading", { name: /Publish and monitor/ })).toBeVisible();
  await page.getByRole("button", { name: "Publish full catalog" }).click();

  await expect(page.getByText("is live on the mock seller app")).toBeVisible();
  await expect(page.getByText(`${itemCount} items published`)).toBeVisible();
});
