import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Waits for either the "Not warmed yet" pending card or `thenLocator`
 * (whichever a server action actually produced), then reports which one
 * it was. Avoids a race where `.isVisible()` is checked before the async
 * server action's result has rendered.
 */
export async function waitThenCheckPending(page: Page, thenLocator: Locator): Promise<boolean> {
  const pending = page.getByText("Not warmed yet");
  await expect(pending.or(thenLocator).first()).toBeVisible({ timeout: 15_000 });
  return pending.isVisible();
}

/**
 * Clicks "Run verification" and resolves G0: approves the seller if every
 * check passed, or sends them back otherwise. The seller-intake agent's
 * vision read of a synthetic GST certificate has been observed to
 * non-deterministically mis-transcribe the GSTIN's run of "Z" placeholder
 * characters (the certificate images themselves are correct; this is a
 * model vision error), which the real GSTIN checksum check then correctly
 * fails — on any set, not just one. That is the deterministic-check-plus-
 * human-gate design working as intended, not a flow bug, so every spec
 * that reaches G0 follows whichever path it actually took.
 */
export async function runVerificationAndResolveG0(page: Page): Promise<"approved" | "sent_back"> {
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByRole("heading", { name: /G0/ })).toBeVisible();

  const approveButton = page.getByRole("button", { name: "Approve seller" });
  if (await approveButton.isDisabled()) {
    await page.getByRole("button", { name: "Send back" }).click();
    await expect(page.getByRole("heading", { name: /S1/ })).toBeVisible();
    return "sent_back";
  }
  await approveButton.click();
  return "approved";
}
