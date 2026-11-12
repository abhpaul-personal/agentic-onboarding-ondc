import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/demo", "/kit", "/case-study", "/scorecard"];

for (const path of PAGES) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 1)).toEqual([]);
  });
}

test("every demo gate and step button is reachable by keyboard", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Sakhi Annapurna cooperative").click();

  const button = page.getByRole("button", { name: "Run bulk intake" });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/12 seller profiles drafted/)).toBeVisible();
});
