import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";

test("generated image only, buy every recommended item and restore the order", async ({
  page,
  request,
}) => {
  // Real local order APIs; generated media is explicitly a test fixture, not an AI call.
  const dataDir = process.env.FLAIRIFY_E2E_DATA_DIR;
  test.skip(
    !dataDir?.startsWith("/tmp/flairify-"),
    "Requires an isolated local fixture database",
  );
  const auth = await (await request.post("/api/auth/demo")).json();
  const headers = { Authorization: "Bearer " + auth.token };
  const catalog = (
    await (await request.get("/api/catalog", { headers })).json()
  ).products;
  const products = ["top", "bottom", "shoes"].map((category) =>
    catalog.find(
      (p: any) =>
        p.category === category &&
        p.variants.some((v: any) => v.stock.some((s: any) => s.quantity > 0)),
    ),
  );
  const backend = path.resolve("../backend");
  execFileSync(
    path.join(backend, ".venv/bin/python"),
    [
      "-c",
      `
import json,sys
from pathlib import Path
from app.store import store
from app.models import GenerationJob
from app.services import media
uid,products=json.loads(sys.argv[1])
image=media.save(uid,Path('../frontend/public/images/hero.jpg').read_bytes(),'image/jpeg')
store().put('outfits',uid,'fitting-test-look',{'id':'fitting-test-look','products':products,'owned':[{'id':'owned-test-shirt'}]})
job=GenerationJob(id='fitting-test-preview',kind='try_on',status='succeeded',stage='Preview test fixture',payload={'outfit_id':'fitting-test-look'},result={'media_id':image,'reference_media_id':'source-must-not-load','label':'Test media fixture — no AI generation', 'pieces':[{'kind':'product','id':products[0]['id'],'name':products[0]['name'],'category':products[0]['category'],'image':products[0]['image'],'sample':True}]}).model_dump(mode='json')
store().put('jobs',uid,job['id'],job)
`,
      JSON.stringify([auth.user_id, products]),
    ],
    {
      cwd: backend,
      env: {
        ...process.env,
        STORE_BACKEND: "sqlite",
        DATA_DIR: dataDir!,
        ENABLE_PAID_AI: "false",
        MEDIA_BUCKET: "",
      },
    },
  );
  await page.addInitScript(
    (token) => localStorage.setItem("flairify-token", token),
    auth.token,
  );
  const sourceRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("source-must-not-load")) sourceRequests.push(r.url());
  });
  await page.goto("/");
  const navigate = async (name: string) => {
    const visible = page
      .getByRole("button", { name, exact: true })
      .filter({ visible: true });
    if (await visible.count()) await visible.click();
    else {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name, exact: true })
        .click();
    }
  };
  await expect(page.locator(".app-shell")).toBeVisible();
  await navigate("Fitting Room");
  const card = page.locator(".generation-card");
  await expect(
    card.getByAltText("AI-generated style visualization"),
  ).toBeVisible();
  await expect(
    card.getByText("Your uploaded photo", { exact: true }),
  ).toHaveCount(0);
  await expect(card.getByAltText("Original reference photo")).toHaveCount(0);
  await expect(card.locator(".preview-shopping-items li")).toHaveCount(3);
  await expect(
    card.getByRole("button", { name: "Buy", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-fitting-shop.png`,
    fullPage: true,
  });
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
  await card.getByRole("button", { name: "Buy", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".checkout-item")).toHaveCount(
    3,
  );
  await page.getByLabel("I confirm the items, sizes and quantities.").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Buy", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "My orders." })).toBeVisible();
  await expect(page.locator(".order-line")).toHaveCount(3);
  await expect(page.locator(".order-card")).toContainText(
    "From the Fitting Room",
  );
  expect(await page.locator("body").innerText()).not.toMatch(/\bmock\b/i);
  await page.reload();
  await navigate("My Orders");
  await expect(page.locator(".order-line")).toHaveCount(3);
  const order = (await (await request.get("/api/orders", { headers })).json())
    .orders[0];
  expect(order.source).toBe("fitting_room");
  expect(order.preview_job_id).toBe("fitting-test-preview");
  expect(order.payment_status).toBe("not_required");
  expect(sourceRequests).toEqual([]);
});
