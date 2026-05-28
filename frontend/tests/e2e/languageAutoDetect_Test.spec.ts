import { test, expect } from "@playwright/test";
test.describe("Browser-language auto-detection", () => {
test("falls back to English when no preferred locale matches", async ({
browser,
}) => {
const context = await browser.newContext({ locale: "fr-FR" });
const page = await context.newPage();
await page.addInitScript(() => {
window.localStorage.removeItem("imgcompress_locale");
});
await page.goto("/");
await expect(page.getByText("Output Format", { exact: true })).toBeVisible();
await expect(page.locator("html")).toHaveAttribute("lang", "en");
await context.close();
});
test("uses Hungarian UI on first visit when browser prefers Hungarian", async ({
browser,
}) => {
const context = await browser.newContext({ locale: "hu-HU" });
const page = await context.newPage();
await page.addInitScript(() => {
window.localStorage.removeItem("imgcompress_locale");
});
await page.goto("/");
await expect(
page.getByText("Kimeneti formátum", { exact: true })
).toBeVisible();
await expect(page.locator("html")).toHaveAttribute("lang", "hu");
await context.close();
});
test("stored preference wins over browser language", async ({ browser }) => {
const context = await browser.newContext({ locale: "hu-HU" });
const page = await context.newPage();
await page.addInitScript(() => {
window.localStorage.setItem("imgcompress_locale", "en");
});
await page.goto("/");
await expect(page.getByText("Output Format", { exact: true })).toBeVisible();
await expect(page.locator("html")).toHaveAttribute("lang", "en");
await context.close();
});
});