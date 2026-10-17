import { test, expect, type Page } from "@playwright/test";

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function setup(page: Page, mode = "production") {
  const state = {
    reads: 0,
    saves: 0,
    completions: 0,
    fail: false,
    saveGate: Promise.resolve(),
    profile: {
      name: "Friend",
      clothing_size: "",
      shoe_size: "",
      department: "all",
      preferred_store_id: null,
      styles: [],
      colours: [],
      budget: 5000,
      fit: "Comfortable",
      keep_background: false,
      include_wardrobe: false,
      consent: { remember_preferences: false, ai_photo_processing: false },
      onboarding_complete: false,
    },
  };
  await page.addInitScript(() => localStorage.setItem("flairify-token", "profile-save-fixture"));
  await page.route(/\/config$/, async (route) => {
    if (new URL(route.request().url()).pathname !== "/config") return route.fallback();
    await route.fulfill({ json: { firebase: {} } });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/profile") {
      if (request.method() === "PUT") {
        state.saves++;
        const previous = state.profile;
        const saved = {
          ...previous,
          ...request.postDataJSON(),
          styles: [],
          colours: [],
          onboarding_complete: url.searchParams.get("complete_onboarding") === "true",
        };
        await state.saveGate;
        if (state.fail) return route.fulfill({ status: 503, json: { detail: "Unable to save. Please retry." } });
        // A response to the old account must not change the new account's server state.
        if (state.profile === previous) state.profile = saved;
        // PUT returns persisted preferences; GET also provides account roles.
        return route.fulfill({ json: saved });
      }
      state.reads++;
      return route.fulfill({ json: { ...state.profile, demo: false, admin: false, seller: false } });
    }
    if (url.pathname === "/api/auth/demo") {
      state.profile = {
        ...state.profile,
        name: "New account",
        clothing_size: "M",
        shoe_size: "39",
        onboarding_complete: true,
      };
      return route.fulfill({ json: { token: "new-session-fixture" } });
    }
    if (url.pathname === "/api/onboarding/complete") {
      state.completions++;
      return route.fulfill({ json: { ready: true, confirmed_count: 0 } });
    }
    const data: Record<string, unknown> = {
      "/api/config": { mode, analysis: "manual", voice: false, avatar: {} },
      "/api/jobs": { jobs: [] },
      "/api/wardrobe": { items: [], duplicates: [] },
      "/api/photos": { photos: [], references: [] },
      "/api/saved": { looks: [] },
      "/api/stores": { stores: [] },
      "/api/conversations": { conversations: [] },
      "/api/catalog": { products: [] },
    };
    await route.fulfill({ json: data[url.pathname] || {} });
  });
  await page.goto("/");
  await page.getByLabel("What should we call you?").fill("Sanch");
  await page.getByLabel("Clothing size", { exact: true }).selectOption("XL");
  await page.getByLabel("Shoe size (EU)").selectOption("40");
  return state;
}

test("save advances after one confirmed request without reloading the profile", async ({ page }) => {
  const state = await setup(page);
  const gate = deferred();
  state.saveGate = gate.promise;
  try {
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "A little about you, before we begin." })).toBeVisible();
    await expect.poll(() => state.saves).toBe(1);
    expect(state.profile.onboarding_complete).toBe(false);
  } finally {
    gate.release();
  }
  await expect(page.getByRole("heading", { name: "A good outfit starts with you." })).toBeVisible();
  expect(state.profile).toMatchObject({ name: "Sanch", clothing_size: "XL", shoe_size: "40", onboarding_complete: true });
  expect(state.reads).toBe(1);
  expect(state.completions).toBe(0);
  // Reload also sees the persisted completion, so setup does not open again.
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message your stylist" })).toBeVisible();
  expect(state.reads).toBe(2);
});

test("failed save stays on preferences and can be retried", async ({ page }) => {
  const state = await setup(page);
  state.fail = true;
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Unable to save. Please retry.");
  await expect(page.getByRole("button", { name: "Save and continue" })).toBeEnabled();
  await expect(page.getByLabel("Clothing size", { exact: true })).toHaveValue("XL");
  expect(state.profile.onboarding_complete).toBe(false);
  state.fail = false;
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "A good outfit starts with you." })).toBeVisible();
  expect(state.saves).toBe(2);
  expect(state.reads).toBe(1);
  expect(state.completions).toBe(0);
});

test("late save cannot replace the profile loaded by a newer login session", async ({ page }) => {
  const state = await setup(page, "demo");
  const gate = deferred();
  state.saveGate = gate.promise;
  try {
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect.poll(() => state.saves).toBe(1);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Find my look", exact: true }).click();
    await expect.poll(() => state.reads).toBe(2);
    await expect(page.getByRole("heading", { name: "A good outfit starts with you." })).toBeVisible();
    // Show the second account's form before delivering the first account's save.
    await page.getByRole("button", { name: "Browse clothes first", exact: true }).click();
    await page.getByRole("button", { name: "Open profile", exact: true }).click();
    await expect(page.getByLabel("What should we call you?")).toHaveValue("New account");
    const finished = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/profile" && response.request().method() === "PUT",
    );
    gate.release();
    await (await finished).finished();
    // Remount the form so the assertion checks the shared cache, not old form defaults.
    await page.getByRole("button", { name: "Manage reference photos", exact: true }).click();
    await page.getByRole("button", { name: "Open profile", exact: true }).click();
    await expect(page.getByLabel("What should we call you?")).toHaveValue("New account");
    await expect(page.getByLabel("Clothing size", { exact: true })).toHaveValue("M");
    expect(state.reads).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem("flairify-token"))).toBe("new-session-fixture");
  } finally {
    gate.release();
  }
});
