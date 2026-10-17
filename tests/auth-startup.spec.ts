import { test, expect, type Page } from "@playwright/test";

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function fixture(page: Page, complete = true) {
  const state = {
    configRequests: 0,
    profileRequests: 0,
    failPassword: false,
    profileGate: Promise.resolve(),
    profile: {
      name: complete ? "Asha" : "Friend",
      clothing_size: complete ? "M" : "",
      shoe_size: complete ? "39" : "",
      department: "women",
      preferred_store_id: "",
      budget: 5000,
      fit: "Comfortable",
      styles: [],
      colours: [],
      consent: { remember_preferences: false, ai_photo_processing: false },
      onboarding_complete: complete,
    },
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/profile") {
      if (route.request().method() === "GET") {
        state.profileRequests++;
        await state.profileGate;
      } else state.profile = { ...state.profile, ...route.request().postDataJSON() };
    }
    if (path === "/api/onboarding/complete") state.profile.onboarding_complete = true;
    const data: Record<string, unknown> = {
      "/api/config": { mode: "production", analysis: "manual", voice: false, avatar: {} },
      "/api/profile": state.profile,
      "/api/jobs": { jobs: [] },
      "/api/wardrobe": { items: [], duplicates: [] },
      "/api/saved": { looks: [] },
      "/api/photos": { photos: [], references: [] },
      "/api/stores": { stores: [] },
      "/api/conversations": { conversations: [] },
    };
    await route.fulfill({ json: data[path] || {} });
  });
  return state;
}

async function firebase(page: Page, state: { configRequests: number; failPassword: boolean }) {
  const project = "flairify-browser-fixture";
  const user = "fixture-user";
  const email = "fixture@example.com";
  const now = Math.floor(Date.now() / 1000);
  // Explicit transport fixture: the real Firebase client handles auth state and
  // persistence; no Google account or real authentication credential is used.
  const token = [
    { alg: "RS256", typ: "JWT" },
    { aud: project, iss: `https://securetoken.google.com/${project}`, sub: user, user_id: user, email, iat: now, auth_time: now, exp: now + 3600, firebase: { sign_in_provider: "password" } },
  ].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".fixture";
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    state.configRequests++;
    await route.fulfill({ json: { firebase: { apiKey: "fixture-api-key", appId: "1:123:web:fixture", projectId: project, authDomain: `${project}.firebaseapp.com` } } });
  });
  await page.route("https://identitytoolkit.googleapis.com/**", async (route) => {
    if (route.request().url().includes("accounts:signInWithPassword") && state.failPassword) {
      return route.fulfill({ status: 400, json: { error: { code: 400, message: "INVALID_PASSWORD" } } });
    }
    const lookup = route.request().url().includes("accounts:lookup");
    await route.fulfill({ json: lookup ? {
      users: [{ localId: user, email, emailVerified: true, providerUserInfo: [{ providerId: "password", federatedId: email, email }], createdAt: String(now * 1000), lastLoginAt: String(now * 1000) }],
    } : { localId: user, email, idToken: token, refreshToken: "fixture-refresh", expiresIn: "3600", registered: true } });
  });
}

test("public landing renders before delayed auth config without starting a guest or private session", async ({ page }) => {
  const state = await fixture(page);
  const gate = deferred();
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    state.configRequests++;
    await gate.promise;
    await route.fulfill({ json: { firebase: {} } });
  });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /A wardrobe that feels/ })).toBeVisible();
    await expect.poll(() => state.configRequests).toBe(1);
    await expect(page.getByRole("button", { name: "Find my look" })).toBeDisabled();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Getting sign-in ready" })).toBeVisible();
    await expect(page.getByText("Sign-in is unavailable", { exact: false })).toHaveCount(0);
    expect(state.profileRequests).toBe(0);
    await expect(page.locator(".app-shell")).toHaveCount(0);
  } finally {
    gate.release();
  }
});

for (const complete of [true, false]) {
  test(`${complete ? "email sign-in" : "account creation"} loads one profile and preserves the setup gate`, async ({ page }) => {
    const state = await fixture(page, complete);
    await firebase(page, state);
    const profile = deferred();
    state.profileGate = profile.promise;
    try {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Find my look" })).toBeEnabled();
      if (complete) await page.getByRole("button", { name: "Sign in", exact: true }).click();
      else await page.getByRole("button", { name: "Find my look" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Email").fill("fixture@example.com");
      await dialog.getByLabel("Password").fill("fixture-password");
      await dialog.getByRole("button", { name: complete ? "Sign in" : "Create account", exact: true }).click();
      await expect.poll(() => state.profileRequests).toBe(1);
      await expect(page.getByRole("status").filter({ hasText: "Getting your space ready" })).toBeVisible();
      await expect(page.locator(".app-shell")).toHaveCount(0);
    } finally {
      profile.release();
    }
    if (!complete) {
      await expect(page.getByRole("heading", { name: "A little about you, before we begin." })).toBeVisible();
      expect(state.profileRequests).toBe(1);
      await page.getByLabel("What should we call you?").fill("Asha");
      await page.getByLabel("Clothing size", { exact: true }).selectOption("M");
      await page.getByLabel("Shoe size (EU)").selectOption("39");
      await page.getByRole("button", { name: "Save and continue" }).click();
      await page.getByRole("button", { name: "Start shopping without photos", exact: true }).click();
    }
    await expect(page.getByRole("textbox", { name: "Message your stylist" })).toBeVisible();
    if (complete) expect(state.profileRequests).toBe(1);
    const beforeReload = state.profileRequests;
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Message your stylist" })).toBeVisible();
    expect(state.profileRequests).toBe(beforeReload + 1);
    await page.getByRole("button", { name: "Open profile" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.locator(".landing")).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveCount(0);
  });
}

test("failed sign-in keeps the form usable and retry loads the profile once", async ({ page }) => {
  const state = await fixture(page);
  state.failPassword = true;
  await firebase(page, state);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find my look" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("fixture@example.com");
  await dialog.getByLabel("Password").fill("fixture-password");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(state.profileRequests).toBe(0);
  state.failPassword = false;
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message your stylist" })).toBeVisible();
  expect(state.profileRequests).toBe(1);
});
