import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function start(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample demo" }).click();
  await page.getByRole("button", { name: "Browse clothes first" }).click();
  await expect(
    page.getByRole("heading", { name: "Find your next favourite." }),
  ).toBeVisible();
}
async function navigate(page: import("@playwright/test").Page, name: string) {
  await expect(page.locator(".app-shell")).toBeVisible();
  const button = page
    .getByRole("button", { name, exact: true })
    .filter({ visible: true });
  if (await button.count()) await button.click();
  else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: true })
      .click();
  }
}

test("direct mock purchase without wardrobe saves order and no payment", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Mock buy", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your mock checkout" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place mock order", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(/^Quantity for/).selectOption("2");
  await page
    .getByLabel(
      "I understand this is a mock order with no payment or delivery.",
    )
    .check();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-checkout.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Place mock order", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "My orders." })).toBeVisible();
  await expect(page.locator(".order-card")).toHaveCount(1);
  await expect(page.locator(".order-card")).toContainText("Qty 2");
  await page.reload();
  await navigate(page, "My Orders");
  await expect(page.locator(".order-card")).toHaveCount(1);
  const data = await page.evaluate(async () => {
    const headers = {
      Authorization: "Bearer " + localStorage.getItem("flairify-token"),
    };
    return (await fetch("/api/wardrobe", { headers })).json();
  });
  expect(data.items).toEqual([]);
});

test("seller can add photographed clothes, update stock, index and receive mock orders", async ({
  page,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    "Local demo administrator access is deliberately disabled in the deployed app.",
  );
  await start(page);
  await page.getByRole("button", { name: "Sell on Flairify" }).click();
  await page.getByLabel("Demo administrator key").fill("test-admin-key");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Add clothes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add clothes", exact: true }).click();
  await page
    .getByLabel("Product photo", { exact: true })
    .setInputFiles("public/images/shirt.jpg");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Seller QA white shirt");
  await page.getByLabel("SKU", { exact: true }).fill("QA-SHIRT-01");
  await page.getByLabel("Price (INR)", { exact: true }).fill("799");
  await page.getByLabel("Colour", { exact: true }).fill("White");
  await page
    .getByRole("combobox", { name: "Store", exact: true })
    .selectOption("bandra");
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption("men");
  await page.getByLabel("Stock quantity", { exact: true }).fill("3");
  await expect(
    page.getByRole("img", { name: "Product photo", exact: true }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-seller-form.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save and index listing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .locator(".inventory-card")
      .filter({ hasText: "Seller QA white shirt" }),
  ).toContainText("Searchable");
  await navigate(page, "Inventory");
  await page.getByLabel("Search inventory").fill("Seller QA white shirt");
  await expect(page.locator(".inventory-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Mock buy", exact: true }).click();
  await page
    .getByLabel(
      "I understand this is a mock order with no payment or delivery.",
    )
    .check();
  await page
    .getByRole("button", { name: "Place mock order", exact: true })
    .click();
  await expect(page.locator(".order-card")).toContainText("₹799");
  await navigate(page, "Seller Studio");
  await expect(page.locator(".order-card")).toContainText(
    "Seller QA white shirt",
  );
  const listing = page
    .locator(".inventory-card")
    .filter({ hasText: "Seller QA white shirt" });
  await listing.getByRole("button", { name: "Edit listing" }).click();
  await page.getByLabel("Stock quantity", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save and index listing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Inventory");
  await page.getByLabel("Search inventory").fill("Seller QA white shirt");
  await expect(page.locator(".inventory-card")).toHaveCount(0);
});

test("expanded catalogue filters departments, shows more, and has valid photos", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator(".inventory-card")).toHaveCount(24);
  await expect(page.getByRole("status")).toContainText("189 pieces");
  await page.getByRole("button", { name: "Show more clothes" }).click();
  await expect(page.locator(".inventory-card")).toHaveCount(48);
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption("men");
  await expect(page.locator(".inventory-card")).toHaveCount(24);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("top");
  await expect(page.getByRole("status")).toContainText("23 pieces");
  await expect(page.locator(".inventory-card").first()).toContainText("4XL");
  const labels = await page
    .locator(".inventory-card .eyebrow")
    .allTextContents();
  expect(
    labels.every(
      (label) => label.startsWith("men") || label.startsWith("unisex"),
    ),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Department", exact: true })
    .selectOption("women");
  await page.getByLabel("Search inventory").fill("Athena");
  await expect(page.locator(".inventory-card")).toHaveCount(1);
  const image = page.locator(".inventory-card img");
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      image.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 200,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-expanded-catalogue.png`,
    fullPage: true,
  });
});
