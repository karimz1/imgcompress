import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000 * 10, 
  expect: {
    timeout: 60000 *2, 
  },
  // Run tests sequentially so storage cleanup calls do not race with other specs.
  workers: 1,
  use: {
    actionTimeout: 60000 *2,
    headless: true,
    // Keep the default desktop layout roomy; dedicated cases also exercise
    // laptop and phone widths. The editor uses a side panel from 1024px.
    viewport: { width: 1600, height: 720 },
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: process.env.CI ? 0 : 2000,
    },
    video: { mode: "on" },
  },
  // Playwright clears this once per run. Clearing it on config import also
  // erased earlier image comparisons whenever a worker was restarted.
  outputDir: path.join(__dirname, "e2e-test-results"),
});
