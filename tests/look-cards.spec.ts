import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function product(id: string, name: string, category: string, colour: string, price: number) {
  return {
    id, name, category, price, currency: "INR", brand: "Studio", description: name,
    sku: id, image: "/images/shirt.jpg", attributes: {}, ai_attributes: {},
    variants: [{ id: id + "-m", size: "M", colour, stock: [{ store_id: "studio", quantity: 7 }] }],
    availability: { variant_id: id + "-m", size: "M", store_id: "studio", quantity: 7 },
    store: { id: "studio", name: "Studio store", address: "12 High Street", sample: false },
    delivery: ["Delivery available"], try_on_supported: true, active: true, sample: false,
  };
}

async function fixture(page: Page, unavailableLayer = false) {
  const shoes = product("shoes", "Everyday walking sneakers", "shoes", "White", 1890);
  const layer = product("layer", "The relaxed overshirt", "jacket", "Sage", 1790);
  if (unavailableLayer) {
    layer.availability.quantity = 0;
    layer.variants[0].stock[0].quantity = 0;
  }
  const blazer = product("blazer", "The everyday blazer", "jacket", "Grey", 2490);
  const dress = {
    id: "dress", name: "Striped midi dress", category: "dress", colour: "Beige", pattern: "Striped",
    image: "/images/shirt.jpg", confirmed: true, sample: true,
  };
  const outfits = [layer, blazer].map((p, index) => ({
    id: "look-" + index, title: "A little polish, a lot of possibility", occasion: "Party",
    owned: [dress], products: [shoes, p], total: shoes.price + p.price,
    explanation: `Build around ${dress.name}. Add ${shoes.name}; ${p.name}.`,
    complete: true, sample: false,
  }));
  let profile = {
    name: "Asha", clothing_size: "M", shoe_size: "39", department: "women",
    fit: "Comfortable", budget: 5000, styles: [], colours: [], preferred_store_id: null,
    include_wardrobe: true, keep_background: false, onboarding_complete: true,
    consent: { remember_preferences: false, ai_photo_processing: true },
    demo: false, admin: false, seller: false,
  };
  const state = { saves: [] as any[], generations: [] as any[], failSave: false };
  const conversation = {
    id: "card-chat", title: "Party looks", created_at: new Date().toISOString(),
    messages: [{ id: "answer", role: "assistant", content: "Two looks for your party.", outfits }],
  };
  await page.addInitScript(() => {
    localStorage.setItem("flairify-token", "card-browser-fixture");
    localStorage.setItem("flairify-conversation", "card-chat");
  });
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    await route.fulfill({ json: { firebase: {} } });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/profile" && route.request().method() === "PUT") {
      state.saves.push(route.request().postDataJSON());
      if (state.failSave) return route.fulfill({ status: 503, json: { detail: "Could not save background" } });
      profile = { ...profile, ...route.request().postDataJSON() };
    }
    if (path === "/api/generate/try_on") {
      state.generations.push(route.request().postDataJSON());
      return route.fulfill({ json: {
        id: "card-preview", kind: "try_on", status: "queued", stage: "Preparing your preview",
        created_at: new Date().toISOString(), conversation_id: conversation.id, message_id: "answer",
      } });
    }
    const data: Record<string, unknown> = {
      "/api/config": { firebase: {}, mode: "production", analysis: "manual", voice: false, try_on: true, avatar: {} },
      "/api/profile": profile,
      "/api/jobs": { jobs: [] },
      "/api/wardrobe": { items: [dress], duplicates: [] },
      "/api/photos": { photos: [], references: [] },
      "/api/saved": { looks: [] },
      "/api/stores": { stores: [layer.store] },
      "/api/catalog": { products: [shoes, layer, blazer] },
      "/api/conversations": { conversations: [conversation] },
      "/api/conversations/card-chat": conversation,
    };
    await route.fulfill({ json: data[path] || {} });
  });
  await page.goto("/");
  await expect(page.locator(".look-card")).toHaveCount(2);
  return { state, outfits, shoes, layer, dress };
}

test("compact cards distinguish looks, group choices and keep stock expandable", async ({ page }) => {
  const { shoes, layer, dress } = await fixture(page);
  const card = page.locator(".look-card").first();
  const titles = await page.locator(".look-heading h3").allTextContents();
  expect(new Set(titles).size).toBe(2);
  expect(titles[0]).toContain("sage overshirt");
  expect(titles[1]).toContain("grey blazer");
  await expect(card.locator(".look-pieces .look-piece")).toHaveCount(3);
  await expect(card.locator(".look-styling")).not.toContainText(shoes.name);
  await expect(card.getByText("Include in preview")).toHaveCount(0);
  await expect(card.getByRole("group", { name: "Preview pieces" })).toHaveCount(1);
  await expect(card.getByText("Plain white background")).toHaveCount(0);
  await expect(card.getByText("Studio store", { exact: false }).first()).toBeHidden();
  await card.locator(".availability-details summary").click();
  await expect(card.locator(".look-stock")).toHaveText(["Available", "Available"]);
  await expect(card.locator(".availability-details")).not.toContainText("7 available");
  await expect(card.getByText("12 High Street").first()).toBeVisible();
  await card.locator(".availability-details summary").click();
  await expect(card.getByRole("button", { name: "See it on me", exact: true })).toBeDisabled();
  const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations;
  expect(violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/private/tmp/flairify-look-cards-${test.info().project.name}.png`, fullPage: true });
  await card.getByRole("button", { name: "Shop 2 items", exact: true }).click();
  const checkout = page.getByRole("dialog");
  await expect(checkout.getByRole("heading", { name: "Your checkout" })).toBeVisible();
  await expect(checkout).toContainText(shoes.name);
  await expect(checkout).toContainText(layer.name);
  await expect(checkout).not.toContainText(dress.name);
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: "Refine this look" })).toBeHidden();
  await card.getByLabel("More look options").click();
  await card.getByRole("button", { name: "Refine this look" }).click();
  await expect(page.locator(".refinement-context")).toBeVisible();
});

test("preview keeps selections and saves the chosen background before generating", async ({ page }) => {
  const { state, shoes, dress } = await fixture(page);
  const card = page.locator(".look-card").first();
  const choice = card.getByRole("checkbox", { name: `Try on ${shoes.name}`, exact: true });
  await choice.focus();
  await page.keyboard.press("Space");
  await card.getByRole("checkbox", { name: `Try on ${dress.name}`, exact: true }).check();
  await card.getByRole("button", { name: "See it on me", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(shoes.name, { exact: true })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Keep my photo’s background" }).check();
  await dialog.getByRole("button", { name: "Create preview", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.saves).toHaveLength(1);
  expect(state.saves[0].keep_background).toBe(true);
  expect(state.saves[0].demo).toBeUndefined();
  expect(state.generations).toHaveLength(1);
  expect(state.generations[0]).toMatchObject({
    outfit_id: "look-0", conversation_id: "card-chat", message_id: "answer",
    selections: expect.arrayContaining([
      { kind: "wardrobe", id: dress.id },
      { kind: "product", id: shoes.id, variant_id: "shoes-m" },
    ]),
  });
});

test("failed background save keeps the preview recoverable without submitting generation", async ({ page }) => {
  const { state, shoes } = await fixture(page);
  state.failSave = true;
  const card = page.locator(".look-card").first();
  await card.getByRole("checkbox", { name: `Try on ${shoes.name}`, exact: true }).check();
  await card.getByRole("button", { name: "See it on me", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Keep my photo’s background" }).check();
  await dialog.getByRole("button", { name: "Create preview", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not save background");
  expect(state.generations).toHaveLength(0);
  state.failSave = false;
  await dialog.getByRole("button", { name: "Create preview", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.generations).toHaveLength(1);
});

test("unavailable stock is labelled without quantities and cannot be selected for preview", async ({ page }) => {
  const { layer } = await fixture(page, true);
  const card = page.locator(".look-card").first();
  await expect(card.getByRole("checkbox", { name: `Try on ${layer.name}`, exact: true })).toBeDisabled();
  await card.locator(".availability-details summary").click();
  await expect(card.locator(".look-stock")).toHaveText(["Available", "Unavailable"]);
  await expect(card.locator(".availability-details")).not.toContainText("0 available");
});
