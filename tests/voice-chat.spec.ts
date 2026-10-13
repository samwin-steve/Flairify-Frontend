import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

async function voiceProfile(page: any, request: any) {
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
  const profile = await (await request.get("/api/profile", { headers })).json();
  await page.route("**/api/profile", (r: any) =>
    r.fulfill({ json: { ...profile, demo: false } }),
  );
  await page.route("**/api/config", async (r: any) => {
    const response = await r.fetch();
    await r.fulfill({ json: { ...(await response.json()), voice: true } });
  });
  await page.addInitScript(
    (token: string) => localStorage.setItem("flairify-token", token),
    identity.token,
  );
  return { headers };
}

test("native microphone, spoken cards, interruption, mute, end and restored transcript (transport fixture)", async ({
  page,
  request,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  const { headers } = await voiceProfile(page, request);
  const recommendation = await (
    await request.post("/api/chat", {
      headers,
      data: {
        message: "A smart office outfit under ₹5,000",
        include_wardrobe: false,
      },
    })
  ).json();
  const conversation = recommendation.conversation;
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      (window as any).__qaMicrophone = stream;
      return stream;
    };
  });
  let audioFrames = 0;
  let peer: any;
  let terminalConversation: any;
  await page.route("**/api/voice/sessions", (r) =>
    r.fulfill({
      json: {
        url: "ws://127.0.0.1:8001/qa-voice",
        ticket: "fixture-ticket-not-a-real-credential",
        conversation_id: conversation.id,
        max_seconds: 300,
      },
    }),
  );
  await page.routeWebSocket("ws://127.0.0.1:8001/qa-voice", (ws) => {
    peer = ws;
    ws.onMessage((message) => {
      if (typeof message !== "string") {
        audioFrames++;
        return;
      }
      const data = JSON.parse(message);
      if (data.ticket) {
        ws.send(
          JSON.stringify({
            type: "ready",
            output_sample_rate: 24000,
            conversation_id: conversation.id,
          }),
        );
        ws.send(
          JSON.stringify({
            type: "transcript",
            role: "assistant",
            text: "Hi Asha! Shall we keep working on that office look?",
          }),
        );
        ws.send(Buffer.alloc(48000 * 8)); // Explicit silent PCM fixture, not generated speech.
      } else if (data.type === "end") {
        if (terminalConversation)
          ws.send(
            JSON.stringify({
              type: "turn",
              conversation: terminalConversation,
            }),
          );
        ws.close();
      }
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your stylist is speaking", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => audioFrames).toBeGreaterThan(2);
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect(page.getByText("Your microphone is off")).toBeVisible();
  await page.waitForTimeout(100);
  const before = audioFrames;
  await page.waitForTimeout(200);
  expect(audioFrames).toBe(before);
  peer.send(JSON.stringify({ type: "interrupted" }));
  await page.getByRole("button", { name: "Unmute microphone" }).click();
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
  const updated = {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: "voice-user",
        role: "user",
        source: "voice",
        content: "Can we try a softer colour?",
        outfits: [],
      },
      {
        id: "voice-assistant",
        role: "assistant",
        source: "voice",
        content: "Ooh, I would try this combination for your office plans.",
        outfits: [recommendation.outfits[0]],
      },
    ],
  };
  terminalConversation = updated;
  peer.send(
    JSON.stringify({ type: "outfits", outfits: [recommendation.outfits[0]] }),
  );
  peer.send(JSON.stringify({ type: "turn", conversation: updated }));
  await page.route("**/api/conversations", (r) =>
    r.fulfill({ json: { conversations: [updated] } }),
  );
  await expect(
    page.getByText("Ooh, I would try this combination for your office plans."),
  ).toBeVisible();
  await expect(page.locator(".message.user").last()).toHaveCSS("opacity", "1");
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
    path: `test-results/${test.info().project.name}-voice-chat.png`,
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".voice-orb")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "End voice conversation" }).click();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as any).__qaMicrophone
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Ooh, I would try this combination for your office plans."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toBeVisible();
  await page
    .locator(".chat-actions")
    .getByRole("button", { name: "New chat", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toHaveCount(0);
  await expect(page.locator(".message")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".chat-actions")).toBeVisible();
  await expect(page.locator(".message")).toHaveCount(0);
});

test("denied microphone keeps text chat usable and makes no paid-session request", async ({
  page,
  request,
}) => {
  await voiceProfile(page, request);
  let starts = 0;
  await page.route("**/api/voice/sessions", (r) => {
    starts++;
    return r.abort();
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(page.locator(".voice-notice")).toContainText(
    "Microphone access is off",
  );
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toBeVisible();
  expect(starts).toBe(0);
});

test("voice waits for auth initialization and checks the server even with stale guest capabilities", async ({
  page,
  request,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await voiceProfile(page, request);
  let release!: () => void;
  const initialized = new Promise<void>((resolve) => {
    release = resolve;
  });
  let capabilityRequests = 0;
  await page.route("**/config", async (route) => {
    if (new URL(route.request().url()).pathname === "/config") {
      await initialized;
      return route.fulfill({ json: { firebase: {} } });
    }
    capabilityRequests++;
    const response = await route.fetch();
    await route.fulfill({ json: { ...(await response.json()), voice: false } });
  });
  let starts = 0;
  await page.route("**/api/voice/sessions", (route) => {
    starts++;
    return route.fulfill({
      status: 503,
      json: {
        detail: "Voice connection temporarily unavailable. Please retry.",
      },
    });
  });
  const profileLoaded = page.waitForResponse((r) =>
    r.url().endsWith("/api/profile"),
  );
  await page.goto("/");
  await profileLoaded;
  await expect(
    page.getByRole("status").filter({ hasText: "Getting your space ready" }),
  ).toBeVisible();
  expect(capabilityRequests).toBe(0);
  release();
  await expect(page.locator(".chat-actions")).toBeVisible();
  await expect.poll(() => capabilityRequests).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(page.locator(".voice-notice")).toContainText(
    "Voice connection temporarily unavailable",
  );
  expect(starts).toBe(1);
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).toBeVisible();
});

test("demo Talk opens account sign-in without starting microphone or paid voice", async ({
  page,
  request,
}) => {
  const identity = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + identity.token };
  await request.put("/api/profile", {
    headers,
    data: { name: "Demo", clothing_size: "M", shoe_size: "39" },
  });
  await request.post("/api/onboarding/complete", { headers });
  await page.addInitScript((token) => {
    localStorage.setItem("flairify-token", token);
    (window as any).__micCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as any).__micCalls++;
      throw new Error("Demo must not request the microphone");
    };
  }, identity.token);
  let starts = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/voice/sessions")) starts++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Email", { exact: true }),
  ).toBeVisible();
  expect(starts).toBe(0);
  expect(await page.evaluate(() => (window as any).__micCalls)).toBe(0);
});

test("voice selects pieces, opens Fitting Room without cutting speech, and reconnects once (transport fixture)", async ({
  page,
  request,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  const { headers } = await voiceProfile(page, request);
  const recommendation = await (
    await request.post("/api/chat", {
      headers,
      data: { message: "An office outfit under 5000", include_wardrobe: false },
    })
  ).json();
  const conversation = recommendation.conversation;
  const outfit = recommendation.outfits[0];
  const pieces = outfit.products
    .slice(0, 2)
    .map((p: any) => ({
      kind: "product",
      id: p.id,
      name: p.name,
      category: p.category,
      variant_id: p.availability.variant_id,
      available: true,
    }));
  let peer: any;
  let ticketCalls = 0;
  let firstId: string | null = null;
  let selectionMessages: string[][] = [];
  await page.route("**/api/voice/sessions", async (r) => {
    const body = r.request().postDataJSON();
    if (ticketCalls) expect(body.conversation_id).toBe(conversation.id);
    firstId = body.conversation_id;
    ticketCalls++;
    await r.fulfill({
      json: {
        url: "ws://127.0.0.1:8001/qa-actions",
        ticket: "fixture-ticket",
        conversation_id: conversation.id,
        max_seconds: 300,
      },
    });
  });
  await page.routeWebSocket("ws://127.0.0.1:8001/qa-actions", (ws) => {
    peer = ws;
    ws.onMessage((message) => {
      if (typeof message !== "string") return;
      const data = JSON.parse(message);
      if (data.ticket) {
        ws.send(
          JSON.stringify({ type: "ready", conversation_id: conversation.id }),
        );
        ws.send(
          JSON.stringify({
            type: "selection",
            pieces: ticketCalls > 1 ? pieces : [],
          }),
        );
      } else if (data.type === "selection") {
        selectionMessages.push(data.pieces);
        ws.send(
          JSON.stringify({
            type: "selection",
            pieces: pieces.filter((p: any) =>
              data.pieces.includes(`${p.kind}:${p.id}`),
            ),
          }),
        );
      } else if (data.type === "ping")
        ws.send(JSON.stringify({ type: "pong" }));
      else if (data.type === "end") ws.close();
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to your stylist" }).click();
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
  peer.send(JSON.stringify({ type: "outfits", outfits: [outfit] }));
  peer.send(JSON.stringify({ type: "selection", pieces }));
  for (const p of pieces)
    await expect(
      page
        .getByRole("checkbox", { name: `Try on ${p.name}`, exact: true })
        .last(),
    ).toBeChecked();
  await page
    .getByRole("checkbox", { name: `Try on ${pieces[0].name}`, exact: true })
    .last()
    .click();
  await expect(
    page
      .getByRole("checkbox", { name: `Try on ${pieces[0].name}`, exact: true })
      .last(),
  ).not.toBeChecked();
  await expect.poll(() => selectionMessages.length).toBe(1);
  expect(selectionMessages[0]).toEqual([`product:${pieces[1].id}`]);
  peer.send(JSON.stringify({ type: "selection", pieces }));
  // Unexpected transport loss: foreground microphone is retained, saved chat ID is reused.
  peer.close({ code: 1011, reason: "fixture disconnect" });
  await expect(
    page.getByText("Reconnecting to your stylist…", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => ticketCalls).toBe(2);
  await expect(page.getByText(/Reconnected. If I missed/)).toBeVisible();
  expect(firstId).toBe(conversation.id);
  let job = {
    id: "voice-preview-fixture",
    kind: "try_on",
    status: "queued",
    stage: "Queued",
    attempts: 0,
    result: null as any,
    error: null,
    created_at: new Date().toISOString(),
  };
  await page.route("**/api/jobs", (r) => r.fulfill({ json: { jobs: [job] } }));
  peer.send(JSON.stringify({ type: "preview", job }));
  await expect(
    page.getByRole("heading", { name: "Queued", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toBeVisible();
  await expect(
    page.getByText("You can leave and come back. This job is saved."),
  ).toBeVisible();
  await page.route("**/api/media/voice-image-fixture", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH7sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/api/jobs/voice-preview-fixture/shopping", (r) =>
    r.fulfill({
      json: { products: outfit.products.slice(0, 2), unavailable: [] },
    }),
  );
  job = {
    ...job,
    status: "succeeded",
    stage: "Complete",
    result: {
      media_id: "voice-image-fixture",
      pieces,
      label: "Transport fixture, not a generated image",
    },
  };
  await expect(page.getByText("Your Google AI preview")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Shop this look" })
      .getByRole("button", { name: "Buy", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-voice-fitting.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "End voice conversation" }).click();
  await expect(
    page.getByRole("region", { name: "Voice conversation" }),
  ).toHaveCount(0);
  await page.waitForTimeout(2500);
  expect(ticketCalls).toBe(2); // Never reconnect after an explicit End.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("mobile chat uses hamburger navigation and the full remaining viewport", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(!isMobile);
  await voiceProfile(page, request);
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toHaveCount(0);
  await expect(page.locator(".conversation")).toBeVisible();
  const room = await page.locator(".conversation").boundingBox();
  expect(room!.height).toBeGreaterThan((page.viewportSize()?.height || 0) - 90);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Find your next/ }),
  ).toBeVisible();
});
