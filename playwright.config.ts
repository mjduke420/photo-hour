import { defineConfig, devices } from "@playwright/test";

const EXTERNAL_URL = process.env.PHOTO_HOUR_URL;

export default defineConfig({
  testDir: "./e2e",
  // The shadow pass ray-marches a large raster, so first paint after a terrain
  // load is genuinely slow, especially on a software renderer in CI.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: EXTERNAL_URL ?? "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  ...(EXTERNAL_URL
    ? {}
    : {
        webServer: {
          command: "node packages/server/dist/index.js",
          port: 8080,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
