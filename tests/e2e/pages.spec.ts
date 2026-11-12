import { test, expect } from "@playwright/test";

test("landing page shows the problem statement and nav", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ONDC");
  await expect(page.getByRole("link", { name: "Run the demo" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the case study" })).toBeVisible();
});

test("kit page lists all seven sets with working download links", async ({ page, request }) => {
  await page.goto("/kit");
  for (const id of ["A", "B", "C", "D", "E", "F", "G"]) {
    await expect(page.getByRole("cell", { name: id, exact: true })).toBeVisible();
  }
  const zipHref = await page.getByRole("link", { name: "Download the full kit (.zip)" }).getAttribute("href");
  expect(zipHref).toBeTruthy();
  const res = await request.get(zipHref!);
  expect(res.status()).toBe(200);
});

test("case study page links the PRD, demo and kit", async ({ page }) => {
  await page.goto("/case-study");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Agentic Onboarding");
  await expect(page.getByRole("link", { name: "Full PRD" })).toHaveAttribute("href", /docs\/PRD\.md/);
});

test("scorecard page without a run shows the placeholder", async ({ page }) => {
  await page.goto("/scorecard");
  await expect(page.getByText(/Finish a run in "Run the demo"/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Run the demo" })).toBeVisible();
});

test("footer appears on every page with the required disclaimer", async ({ page }) => {
  for (const path of ["/", "/demo", "/scorecard", "/kit", "/case-study"]) {
    await page.goto(path);
    await expect(page.getByText(/Personal case-study project\. Not affiliated with ONDC/)).toBeVisible();
  }
});
