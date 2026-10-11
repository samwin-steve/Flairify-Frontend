import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("wardrobe-first journey, budget, saved look, unavailable try-on and refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A wardrobe full/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Meet your personal stylist" })
    .click();
  await page.getByLabel("What should we call you?").fill("Asha");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("M");
  await page.getByLabel("Shoe size (EU)").selectOption("39");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByRole("button", { name: "Add reference photos later" })
    .click();
  await page
    .getByRole("button", { name: "Explore with a sample wardrobe" })
    .click();
  await expect(
    page.getByRole("button", { name: "Meet your stylist", exact: true }),
  ).toBeDisabled();
  const confirms = page.getByRole("button", {
    name: "Confirm ownership",
    exact: true,
  });
  for (let remaining = 4; remaining > 0; remaining--) {
    await confirms.first().click();
    await expect(confirms).toHaveCount(remaining - 1);
  }
  await page
    .getByRole("button", { name: "Meet your stylist", exact: true })
    .click();
  await page.getByRole("button", { name: /Help me pack for Mumbai/ }).click();
  await expect(page.locator(".look-card").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-stylist.png`,
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const total = await page.locator(".look-footer strong").first().innerText();
  expect(Number(total.replace(/[^0-9]/g, ""))).toBeLessThanOrEqual(5000);
  await page
    .getByRole("button", { name: "Save look", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "saved for later" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "See it on me", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Request preview" }).click();
  await expect(
    page.getByText(/Personalized generation is not connected/),
  ).toBeVisible({ timeout: 15000 });
  await page.reload();
  const fitting = page.getByRole("button", {
    name: "Fitting Room",
    exact: true,
  });
  if (await fitting.isVisible()) await fitting.click();
  else await page.getByRole("button", { name: "Fitting", exact: true }).click();
  await expect(
    page.getByText(/Personalized generation is not connected/),
  ).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-fitting.png`,
    fullPage: true,
  });
});

test("landing accessibility, keyboard focus and layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A wardrobe full/ }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-landing.png`,
    fullPage: true,
  });
});
