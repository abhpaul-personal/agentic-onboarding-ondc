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
