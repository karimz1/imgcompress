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
  timeout: 60000 * 10, // 60sec*10 = 10Min
  use: {
    actionTimeout: 60000, // 60s timout for each test
    headless: true,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: 2000,
    },
    video: { mode: "on" },
  },
  outputDir: "e2e-test-results/",
});
