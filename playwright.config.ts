import { defineConfig, devices } from "@playwright/test";

// Browser tests for the pronunciation trainer. Run through tests/e2e/run.mjs,
// which starts the app against the local Supabase stack and sets APP and the keys.
export default defineConfig({
  testDir: "tests/browser",
  outputDir: "test-results",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP ?? "http://localhost:3200",
    locale: "ru-RU",
    launchOptions: {
      // A synthetic microphone; permission prompts are accepted automatically.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
