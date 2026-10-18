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
  const state = { downloads: 0, deleted: false, accepted: false, jobsGate: Promise.resolve() };
  await page.addInitScript(() => {
    localStorage.setItem("flairify-token", "cache-account-one");
    localStorage.setItem("flairify-conversation", "cache-chat");
  });
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    await route.fulfill({ json: { firebase: {} } });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === "/api/media/shared-image") {
      state.downloads++;
      return route.fulfill(state.deleted
        ? { status: 404, json: { detail: "Deleted" } }
        : { path: "public/images/hero.jpg", contentType: "image/jpeg" });
    }
    if (path === "/api/jobs/preview" && method === "DELETE") {
      state.deleted = true;
      return route.fulfill({ json: { deleted: true } });
    }
    if (path === "/api/jobs/preview/accept") {
      state.accepted = true;
      return route.fulfill({ json: { accepted: true } });
    }
    if (path === "/api/jobs") {
      await state.jobsGate;
      return route.fulfill({ json: { jobs: state.deleted ? [] : [{
        id: "preview", kind: "try_on", status: "succeeded", stage: "Complete", attempts: 1,
        created_at: "2026-10-17T12:00:00Z", result: { media_id: "shared-image", accepted: state.accepted },
      }] } });
    }
    const responses: Record<string, unknown> = {
      "/api/config": { mode: "demo", firebase: {}, try_on: false },
      "/api/profile": { name: "Cache tester", department: "all", clothing_size: "M", shoe_size: "39",
        budget: 5000, styles: [], colours: [], fit: "Comfortable", onboarding_complete: true,
        demo: true, consent: { ai_photo_processing: true, remember_preferences: false } },
      "/api/conversations": { conversations: [{ id: "cache-chat", title: "Cache check", messages: [{
        id: "reply", role: "assistant", content: "Your preview is ready.", outfits: [], preview_job_id: "preview",
      }] }] },
      "/api/wardrobe": { items: state.deleted ? [] : [{ id: "shirt", name: "Cached shirt", category: "top",
        colour: "white", pattern: "solid", confirmed: true, image: "media:shared-image", uncertainty: [] }], duplicates: [] },
      "/api/photos": { photos: [], references: [] },
      "/api/stores": { stores: [] },
      "/api/saved": { looks: [] },
      "/api/jobs/preview/shopping": { products: [], unavailable: [] },
    };
    return route.fulfill({ json: responses[path] || {} });
  });
  await page.goto("/");
  return state;
}

test("private images reuse one download across screens and remain visible during refresh", async ({ page }) => {
  const state = await fixture(page);
  const preview = page.getByAltText("AI-generated style visualization");
  await expect(preview).toBeVisible();
  await expect.poll(() => state.downloads).toBe(1);
  const url = await preview.getAttribute("src");
  await navigate(page, "Fitting Room");
  await expect(preview).toHaveAttribute("src", url!);
  await navigate(page, "My Wardrobe");
  await expect(page.getByAltText("Cached shirt", { exact: true })).toHaveAttribute("src", url!);
  await navigate(page, "Stylist");
  await expect(preview).toHaveAttribute("src", url!);
  expect(state.downloads).toBe(1);
  let release!: () => void;
  state.jobsGate = new Promise<void>((done) => { release = done; });
  try {
    await page.getByRole("button", { name: "Accept preview", exact: true }).click();
    await expect.poll(() => state.accepted).toBe(true);
    await expect(preview).toHaveAttribute("src", url!);
    await expect(preview).toBeVisible();
    expect(state.downloads).toBe(1);
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Accept preview", exact: true })).toHaveCount(0);
  await expect(preview).toHaveAttribute("src", url!);
  await page.screenshot({ path: `test-results/${test.info().project.name}-cached-preview.png` });
  await page.reload();
  await expect(preview).toBeVisible();
  await expect.poll(() => state.downloads).toBe(2); // memory only; never persisted to disk
});

test("deleting a preview removes its cached image", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.getByAltText("AI-generated style visualization")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => state.deleted).toBe(true);
  await expect(page.getByAltText("AI-generated style visualization")).toHaveCount(0);
  await navigate(page, "Fitting Room");
  await expect(page.getByAltText("AI-generated style visualization")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your next look starts here." })).toBeVisible();
});
