import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("wardrobe-first journey, budget, saved look, sign-in-required try-on and refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A wardrobe full/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore sample demo" }).click();
  await page.getByLabel("What should we call you?").fill("Asha");
  await expect(
    page.getByLabel("Keep my generated outfits in the same background"),
  ).not.toBeChecked();
  await page
    .getByLabel("Keep my generated outfits in the same background")
    .check();
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
  await expect(page.locator(".look-card").first()).toBeVisible({
    timeout: 45000,
  });
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
  const look = page.locator(".look-card").first();
  await expect(
    look.getByRole("button", { name: "See it on me", exact: true }),
  ).toBeDisabled();
  await expect(look.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  await look.getByRole("checkbox").first().check();
  await look.getByRole("button", { name: "See it on me", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in for real previews" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Buy", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Only new pieces from this look are included.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel(
      "I confirm the items, sizes and quantities.",
    )
    .check();
  await page
    .getByRole("button", { name: "Buy", exact: true })
    .click();
  await expect(page.locator(".order-card")).toContainText("From the stylist");
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  const fitting = page.getByRole("button", {
    name: "Fitting Room",
    exact: true,
  });
  if (await fitting.isVisible()) await fitting.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Fitting Room", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Browse inventory" }),
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

test("direct photo upload, ownership review, persistence and 3D fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample demo" }).click();
  await page.getByLabel("What should we call you?").fill("Photo QA");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("M");
  await page.getByLabel("Shoe size (EU)").selectOption("39");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByRole("button", { name: "Add reference photos later" })
    .click();
  await page
    .getByLabel("Upload wardrobe photos")
    .setInputFiles("public/images/shirt.jpg");
  await expect(
    page.getByRole("button", { name: "Save person selection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save person selection" }).click();
  await page.getByRole("button", { name: "Review my wardrobe" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm ownership", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Confirm ownership", exact: true })
    .click();
  await page
    .getByLabel("Garment name", { exact: true })
    .fill("My uploaded shirt");
  await page.getByLabel("Category", { exact: true }).selectOption("top");
  await page.getByLabel("Colour", { exact: true }).fill("White");
  await page.getByLabel("I own this garment").check();
  await page.getByRole("button", { name: "Save garment" }).click();
  await page
    .getByRole("button", { name: "Meet your stylist", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your wardrobe is ready." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  const wardrobe = page.getByRole("button", {
    name: /^My Wardrobe/,
  });
  if (await wardrobe.isVisible()) await wardrobe.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^My Wardrobe/ }).click();
  }
  await expect(
    page.getByRole("button", { name: "My uploaded shirt", exact: true }),
  ).toBeVisible();
  const fitting = page.getByRole("button", {
    name: "Fitting Room",
    exact: true,
  });
  if (await fitting.isVisible()) await fitting.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Fitting Room", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "3D / AR lab" }).click();
  await expect(page.locator("model-viewer")).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      () =>
        page
          .locator("model-viewer")
          .evaluate((el) => (el as HTMLElement & { loaded: boolean }).loaded),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(page.getByText("Experimental · sample asset")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-3d.png`,
    fullPage: true,
  });
});

test("inventory lists available products and requests sign-in for real previews", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample demo" }).click();
  await page.getByLabel("What should we call you?").fill("Inventory QA");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("M");
  await page.getByLabel("Shoe size (EU)").selectOption("39");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByRole("button", { name: "Add reference photos later" })
    .click();
  await page
    .getByRole("button", { name: "Explore with a sample wardrobe" })
    .click();
  await page
    .getByRole("button", { name: "Confirm ownership", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Meet your stylist", exact: true })
    .click();
  await expect(page.locator(".app-shell")).toBeVisible();
  const inventory = page.getByRole("button", { name: "Inventory", exact: true }).filter({ visible: true });
  if (await inventory.count()) await inventory.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Inventory", exact: true }).click();
  }
  await expect(page.locator(".inventory-card")).toHaveCount(24);
  await page.getByLabel("Search inventory").fill("A fresh white shirt");
  await expect(page.locator(".inventory-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Try this on", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in for real previews" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
});
