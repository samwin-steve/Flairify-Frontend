import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("saved shopping preferences, optional wardrobe, relevant distinct occasion looks and checkout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Find my look" }).click();
  await page.getByLabel("What should we call you?").fill("Occasion QA");
  await page.getByLabel("Shopping department").selectOption("women");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("L");
  await page.getByLabel("Shoe size (EU)").selectOption("40");
  await page.getByLabel("Preferred store").selectOption("lower-parel");
  await expect(
    page.getByLabel("Pair recommendations with my wardrobe by default"),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Remember my optional style and colour preferences"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByRole("button", { name: "Start shopping without photos" })
    .click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Shopping mode: Shop new pieces" }),
  ).toBeVisible();
  await expect(page.locator(".conversation select")).toHaveCount(0);
  let sent: any;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/chat/stream"))
      sent = request.postDataJSON();
  });
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("I have independece day at office can you suggest some chothes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".look-card")).toHaveCount(3);
  expect(sent.include_wardrobe).toBe(false);
  for (const field of ["clothing_size", "shoe_size", "department"])
    expect(sent[field]).toBeUndefined();
  await expect(page.locator(".piece-label.owned")).toHaveCount(0);
  const heroes = await page
    .locator(".look-card .look-piece:first-child strong")
    .allTextContents();
  expect(new Set(heroes).size).toBe(heroes.length);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-occasion.png`,
    fullPage: true,
  });
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  expect(
    violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Shopping preferences", exact: true })
    .click();
  await expect(page.getByLabel("Shopping department")).toHaveValue("women");
  await expect(page.getByLabel("Clothing size", { exact: true })).toHaveValue(
    "L",
  );
  await expect(page.getByLabel("Preferred store")).toHaveValue("lower-parel");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("M");
  await page
    .getByLabel("Pair recommendations with my wardrobe by default")
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Shopping mode: With my wardrobe" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Shopping mode: With my wardrobe" })
    .click();
  await page
    .getByRole("button", { name: "New pieces Explore the catalogue" })
    .click();
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("Office shirts");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message.assistant")).toHaveCount(2);
  const latest = page.locator(".message.assistant").last();
  await expect(latest.locator(".look-card").first()).toBeVisible();
  await latest
    .getByRole("button", { name: "Buy", exact: true })
    .first()
    .click();
  const selection = page
    .locator(".checkout-item")
    .first()
    .getByRole("combobox")
    .first();
  await expect(selection).not.toHaveValue("");
  await expect(selection.locator("option:checked")).toContainText("M");
  await expect(page.getByRole("dialog")).toContainText("Confirm your sizes");
});
