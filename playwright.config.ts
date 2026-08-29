import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  workers: 1,
  reporter: [["json", { outputFile: process.env.HARNESS_PLAYWRIGHT_JSON ?? ".harness/playwright.json" }]],
  use: {
    baseURL: process.env.HARNESS_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
