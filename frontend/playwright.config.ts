import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const videoDir = path.join(__dirname, "e2e-test-results/");

// Pre-test cleanup: remove the old videos folder
if (fs.existsSync(videoDir))
  fs.rmSync(videoDir, { recursive: true, force: true });
fs.mkdirSync(videoDir, { recursive: true });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000 * 10, // Overall test timeout (10 minutes)
  expect: {
    timeout: 60000, // Increase expect timeout to 60 seconds
  },
  use: {
    actionTimeout: 60000, // Timeout for individual actions (60 seconds)
    headless: true,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: 2000,
    },
    video: { mode: "on" },
  },
  outputDir: "e2e-test-results/",
});
