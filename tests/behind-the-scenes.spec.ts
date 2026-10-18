import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function navigate(page: Page, name: string) {
  const button = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name, exact: true }).filter({ visible: true });
  if (await button.count()) await button.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
  }
}

async function fixture(page: Page) {
  await page.addInitScript(() => localStorage.setItem("flairify-token", "journey-demo"));
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
  await navigate(page, "Behind the scenes!");
  await expect(page.getByRole("heading", { name: "From a thought to a look." })).toBeVisible();
}

test("the local journey plays, pauses, branches and resets without backend mutations", async ({ page }) => {
  await fixture(page);
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET") mutations.push(request.url());
  });
  await page.screenshot({ path: `test-results/${test.info().project.name}-behind-scenes-ready.png`, fullPage: true });
  await page.clock.install();
  await page.getByRole("button", { name: "Play journey", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A quick safety check" })).toBeVisible();
  await page.clock.runFor(2300);
  await expect(page.getByRole("heading", { name: "Meet your stylist" })).toBeVisible();
  await page.getByRole("button", { name: "Pause journey" }).click();
  await page.clock.runFor(5000);
  await expect(page.getByRole("heading", { name: "Meet your stylist" })).toBeVisible();
  await page.getByRole("button", { name: "Step 4: Two branches, one personal search" }).click();
  await expect(page.locator("svg text").filter({ hasText: "Embed intent" })).toBeVisible();
  await expect(page.locator("svg text").filter({ hasText: "Read wardrobe + sizes" })).toBeVisible();
  await page.getByRole("button", { name: "Explore Firestore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Firestore", exact: true })).toBeVisible();
  await expect(page.getByText("Catalogue retrieval · account context · result persistence")).toBeVisible();
  await page.getByRole("button", { name: "Resume journey" }).click();
  // Let React commit each step before advancing its next effect timer.
  for (let index = 4; index < 14; index++) {
    await page.clock.runFor(2200);
    await expect(page.getByRole("button", { name: new RegExp(`^Step ${index + 1}:`) })).toHaveAttribute("aria-current", "step");
  }
  await page.clock.runFor(2200);
  await expect(page.getByRole("button", { name: "Replay journey" })).toBeVisible();
  await expect(page.getByText("Looks ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByRole("heading", { name: "A quick safety check" })).toBeVisible();
  await page.getByRole("button", { name: "Reset journey" }).click();
  await expect(page.getByRole("heading", { name: "Follow the little spark." })).toBeVisible();
  expect(mutations).toEqual([]);
});

test("node exploration is accessible, contained on small screens and cleans up on navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Explore Stylist agent" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Vertex AI · gemini-3.8-flash", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play journey", exact: true }).click();
  await page.getByRole("button", { name: "Step 7: Connect it to your wardrobe" }).click();
  await page.screenshot({ path: `test-results/${test.info().project.name}-behind-scenes-graph.png`, fullPage: true });
  await page.getByRole("button", { name: "Resume journey" }).click();
  await navigate(page, "Stylist");
  await expect(page.getByRole("region", { name: "Interactive GCP recommendation journey" })).toHaveCount(0);
  await navigate(page, "Behind the scenes!");
  await expect(page.getByRole("button", { name: "Play journey", exact: true })).toBeVisible();
  await expect(page.getByText("Ready when you are", { exact: true })).toBeVisible();
});
