import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Converts minutes to milliseconds.
 *
 * @param minutes - The number of minutes.
 * @returns The equivalent number of milliseconds.
 */
function minutesToMilliseconds(minutes: number): number {
  return minutes * 60 * 1000;
}

const videoDir = path.join(__dirname, "test-results/");

// Pre-test cleanup: remove the old videos folder
if (fs.existsSync(videoDir)) {
  fs.rmSync(videoDir, { recursive: true, force: true });
}
fs.mkdirSync(videoDir, { recursive: true });

export default defineConfig({
  testDir: "tests/e2e",
  globalTimeout: minutesToMilliseconds(15), // 15 minutes for entire run
  timeout: minutesToMilliseconds(5), // 5 minutes per test
  expect: {
    timeout: minutesToMilliseconds(5), // 5 minutes for each expectation
  },
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
