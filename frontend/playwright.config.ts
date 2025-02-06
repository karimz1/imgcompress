// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", // or wherever your tests are located
  timeout: 30_000,     // Global test timeout
  use: {
    headless: true,
    // baseURL: "http://localhost:5000",
    // trace: "on-first-retry",
  },
  // Additional config like reporter, projects, etc.
});
