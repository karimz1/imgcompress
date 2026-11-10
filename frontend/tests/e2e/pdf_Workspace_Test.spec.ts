import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

async function pdfFile(name: string, sizes: [number, number][]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  sizes.forEach((size, index) => pdf.addPage(size).drawText(`${name} page ${index + 1}`, { x: 20, y: 40, size: 12, font }));
  return { name, mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) };
}

async function imageFile(name = "photo.png") {
  return { name, mimeType: "image/png", buffer: await sharp({ create: { width: 120, height: 80, channels: 4, background: "#e74c3c" } }).png().toBuffer() };
}

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem("imgcompress_locale", "en"));
  await page.route("**/config/runtime.json", (route) => route.fulfill({ json: { DISABLE_UPDATE_CHECK: "true", MAX_UPLOAD_SIZE_MB: "40" } }));
  if (process.env.PLAYWRIGHT_API_URL) {
    await page.route("**/api/**", async (route) => {
      const original = new URL(route.request().url());
      const response = await route.fetch({ url: `${process.env.PLAYWRIGHT_API_URL}${original.pathname}${original.search}` });
      await route.fulfill({ response });
    });
  }
  await page.goto("/");
  await expect(page.getByTestId("supported-formats-count")).toHaveText(/^[1-9]\d*$/);
  await page.locator("#outputFormat").click();
  await page.getByRole("option", { name: "PDF", exact: true }).click();
}

async function openFiles(page: Page, files: Awaited<ReturnType<typeof pdfFile>>[], merge = true) {
  await page.getByTestId("dropzone-input").setInputFiles(files);
  await expect(page.getByTestId("dropzone-added-file")).toHaveCount(files.length);
  if (merge) await page.getByRole("tab", { name: "Merge only", exact: true }).click();
  await page.getByTestId("pdf-workspace-open").click();
  await expect(page.getByTestId("pdf-workspace-input")).toBeEnabled();
  // Coordinate-based gestures need the opening dialog animation to finish first.
  await page.getByTestId("pdf-workspace").evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
}

test("combines images and PDF pages with exclusions, drag ordering and rotation", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  const workspace = page.getByTestId("pdf-workspace");
  await openFiles(page, [
    await pdfFile("first.pdf", [[300, 400], [320, 420], [340, 440]]),
    await pdfFile("second.pdf", [[500, 700]]),
    await imageFile(),
  ]);
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(5);
  await expect(page.getByTestId("pdf-workspace-download")).toBeEnabled();
  await cards.nth(1).getByRole("checkbox").uncheck();
  const thumbnail = await cards.last().getByTestId("pdf-workspace-thumbnail").boundingBox();
  const target = await cards.first().getByTestId("pdf-workspace-thumbnail").boundingBox();
  await page.mouse.move(thumbnail!.x + thumbnail!.width / 2, thumbnail!.y + thumbnail!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 24 });
  // The order changes while the pointer is held, rather than jumping only on drop.
  await expect(cards.first()).toContainText("photo.png");
  await page.mouse.up();
  await expect(cards.first()).not.toHaveClass(/opacity-20/);
  await cards.last().getByRole("button", { name: /^Rotate/ }).click();
  await expect(page.getByTestId("pdf-workspace-count")).toHaveText("4 of 5 pages included");
  await workspace.getByLabel("File name", { exact: true }).fill("combined");
  await workspace.screenshot({ path: info.outputPath("pdf-workspace-desktop.png") });
  const downloading = page.waitForEvent("download");
  await page.getByTestId("pdf-workspace-download").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("combined.pdf");
  const result = await PDFDocument.load(await readFile((await download.path())!));
  expect(result.getPageCount()).toBe(4);
  expect(result.getPages().map((item) => [item.getWidth(), item.getHeight()])).toEqual([[90, 60], [300, 400], [340, 440], [500, 700]]);
  expect(result.getPages()[3].getRotation().angle).toBe(90);
  await expect(workspace.getByRole("status")).toContainText("Your PDF is ready");
  expect(errors).toEqual([]);
});

test("includes current imports, keeps edits on close, and supports removal with undo", async ({ page }) => {
  await start(page);
  await openFiles(page, [await pdfFile("source.pdf", [[300, 400], [320, 420], [340, 440]])]);
  const workspace = page.getByTestId("pdf-workspace");
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(3);
  await workspace.getByRole("button", { name: "Deselect all", exact: true }).click();
  await expect(page.getByTestId("pdf-workspace-download")).toBeDisabled();
  await workspace.getByRole("button", { name: "Select all", exact: true }).click();
  await cards.nth(1).getByRole("checkbox").uncheck();
  await workspace.getByRole("button", { name: "Remove excluded", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await workspace.getByRole("button", { name: "Undo removal", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(1).getByRole("checkbox")).not.toBeChecked();
  await cards.last().getByRole("button", { name: /^Delete/ }).click();
  await expect(cards).toHaveCount(2);
  await workspace.getByRole("button", { name: "Undo removal", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await workspace.getByTestId("dialog-close").click();
  await page.getByTestId("pdf-workspace-open").click();
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(1).getByRole("checkbox")).not.toBeChecked();
  await workspace.getByRole("button", { name: "Clear workspace", exact: true }).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByTestId("pdf-workspace-download")).toBeDisabled();
});

test("keeps valid pages after a bad import and permits retrying a failed export", async ({ page }) => {
  await start(page);
  await openFiles(page, [await imageFile()]);
  await expect(page.getByTestId("pdf-workspace-input")).toBeEnabled();
  await page.getByTestId("pdf-workspace-input").setInputFiles([
    { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("Not a PDF") },
  ]);
  const workspace = page.getByTestId("pdf-workspace");
  await expect(workspace.getByRole("alert")).toContainText("broken.pdf");
  await expect(workspace.getByTestId("pdf-workspace-page")).toHaveCount(1);
  await page.getByTestId("pdf-workspace-input").setInputFiles(await pdfFile("valid.pdf", [[300, 400]]));
  await expect(workspace.getByTestId("pdf-workspace-page")).toHaveCount(2);
  await page.route("**/api/pdf/merge", (route) => route.fulfill({ status: 500, json: { error: "Please retry" } }));
  await page.getByTestId("pdf-workspace-download").click();
  await expect(workspace.getByRole("alert")).toContainText("Please retry");
  await expect(workspace.getByTestId("pdf-workspace-page")).toHaveCount(2);
  await page.unroute("**/api/pdf/merge");
  const downloading = page.waitForEvent("download");
  await page.getByTestId("pdf-workspace-download").click();
  const result = await PDFDocument.load(await readFile((await (await downloading).path())!));
  expect(result.getPageCount()).toBe(2);
});

test("supports touch-sized layouts, move buttons, and enlarged previews", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await openFiles(page, [
    await imageFile(), await pdfFile("mobile.pdf", [[300, 400]]),
  ]);
  const workspace = page.getByTestId("pdf-workspace");
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("pdf-workspace-download")).toBeEnabled();
  await cards.last().getByRole("button", { name: /^Move .* earlier/ }).click();
  await expect(cards.first()).toContainText("mobile.pdf");
  await cards.first().getByRole("button", { name: /^Preview/ }).click();
  const preview = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "mobile.pdf", exact: true }) });
  await expect(preview.getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(async () => {
    const bounds = await workspace.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  }).toPass({ timeout: 3000 });
  expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByTestId("pdf-workspace-download")).toBeInViewport();
  await workspace.screenshot({ path: info.outputPath("pdf-workspace-mobile.png") });
});

test("offers PDF modes only for PDF and enables the workspace after importing files", async ({ page }) => {
  await start(page);
  await expect(page.getByRole("tab", { name: "Merge only", exact: true })).toBeDisabled();
  await expect(page.getByTestId("pdf-workspace-open")).toHaveCount(0);
  await page.getByTestId("dropzone-input").setInputFiles(await imageFile());
  await expect(page.getByTestId("pdf-workspace-open")).toBeVisible();
  await page.getByRole("tab", { name: "Merge only", exact: true }).click();
  await expect(page.locator("#pdfPreset")).not.toBeVisible();
  await expect(page.getByTestId("convert-btn")).not.toBeVisible();
  await page.getByRole("tab", { name: "Convert", exact: true }).click();
  await expect(page.locator("#pdfPreset")).toBeVisible();
  await page.locator("#outputFormat").click();
  await page.getByRole("option", { name: /^JPEG/ }).click();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByTestId("pdf-workspace-open")).toHaveCount(0);
});

test("normal PDF preview uses page format, margins, quality and pagination, while merge keeps originals", async ({ page }) => {
  await start(page);
  await page.locator("#pdfPreset").click();
  await page.getByRole("option", { name: "A4 Portrait", exact: true }).click();
  await page.getByTestId("pdfMarginInput").fill("12");
  await page.getByTestId("pdf-quality-select").click();
  await page.getByTestId("pdf-quality-option-small").click();
  await page.getByTestId("pdf-paginate-switch").click();
  const longImage = { name: "long.png", mimeType: "image/png", buffer: await sharp({ create: { width: 240, height: 1400, channels: 3, background: "#529adc" } }).png().toBuffer() };
  await openFiles(page, [longImage], false);
  const workspace = page.getByTestId("pdf-workspace");
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(4);
  await expect(page.getByTestId("pdf-workspace-settings")).toContainText("12 mm");
  await expect(page.getByTestId("pdf-workspace-settings")).toContainText("96 DPI");
  await cards.nth(1).getByRole("checkbox").uncheck();
  const downloading = page.waitForEvent("download");
  await page.getByTestId("pdf-workspace-download").click();
  const result = await PDFDocument.load(await readFile((await (await downloading).path())!));
  expect(result.getPageCount()).toBe(3);
  expect(result.getPages().map((item) => [item.getWidth(), item.getHeight()])).toEqual([[595, 842], [595, 842], [595, 842]]);
  await workspace.getByTestId("dialog-close").click();
  await page.getByRole("tab", { name: "Merge only", exact: true }).click();
  await page.getByTestId("pdf-workspace-open").click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId("pdf-workspace-settings")).toContainText("Original page sizes");
});

test("optional OCR sends the selected installed language and retains pages on failure", async ({ page }) => {
  await start(page);
  await page.route("**/api/pdf/ocr", (route) => route.fulfill({ json: { available: true, languages: ["deu", "eng"] } }));
  await openFiles(page, [await imageFile()]);
  const workspace = page.getByTestId("pdf-workspace");
  const ocr = workspace.getByRole("checkbox", { name: "Recognize text (OCR)", exact: true });
  await expect(ocr).toBeEnabled();
  await ocr.check();
  await workspace.getByLabel("OCR language", { exact: true }).selectOption("deu");
  await page.route("**/api/pdf/merge", async (route) => {
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('name="ocr"\r\n\r\ntrue');
    expect(body).toContain('name="ocr_language"\r\n\r\ndeu');
    await route.fulfill({ status: 400, json: { error: "OCR test failure" } });
  });
  await expect(workspace.getByTestId("pdf-workspace-page")).toHaveCount(1);
  await page.getByTestId("pdf-workspace-download").click();
  await expect(workspace.getByRole("alert")).toHaveText("OCR test failure");
  await expect(workspace.getByTestId("pdf-workspace-page")).toHaveCount(1);
});

test("Escape cancels a live preview drag without closing the editor", async ({ page }) => {
  await start(page);
  await openFiles(page, [await imageFile("one.png"), await imageFile("two.png")]);
  const workspace = page.getByTestId("pdf-workspace");
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("pdf-workspace-download")).toBeEnabled();
  const from = await cards.last().getByTestId("pdf-workspace-thumbnail").boundingBox();
  const to = await cards.first().getByTestId("pdf-workspace-thumbnail").boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 15 });
  await expect(cards.first()).toContainText("two.png");
  await expect(page.locator("[data-pdf-drag-preview]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(workspace).toBeVisible();
  await expect(cards.first()).toContainText("one.png");
  await expect(page.locator("[data-pdf-drag-preview]")).toHaveCount(0);
});

test("touch users can hold and drag a preview while ordinary swipes keep scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await start(page);
  await openFiles(page, [await imageFile("one.png"), await imageFile("two.png")]);
  const workspace = page.getByTestId("pdf-workspace");
  const cards = workspace.getByTestId("pdf-workspace-page");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("pdf-workspace-download")).toBeEnabled();
  const from = await cards.last().getByTestId("pdf-workspace-thumbnail").boundingBox();
  const to = await cards.first().getByTestId("pdf-workspace-thumbnail").boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const x = from!.x + from!.width / 2;
  const y = from!.y + from!.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  // A deliberate hold activates touch sorting; an immediate swipe remains a scroll gesture.
  await expect(page.locator("[data-pdf-drag-preview]")).toBeVisible();
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: to!.x + to!.width / 2, y: to!.y + to!.height / 2 }] });
  await expect(cards.first()).toContainText("two.png");
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("[data-pdf-drag-preview]")).toHaveCount(0);
  await expect(workspace).toBeVisible();
});
