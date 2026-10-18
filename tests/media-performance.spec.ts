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

test("catalogue thumbnails load near the viewport with bounded concurrency and reuse on return", async ({ page }) => {
  let active = 0, peak = 0;
  const requested: string[] = [];
  await page.addInitScript(() => localStorage.setItem("flairify-token", "image-performance"));
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    return route.fulfill({ json: { firebase: {} } });
  });
  const products = Array.from({ length: 48 }, (_, i) => ({
    id: `product-${i}`, sku: `SKU-${i}`, name: `Clothing item ${i}`, category: "top", price: 999,
    image: `media:product-image-${i}`, description: "", attributes: { department: "women" }, indexed: true,
    variants: [{ id: `variant-${i}`, size: "M", colour: "Blue", stock: [{ store_id: "bandra", quantity: 10 }] }],
  }));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/catalog/media/")) {
      expect(url.searchParams.get("width")).toBe("384");
      expect(route.request().headers()["authorization"]).toBe("Bearer image-performance");
      requested.push(url.pathname);
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active--;
      return route.fulfill({ path: "public/images/hero.jpg", contentType: "image/jpeg" });
    }
    const responses: Record<string, unknown> = {
      "/api/config": { mode: "demo", firebase: {}, try_on: false },
      "/api/profile": { name: "Image tester", department: "women", clothing_size: "M", shoe_size: "39", preferred_store_id: "bandra", budget: 5000, styles: [], colours: [], fit: "Comfortable", onboarding_complete: true, demo: true, consent: { ai_photo_processing: true } },
      "/api/conversations": { conversations: [] }, "/api/wardrobe": { items: [], duplicates: [] },
      "/api/photos": { photos: [], references: [] }, "/api/saved": { looks: [] }, "/api/jobs": { jobs: [] },
      "/api/stores": { stores: [{ id: "bandra", name: "Bandra", address: "Mumbai" }] },
      "/api/catalog": { products: url.searchParams.has("cursor") ? products.slice(24) : products.slice(0, 24), next_cursor: url.searchParams.has("cursor") ? null : "page-2", page_size: 24 },
    };
    return route.fulfill({ json: responses[url.pathname] || {} });
  });
  await page.goto("/");
  await navigate(page, "Inventory");
  const cards = page.locator(".inventory-grid article");
  await expect(cards).toHaveCount(24);
  await cards.first().scrollIntoViewIfNeeded();
  const first = page.getByAltText("Clothing item 0", { exact: true });
  await expect(first).toBeVisible();
  await expect.poll(() => active).toBe(0);
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.length).toBeLessThan(24);
  expect(peak).toBeLessThanOrEqual(4);
  const firstUrl = await first.getAttribute("src");
  await cards.last().scrollIntoViewIfNeeded();
  await expect(page.getByAltText("Clothing item 23", { exact: true })).toBeVisible();
  expect(requested).toContain("/api/catalog/media/product-image-23");
  await cards.first().scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute("src", firstUrl!);
  await page.getByRole("button", { name: "Show more clothes" }).click();
  await expect(cards).toHaveCount(48);
  await cards.last().scrollIntoViewIfNeeded();
  await expect(page.getByAltText("Clothing item 47", { exact: true })).toBeVisible();
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => active).toBe(0);
  const before = requested.length;
  await navigate(page, "My Wardrobe");
  await navigate(page, "Inventory");
  await expect(page.getByAltText("Clothing item 0", { exact: true })).toHaveAttribute("src", firstUrl!);
  expect(requested.length).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-image-delivery.png`, fullPage: false });
  await test.info().attach("image-requests", { body: JSON.stringify({ downloaded: requested.length, totalCards: 48, peakConcurrent: peak }), contentType: "application/json" });
});
