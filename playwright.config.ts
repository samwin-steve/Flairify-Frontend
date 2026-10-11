import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: process.env.PLAYWRIGHT_BASE_URL ? 120000 : 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      process.env.PLAYWRIGHT_LOCAL_BASE_URL ||
      "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
