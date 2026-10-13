import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function account(page: Page, request: APIRequestContext, ready = false) {
  const identity = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + identity.token };
  await request.put("/api/profile", {
    headers,
    data: {
      name: "Asha",
      clothing_size: "M",
      shoe_size: ready ? "39" : "",
      department: "women",
      preferred_store_id: "bandra",
      budget: 4000,
    },
  });
  if (ready) await request.post("/api/onboarding/complete", { headers });
  await page.addInitScript(
    (token) => localStorage.setItem("flairify-token", token),
    identity.token,
  );
  return headers;
}

async function history(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Your chats", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "Your chats", exact: true }).click();
}

const newChat = (page: Page) =>
  page
    .locator(".chat-actions")
    .getByRole("button", { name: "New chat", exact: true });

test("restored login completes preferences before entering the app, including a legacy incomplete profile", async ({
  page,
  request,
}) => {
  const headers = await account(page, request);
  const profile = await (await request.get("/api/profile", { headers })).json();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/profile", async (route) => {
    if (!first || route.request().method() !== "GET") return route.continue();
    first = false;
    await gate;
    // An older account can have the completion flag but no saved shoe size.
    await route.fulfill({ json: { ...profile, onboarding_complete: true } });
  });
  await page.goto("/");
  await expect(
    page
      .getByRole("status", { name: "" })
      .filter({ hasText: "Getting your space ready" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: "A little about you, before we begin." }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Browse clothes first" }),
  ).toHaveCount(0);
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
  await page.reload();
  await expect(page.getByLabel("Shoe size (EU)")).toBeVisible();
  await page.getByLabel("Shoe size (EU)").selectOption("40");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByRole("button", { name: "Start shopping without photos" })
    .click();
  await expect(newChat(page)).toBeVisible();
  await expect(
    page.getByText("Let’s save your shopping preferences."),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toBeVisible();
  await expect(page.locator(".onboarding")).toHaveCount(0);
  const saved = await (await request.get("/api/profile", { headers })).json();
  expect(saved).toMatchObject({
    onboarding_complete: true,
    clothing_size: "M",
    shoe_size: "40",
    preferred_store_id: "bandra",
    budget: 4000,
  });
  await page.getByRole("button", { name: "Open profile" }).click();
  await expect(page.getByLabel("Shoe size (EU)")).toHaveValue("40");
});

test("new chat wins over delayed history, resets look context and preserves separate old conversations", async ({
  page,
  request,
}) => {
  const headers = await account(page, request, true);
  const prior = await (
    await request.post("/api/chat", {
      headers,
      data: { message: "A relaxed office look under ₹4,000" },
    })
  ).json();
  await page.addInitScript((id) => {
    if (localStorage.getItem("flairify-conversation") === null)
      localStorage.setItem("flairify-conversation", id);
  }, prior.conversation.id);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/conversations", async (route) => {
    if (!first) return route.continue();
    first = false;
    await gate;
    await route.fulfill({ json: { conversations: [prior.conversation] } });
  });
  await page.goto("/");
  await expect(newChat(page)).toBeVisible();
  await newChat(page).click();
  release();
  await history(page);
  const old = page
    .locator(".history")
    .getByRole("button", { name: prior.conversation.title })
    .filter({ visible: true });
  await old.click();
  await expect(page.locator(".message.assistant")).toHaveCount(1);
  await page
    .locator(".look-card")
    .first()
    .getByRole("button", { name: /Refine this look/ })
    .click();
  await expect(page.locator(".refinement-context")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("An unsent old draft");
  await newChat(page).click();
  await expect(page.locator(".message")).toHaveCount(0);
  await expect(page.locator(".refinement-context")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toHaveValue("");
  await page.reload();
  await expect(newChat(page)).toBeVisible();
  await expect(page.locator(".message")).toHaveCount(0);
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/chat/stream"));
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("A different everyday outfit under ₹3,000");
  await page.getByRole("button", { name: "Send message" }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    conversation_id: null,
    reference_outfit_id: null,
  });
  await expect(page.locator(".message.assistant")).toHaveCount(1);
  const chats = (
    await (await request.get("/api/conversations", { headers })).json()
  ).conversations;
  expect(chats).toHaveLength(2);
  expect(
    chats.find((c: any) => c.id === prior.conversation.id).messages,
  ).toHaveLength(2);
  expect(
    chats.find((c: any) => c.id !== prior.conversation.id).messages[0].content,
  ).toContain("different everyday");
  await expect(page.locator(".message.user")).toHaveCSS("opacity", "1");
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
    path: `test-results/${test.info().project.name}-new-chat.png`,
    fullPage: true,
  });
  await history(page);
  await page
    .locator(".history")
    .getByRole("button", { name: prior.conversation.title })
    .filter({ visible: true })
    .click();
  await expect(page.locator(".message.user")).toContainText("relaxed office");
});

test("starting fresh during a reply discards late events and permits another message", async ({
  page,
  request,
}) => {
  const headers = await account(page, request, true);
  const fixture = await (
    await request.post("/api/chat", {
      headers,
      data: { message: "An old office look" },
    })
  ).json();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/chat/stream", async (route) => {
    if (!first) return route.continue();
    first = false;
    await gate;
    await route
      .fulfill({
        contentType: "text/event-stream",
        body: `event: done\ndata: ${JSON.stringify(fixture)}\n\n`,
      })
      .catch(() => {});
  });
  await page.goto("/");
  await expect(newChat(page)).toBeVisible();
  // Existing history does not auto-open when no chat was explicitly selected.
  await expect(page.locator(".message")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("An in-flight request");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message.user")).toContainText("in-flight");
  await newChat(page).click();
  release();
  await expect(page.locator(".message")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Message your stylist" })
    .fill("A fresh casual outfit");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message.assistant")).toHaveCount(1);
  await expect(page.locator(".message.user")).toContainText("fresh casual");
  await expect(page.locator(".message")).not.toContainText([
    "An old office look",
  ]);
});
