import { test, expect } from "@playwright/test";
import { expectNotPending, runIntakeFailSendBackRetryAndApproveG0 } from "./helpers";

/**
 * Set C (Fashion, Shopify-style export with size/colour variants) is also the
 * one set where the seller-intake agent deliberately misreads the GSTIN on its
 * first attempt. The real checksum fails it, Send back replays the retry, and
 * only then can the reviewer approve and carry on to the mapping review.
 */
test("set C: GSTIN misread caught, Send back retry, then variant handling", async ({ page }) => {
  await page.goto("/demo");
  // The picker card must tell a visitor this failure is a deliberate replay
  // of an earlier prompt version, not a live model call that might misread
  // any seller's GSTIN.
  await expect(page.getByText(/deliberately replayed GSTIN misread \(an earlier prompt version\)/)).toBeVisible();
  await page.getByText("Neelkurinji Threads").click();
  await runIntakeFailSendBackRetryAndApproveG0(page);

  await page.getByRole("button", { name: "Run source intake agent" }).click();
  await page.getByRole("button", { name: "Run extraction agent" }).click();
  await page.getByRole("button", { name: "Run mapping agent" }).click();

  await expect(page.getByRole("heading", { name: /G2/ })).toBeVisible();
  await expectNotPending(page);

  // "Option1 Value" (size) and "Option2 Value" (colour) are real headers in set C's export.
  // Matched on the column-name cell's exact text, not row text content: the
  // "Option1 Name" row's reasoning prose also mentions "Option1 Value" in passing
  // ("the companion \"Option1 Value\" column"), which a substring filter would match too.
  await expect(page.getByRole("row").filter({ has: page.getByText("Option1 Value", { exact: true }) })).toBeVisible();
  await expect(page.getByRole("row").filter({ has: page.getByText("Option2 Value", { exact: true }) })).toBeVisible();
});
