import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const videoDir = path.join(__dirname, "test-results/");

// Pre-test cleanup: remove the old videos folder
if (fs.existsSync(videoDir)) {
  fs.rmSync(videoDir, { recursive: true, force: true });
}
fs.mkdirSync(videoDir, { recursive: true });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    headless: true,
    // Use the env variable if set; default to localhost:3000 for local dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: 2000,
    },
    video: { mode: "on" },
    // trace: "on-first-retry",
  },
  outputDir: "test-results/",
});
