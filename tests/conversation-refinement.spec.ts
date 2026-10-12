import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("continue a chat, explain a look, replace only shoes and restore history", async ({
  page,
  request,
}) => {
  const identity = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + identity.token };
  await request.put("/api/profile", {
    headers,
    data: {
      name: "Asha",
      department: "men",
      clothing_size: "M",
      shoe_size: "39",
      preferred_store_id: "bandra",
      budget: 5000,
    },
  });
  await request.post("/api/onboarding/complete", { headers });
  await page.addInitScript(
    (token) => localStorage.setItem("flairify-token", token),
    identity.token,
  );
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Message your stylist" });
  await expect(
    page.getByRole("button", { name: "Shopping mode: Shop new pieces" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Shopping mode: Shop new pieces" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "My wardrobe + new Include matching pieces I own",
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Shopping mode: Shop new pieces" }),
  ).toBeFocused();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-stylist-welcome.png`,
    fullPage: true,
  });
  await input.fill("A smart outfit for the office under ₹5,000");
  let finished = page.waitForResponse((r) =>
    r.url().endsWith("/api/chat/stream"),
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await finished;
  await expect(page.locator(".look-card")).toHaveCount(3);
  let conversations = (
    await (await request.get("/api/conversations", { headers })).json()
  ).conversations;
  const first = conversations[0];
  const chosen = first.messages[1].outfits[1];
  await page.reload();
  await expect(page.locator(".look-card")).toHaveCount(3);
  await input.fill("Why does the second look work?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message.assistant")).toHaveCount(2);
  await expect(page.locator(".message.assistant").last()).toContainText(
    chosen.title,
  );
  await expect(page.locator(".look-card")).toHaveCount(3);
  await page
    .locator(".look-card")
    .nth(1)
    .getByRole("button", { name: /Refine this look/ })
    .click();
  await expect(page.locator(".refinement-context")).toContainText(chosen.title);
  await input.fill("Keep the shirt and trousers, but swap the shoes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.locator(".message.assistant").last().locator(".look-card").first(),
  ).toBeVisible();
  conversations = (
    await (await request.get("/api/conversations", { headers })).json()
  ).conversations;
  expect(conversations).toHaveLength(1);
  const updated = conversations[0];
  expect(updated.messages).toHaveLength(6);
  const kept = chosen.products
    .filter((p: any) => p.category !== "shoes")
    .map((p: any) => p.id);
  const originalShoe = chosen.products.find(
    (p: any) => p.category === "shoes",
  ).id;
  for (const look of updated.messages[5].outfits) {
    const ids = look.products.map((p: any) => p.id);
    expect(ids).toEqual(expect.arrayContaining(kept));
    expect(ids).not.toContain(originalShoe);
    expect(look.total).toBeLessThanOrEqual(5000);
  }
  expect(updated.messages[5].outfits.length).toBeGreaterThan(0);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-stylist-followup.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".stylist-aura i")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await expect(page.locator(".message.assistant")).toHaveCount(3);
  const fresh = page
    .getByRole("button", { name: "New conversation" })
    .filter({ visible: true });
  if (!(await fresh.count()))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "New conversation" })
    .filter({ visible: true })
    .click();
  await expect(page.locator(".message")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".message")).toHaveCount(0);
});
