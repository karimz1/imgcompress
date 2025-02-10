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
  use: {
    headless: true,
    timeout: 120000, // 2 minutes timeout per test
    globalTimeout: 600000, // 10 minutes max timeout
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: 2000,
    },
    video: { mode: "on" },
  },
  outputDir: "e2e-test-results/",
});
