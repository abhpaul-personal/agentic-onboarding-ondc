import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The committed demo cache is fully warmed, so every step must replay. A
 * "Not warmed yet" card is a real failure here, not a reason to stop the test
 * early: an earlier version of these specs returned quietly on that card, which
 * is how a broken category step (set F) and GSTIN dead ends (sets A to D)
 * shipped with a green suite.
 */
export async function expectNotPending(page: Page) {
  await expect(page.getByText("Not warmed yet")).toHaveCount(0);
}

/**
 * Runs seller intake, then verification, then approves at G0. Every sample
 * seller except set C passes every check on its first attempt, so the Approve
 * button must be enabled; a disabled button here is a dead end for a visitor.
 */
export async function runIntakeVerifyAndApproveG0(page: Page) {
  await page.getByRole("button", { name: "Run seller intake agent" }).click();
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByRole("heading", { name: /G0/ })).toBeVisible();
  await expectNotPending(page);

  const approve = page.getByRole("button", { name: "Approve seller" });
  await expect(approve).toBeEnabled();
  await approve.click();
}

/**
 * Set C only: attempt 1 is the deliberate GSTIN misread. The real checksum
 * fails it, the reviewer cannot approve, Send back replays a second real
 * model run that reads the GSTIN correctly, and then the reviewer approves.
 */
export async function runIntakeFailSendBackRetryAndApproveG0(page: Page) {
  await page.getByRole("button", { name: "Run seller intake agent" }).click();
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByRole("heading", { name: /G0/ })).toBeVisible();

  // Attempt 1: the misread GSTIN fails the real checksum and blocks approval.
  await expect(page.getByRole("row").filter({ hasText: "GSTIN format and checksum" })).toContainText("Fail");
  await expect(page.getByRole("button", { name: "Approve seller" })).toBeDisabled();

  // Send back returns to intake for attempt 2 (not the manual correction panel).
  await page.getByRole("button", { name: "Send back" }).click();
  await expect(page.getByRole("heading", { name: /S1.*Seller intake agent/ })).toBeVisible();
  await expect(page.getByText(/Attempt 2\./)).toBeVisible();

  await page.getByRole("button", { name: /Run seller intake agent \(attempt 2\)/ }).click();
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByRole("heading", { name: /G0/ })).toBeVisible();
  await expectNotPending(page);

  // Attempt 2: same checks, now passing; the first attempt's failure stays in the audit log.
  await expect(page.getByRole("row").filter({ hasText: "GSTIN format and checksum" })).toContainText("Pass");
  await expect(page.getByText("sent back to seller intake for attempt 2")).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve seller" });
  await expect(approve).toBeEnabled();
  await approve.click();
}
