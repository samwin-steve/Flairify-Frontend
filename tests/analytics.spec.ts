import { test, expect, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  const label = new RegExp("^" + name + "(?: \\d+)?$");
  const button = page.getByRole("button", { name: label }).filter({ visible: true });
  if (await button.count()) await button.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: label }).click();
  }
}

async function fixture(page: Page) {
  await page.addInitScript(() => localStorage.setItem("flairify-token", "analytics-demo"));
  await page.route("**/config", (route) => route.fulfill({ json: { firebase: {} } }));
  await page.route("**/api/**", (route) => {
    const responses: Record<string, unknown> = {
      "/api/config": { mode: "demo", firebase: {}, try_on: false },
      "/api/profile": { name: "Demo", clothing_size: "M", shoe_size: "39", onboarding_complete: true, demo: true, styles: [], colours: [], consent: {} },
      "/api/conversations": { conversations: [] },
      "/api/wardrobe": { items: [], duplicates: [] },
      "/api/photos": { photos: [], references: [] },
      "/api/stores": { stores: [] },
      "/api/saved": { looks: [] },
      "/api/jobs": { jobs: [] },
    };
    return route.fulfill({ json: responses[new URL(route.request().url()).pathname] || {} });
  });
  await page.goto("/");
}

test("analytics filters, drop-offs and daily report work", async ({ page }) => {
  await fixture(page);
  await navigate(page, "Analytics");
  await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
  await expect(page.getByText("Preparing summary…")).toBeVisible();
  await expect(page.getByText("Feature summer workwear within this price range.")).toBeVisible();
  await expect(page.getByText("320 assisted sessions")).toBeVisible();
  await page.getByRole("button", { name: "184 without checkout" }).click();
  await expect(page.getByText("Still browsing", { exact: true })).toBeVisible();
  await page.getByLabel("Store", { exact: true }).selectOption("studio");
  await expect(page.getByText("180 assisted sessions")).toBeVisible();
  await page.getByLabel("Date range").selectOption("7");
  await expect(page.getByText("42 assisted sessions")).toBeVisible();
  await page.getByRole("button", { name: "Refresh daily report" }).click();
  await expect(page.getByRole("status")).toHaveText("Preparing summary…");
  await expect(page.getByRole("button", { name: "Refresh daily report" })).toBeDisabled();
  await expect(page.getByText("Feature summer workwear within this price range.")).toBeVisible();
  await page.getByLabel("Store", { exact: true }).selectOption("all");
  await page.getByLabel("Date range").selectOption("30");
  await page.getByRole("button", { name: "60 without options" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `test-results/${test.info().project.name}-analytics.png`, fullPage: true });
});
