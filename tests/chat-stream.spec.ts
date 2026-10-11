import { test, expect } from "@playwright/test";

test("stream errors restore the message and retry the same request safely", async ({
  page,
  request,
}) => {
  const auth = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + auth.token };
  const profile = await (await request.get("/api/profile", { headers })).json();
  for (const key of ["admin", "demo", "seller"]) delete profile[key];
  await request.put("/api/profile", {
    headers,
    data: {
      ...profile,
      clothing_size: "M",
      shoe_size: "39",
      consent: { ...profile.consent, remember_preferences: true },
    },
  });
  const wardrobe = (
    await (await request.post("/api/wardrobe/sample", { headers })).json()
  ).items;
  for (const item of wardrobe)
    await request.put("/api/wardrobe/" + item.id, {
      headers,
      data: { ...item, confirmed: true },
    });
  await request.post("/api/onboarding/complete", { headers });
  await page.addInitScript(
    (token) => localStorage.setItem("flairify-token", token),
    auth.token,
  );
  let attempts: any[] = [];
  await page.route("**/api/chat/stream", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      await route.fulfill({
        contentType: "text/event-stream",
        body: 'event: text\ndata: {"delta":"Incomplete test response"}\n\nevent: error\ndata: {"message":"Connection interrupted. Please retry."}\n\n',
      });
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("button", { name: /Help me pack for Mumbai/ }).click();
  await expect(
    page.getByText("Connection interrupted. Please retry."),
  ).toBeVisible();
  await expect(page.getByText("Incomplete test response")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message your stylist" }),
  ).not.toHaveValue("");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".look-card").first()).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].request_id).toBe(attempts[1].request_id);
  await expect(page.locator(".streaming-copy")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
