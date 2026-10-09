import fs from "fs";
import path from "path";
import sharp, { type Region } from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { downloadFilesAsync } from "./utls/downloadHelper";
import {
  setOutputFormatAsync,
  clickConversionButtonAsync,
  clearStorageManagerAsync,
} from "./utls/helpers";

const demoDir =
  process.env.IMGCOMPRESS_DEMO_IMAGES_DIR ||
  path.resolve(__dirname, "../../../images/exact-image-resize");
const original = path.join(demoDir, "imgcompress-og-image.webp");

test.beforeEach(async ({ page, request }) => {
  await clearStorageManagerAsync(request);
  await page.goto("/");
  await setOutputFormatAsync(page, "PNG");
});

for (const [mode, reference] of [
  ["crop", "keep-important-content-automatic/cut_imgcompress-og-image.jpg"],
  ["blur", "blurred-background/blurred-imgcompress-og-image.jpg"],
] as const) {
  test(`${mode}: preview and exported pixels match, and content matches the README demo`, async ({
    page,
  }, testInfo) => {
    await page.getByTestId("dropzone-input").setInputFiles(original);
    await page.getByTestId("dropzone-crop-file-btn").click();
    await expect(page.getByTestId("crop-selection")).toBeVisible();
    await expect(page.getByTestId("crop-fit-preview")).toHaveCount(0);
    await page.getByTestId(`fit-mode-${mode}-btn`).click();
    await page.getByTestId("crop-auto-fit-btn").click();
    await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
    const preview = await readPreview(page);
    await expect(page.getByTestId("crop-fit-output-size")).toContainText(
      "1280 × 640",
    );
    if (mode === "blur") {
      await expect(page.getByTestId("crop-selection")).toHaveCount(0);
      await expect(page.getByTestId("crop-blur-canvas")).toBeVisible();
    } else {
      await expect(page.getByTestId("crop-width-input")).toHaveValue("1536");
      await expect(page.getByTestId("crop-height-input")).toHaveValue("768");
    }
    await page.screenshot({ path: testInfo.outputPath(`${mode}-editor.png`) });
    await page.getByTestId("crop-save-btn").click();
    await expect(page.getByTestId("dropzone-crop-badge")).toContainText(
      "1280 × 640",
    );

    // Opening a saved edit restores the same output, rather than choosing a
    // new automatic position at reopen or conversion time.
    await page.getByTestId("dropzone-crop-file-btn").click();
    await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
    expect(await readPreview(page)).toEqual(preview);
    await page.getByTestId("crop-save-btn").click();
    const exported = await convert(page);
    await testInfo.attach(`${mode}-export.png`, {
      path: exported,
      contentType: "image/png",
    });
    const metadata = await sharp(exported).metadata();
    expect([metadata.width, metadata.height]).toEqual([1280, 640]);
    expect(await pixelDifference(fs.readFileSync(exported), preview)).toBe(0);

    // README references are JPEGs, so allow compression differences while
    // checking framing and content across all four regions of the image.
    const expected = fs.readFileSync(path.join(demoDir, reference));
    expect(
      await pixelDifference(fs.readFileSync(exported), expected),
    ).toBeLessThan(5);
    for (const region of [
      { left: 0, top: 0, width: 640, height: 320 },
      { left: 640, top: 0, width: 640, height: 320 },
      { left: 0, top: 320, width: 640, height: 320 },
      { left: 640, top: 320, width: 640, height: 320 },
    ]) {
      expect(
        await pixelDifference(fs.readFileSync(exported), expected, region),
      ).toBeLessThan(7);
    }
  });
}

test("a manual adjustment updates the preview and survives export", async ({
  page,
}) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const automatic = await readPreview(page);
  const changed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/crop/fit") &&
      response.request().method() === "POST",
  );
  await page.getByTestId("crop-width-input").fill("1000");
  await changed;
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const manual = await readPreview(page);
  expect(await pixelDifference(manual, automatic)).toBeGreaterThan(20);
  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  expect(await pixelDifference(fs.readFileSync(exported), manual)).toBe(0);
});

test("Auto fit all prepares each source separately and each export keeps its own preview", async ({
  page,
}) => {
  const portrait = await sharp({
    create: { width: 300, height: 600, channels: 3, background: "#d62828" },
  })
    .png()
    .toBuffer();
  await page.getByTestId("dropzone-input").setInputFiles([
    {
      name: "imgcompress-og-image.webp",
      mimeType: "image/webp",
      buffer: fs.readFileSync(original),
    },
    { name: "portrait.png", mimeType: "image/png", buffer: portrait },
  ]);
  await page.getByTestId("dropzone-crop-file-btn").first().click();
  await page.getByTestId("fit-mode-blur-btn").click();
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-auto-fit-all-btn")).toBeEnabled();
  await page.getByTestId("crop-auto-fit-all-btn").click();
  await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
  await expect(page.getByTestId("dropzone-crop-badge")).toHaveCount(2);
  const previews: Buffer[] = [];
  for (let index = 0; index < 2; index++) {
    await page.getByTestId("dropzone-crop-file-btn").nth(index).click();
    await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
    previews.push(await readPreview(page));
    await page.getByTestId("crop-save-btn").click();
  }
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(
    2,
  );
  const exports = await downloadFilesAsync(
    page,
    page.getByTestId("drawer-uploaded-file-item-link"),
  );
  expect(exports).toHaveLength(2);
  for (const exported of exports) {
    const index = path.basename(exported).startsWith("portrait") ? 1 : 0;
    expect(
      await pixelDifference(fs.readFileSync(exported), previews[index]),
    ).toBe(0);
  }
});

test("invalid dimensions and preview failures cannot save a new fit", async ({
  page,
}) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await page.getByTestId("fit-preset-select").click();
  await page.getByTestId("fit-preset-option-custom").click();
  await page.getByTestId("fit-width-input").fill("8193");
  await expect(page.getByTestId("crop-auto-fit-btn")).toBeDisabled();
  await expect(page.getByTestId("crop-save-btn")).toBeDisabled();
  await page.getByTestId("fit-width-input").fill("1000");
  await page.route("**/api/crop/fit", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"error":"Preview unavailable"}',
    }),
  );
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-fit-error")).toContainText(
    "Preview unavailable",
  );
  await expect(page.getByTestId("crop-save-btn")).toBeDisabled();
});

test("mobile editor exposes Auto fit and shows the blurred canvas before saving", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-adjust-trigger").click();
  await page.getByTestId("fit-mode-blur-btn-mobile").click();
  await page.getByTestId("crop-auto-fit-btn-mobile").click();
  await expect(page.getByTestId("crop-fit-preview-mobile")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("crop-adjust-drawer")).toHaveCount(0);
  await expect(page.getByTestId("crop-blur-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-editor.png") });
  await page.getByTestId("crop-save-btn-mobile").click();
  const exported = await convert(page);
  const metadata = await sharp(exported).metadata();
  expect([metadata.width, metadata.height]).toEqual([1280, 640]);
});

test("a failed batch keeps every previously saved edit", async ({ page }) => {
  const buffer = fs.readFileSync(original);
  await page.getByTestId("dropzone-input").setInputFiles([
    { name: "first.webp", mimeType: "image/webp", buffer },
    { name: "second.webp", mimeType: "image/webp", buffer },
  ]);
  await page.getByTestId("dropzone-crop-file-btn").first().click();
  await page.getByTestId("crop-width-input").fill("1000");
  await page.getByTestId("crop-save-btn").click();
  const previous = await page.getByTestId("dropzone-crop-badge").textContent();
  await page.getByTestId("dropzone-crop-file-btn").first().click();
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-auto-fit-all-btn")).toBeEnabled();
  let requests = 0;
  await page.route("**/api/crop/fit", (route) => {
    requests++;
    return requests === 2
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: '{"error":"Second image failed"}',
        })
      : route.continue();
  });
  await page.getByTestId("crop-auto-fit-all-btn").click();
  await expect(page.getByTestId("crop-fit-error")).toContainText(
    "Second image failed",
  );
  await page.getByTestId("crop-discard-btn").click();
  await page.getByTestId("crop-discard-confirm-btn").click();
  await expect(page.getByTestId("dropzone-crop-badge")).toHaveCount(1);
  await expect(page.getByTestId("dropzone-crop-badge")).toHaveText(
    previous ?? "",
  );
});

test("conversion can be cancelled while rendering the saved fit", async ({
  page,
}) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-auto-fit-btn").click();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await page.getByTestId("crop-save-btn").click();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/crop/fit", async (route) => {
    await hold;
    await route.abort();
  });
  let compressionRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/compress")) compressionRequests++;
  });
  const rendering = page.waitForRequest((request) =>
    request.url().endsWith("/api/crop/fit"),
  );
  await clickConversionButtonAsync(page);
  await rendering;
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await expect(page.getByTestId("convert-btn")).toBeEnabled();
  await expect(page.getByTestId("error-holder")).toHaveCount(0);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(
    0,
  );
  expect(compressionRequests).toBe(0);
});

async function readPreview(page: Page): Promise<Buffer> {
  await expect(page.getByTestId("crop-fit-preview")).toBeVisible();
  const url = await page.getByTestId("crop-fit-preview").getAttribute("src");
  if (!url) throw new Error("No output preview");
  return Buffer.from(url.split(",")[1], "base64");
}

async function convert(page: Page): Promise<string> {
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(
    1,
  );
  const [exported] = await downloadFilesAsync(
    page,
    page.getByTestId("drawer-uploaded-file-item-link"),
  );
  return exported;
}

async function pixelDifference(
  a: Buffer,
  b: Buffer,
  region?: Region,
): Promise<number> {
  const decode = (buffer: Buffer) => {
    const image = sharp(buffer).removeAlpha().toColourspace("srgb");
    return (region ? image.extract(region) : image).raw().toBuffer();
  };
  const [left, right] = await Promise.all([decode(a), decode(b)]);
  expect(left.length).toBe(right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
}
