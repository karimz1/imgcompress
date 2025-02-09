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

const videoDir = path.join(__dirname, "e2e-test-results/");

// Pre-test cleanup: remove the old videos folder
if (fs.existsSync(videoDir)) {
  fs.rmSync(videoDir, { recursive: true, force: true });
}
fs.mkdirSync(videoDir, { recursive: true });

export default defineConfig({
  testDir: "tests/e2e",
  globalTimeout: minutesToMilliseconds(30), // for the entire run
  timeout: minutesToMilliseconds(20), // per test
  expect: {
    timeout: minutesToMilliseconds(20), // for each expectation
  },
  use: {
    headless: true,
    // Use the env variable if set; default to localhost:3000 for local dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    launchOptions: {
      slowMo: 2000,
    },
    video: { mode: "on" },
  },
  outputDir: "e2e-test-results/",
});
