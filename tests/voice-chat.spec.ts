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
      } else if (data.type === "end") ws.close();
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
