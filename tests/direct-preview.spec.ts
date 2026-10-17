import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function navigate(page: Page, name: string) {
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

test("direct multi-piece preview, conflict resolution, refresh and editable background", async ({
  page,
  request,
}) => {
  // Browser interaction test uses a clearly stubbed Google job; paid live checks are separate.
  const auth = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + auth.token };
  const wardrobe = (
    await (await request.post("/api/wardrobe/sample", { headers })).json()
  ).items;
  for (const item of wardrobe)
    await request.put("/api/wardrobe/" + item.id, {
      headers,
      data: { ...item, confirmed: true },
    });
  await request.put("/api/profile", {
    headers,
    data: { clothing_size: "M", shoe_size: "39" },
  });
  await request.post("/api/onboarding/complete", { headers });
  const products = (
    await (await request.get("/api/catalog", { headers })).json()
  ).products;
  const pick = (category: string, index = 0) =>
    products.filter(
      (p: any) =>
        p.category === category &&
        p.image.endsWith(".jpg") &&
        p.variants.some((v: any) => v.stock.some((s: any) => s.quantity > 0)),
    )[index];
  const chosen = [
    pick("top"),
    pick("bottom"),
    pick("bottom", 1),
    pick("shoes"),
    pick("shoes", 1),
    pick("jacket"),
    pick("dress"),
  ].map((p) => ({ ...p, try_on_supported: true }));
  let background = false,
    calls: any[] = [],
    job: any = null;
  await page.route("**/config", async (route) => {
    const result = await route.fetch();
    const data = await result.json();
    await route.fulfill({ json: { ...data, try_on: true, firebase: {} } });
  });
  await page.route((url) => url.pathname === "/api/profile", async (route) => {
    const result = await route.fetch();
    const data = await result.json();
    if (route.request().method() === "PUT")
      background = route.request().postDataJSON().keep_background;
    await route.fulfill({
      json: {
        ...data,
        demo: false,
        keep_background: background,
        consent: { ...data.consent, ai_photo_processing: true },
      },
    });
  });
  const outfit = {
    id: "outfit-test",
    title: "Test outfit choices",
    occasion: "Work",
    owned: [],
    products: chosen,
    total: 4000,
    explanation: "Browser test fixtures",
    complete: true,
  };
  await page.route("**/api/photos", (route) =>
    route.fulfill({
      json: {
        references: [],
        photos: [
          { id: "missing-photo", media_id: "missing-photo", source: "upload" },
        ],
      },
    }),
  );
  await page.route("**/api/media/missing-photo", (route) =>
    route.fulfill({ status: 404, json: { detail: "Test missing photo" } }),
  );
  await page.route("**/api/chat/stream", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body:
        "event: done\ndata: " +
        JSON.stringify({
          conversation: {
            id: "preview-test",
            title: "Preview test",
            messages: [
              {
                id: "answer",
                role: "assistant",
                content: "Choose the pieces for your preview.",
                outfits: [outfit],
              },
            ],
          },
          outfits: [outfit],
        }) +
        "\n\n",
    }),
  );
  const conversation = {
    id: "preview-test", title: "Preview test",
    messages: [{ id: "answer", role: "assistant", content: "Choose the pieces for your preview.", outfits: [outfit] }],
  };
  await page.route("**/api/conversations", (route) => route.fulfill({ json: { conversations: [conversation] } }));
  await page.route("**/api/media/chat-preview-image", (route) => route.fulfill({ path: "public/images/hero.jpg", contentType: "image/jpeg" }));
  await page.route("**/api/jobs/stubbed-google-job/shopping", (route) => route.fulfill({ json: { products: [chosen[0]], unavailable: [] } }));
  await page.route("**/api/jobs", (route) =>
    route.fulfill({ json: { jobs: job ? [job] : [] } }),
  );
  await page.route("**/api/generate/try_on", async (route) => {
    calls.push(route.request().postDataJSON());
    job = {
      id: "stubbed-google-job",
      conversation_id: calls.at(-1).conversation_id,
      message_id: calls.at(-1).message_id,
      created_at: new Date().toISOString(),
      kind: "try_on",
      status: "queued",
      stage: "Queued preview test",
      attempts: 0,
      result: null,
    };
    await route.fulfill({ json: job });
  });
  await page.addInitScript(
    (token) => localStorage.setItem("flairify-token", token),
    auth.token,
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Help me pack for Mumbai/ }).click();
  const look = page.locator(".look-card").first();
  const button = look.getByRole("button", {
    name: "See it on me",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await expect(look.locator("input:checked")).toHaveCount(0);
  const box = (index: number) =>
    look.getByRole("checkbox", {
      name: "Try on " + chosen[index].name,
      exact: true,
    });
  await box(1).focus();
  await page.keyboard.press("Space");
  await expect(button).toBeEnabled();
  await box(2).check();
  await expect(box(1)).not.toBeChecked();
  await box(3).check();
  await box(4).check();
  await expect(box(3)).not.toBeChecked();
  await expect(look.getByRole("status")).toContainText("replaces");
  await box(0).check();
  await box(5).check();
  await box(6).check();
  await expect(box(0)).not.toBeChecked();
  await expect(box(2)).not.toBeChecked();
  await box(0).check();
  await expect(box(6)).not.toBeChecked();
  await box(2).check();
  await expect(look.locator("input:checked")).toHaveCount(4);
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
  await page.screenshot({
    path: `test-results/${test.info().project.name}-multi-selection.png`,
    fullPage: true,
  });
  await button.click();
  const preview = page.locator(".messages .chat-preview");
  await expect(preview.getByRole("status")).toHaveText("Creating your preview…");
  await expect(page.getByRole("heading", { name: "Fitting Room" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(calls[0].selections.map((p: any) => p.id)).toEqual([
    chosen[4].id,
    chosen[5].id,
    chosen[0].id,
    chosen[2].id,
  ]);
  expect(calls[0].outfit_id).toBe("outfit-test");
  expect(calls[0].conversation_id).toBe("preview-test");
  expect(calls[0].message_id).toBe("answer");
  job = { ...job, status: "succeeded", stage: "Preview complete", result: { media_id: "chat-preview-image" } };
  await expect(preview.getByAltText("AI-generated style visualization")).toBeVisible();
  await preview.getByRole("button", { name: "Buy", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".checkout-item")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-chat-preview.png`, fullPage: true });
  await page.reload();
  await page.locator(".messages .chat-preview").scrollIntoViewIfNeeded();
  await expect(page.locator(".messages .chat-preview").getByAltText("AI-generated style visualization")).toBeVisible();
  await navigate(page, "Fitting Room");
  await expect(
    page.getByText("Preview complete", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await page.getByLabel("What should we call you?").fill("Preview tester");
  const checkbox = page.getByLabel(
    "Keep my generated outfits in the same background",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByText("Image unavailable", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "preferences are updated" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "preferences are updated" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await expect(checkbox).not.toBeChecked();
});
