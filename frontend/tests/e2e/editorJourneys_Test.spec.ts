import path from "path";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { downloadFilesAsync } from "./utls/downloadHelper";
import { clearStorageManagerAsync, clickConversionButtonAsync, setOutputFormatAsync } from "./utls/helpers";

/**
 * E2E: what people actually make with the editor, start to finish. Each journey
 * ends with an export that has the exact size and the same pixels as the preview.
 * Single tools are tested in editorDesign_Test and fitToSize_*; crop-only, phones
 * and two users at once in crop_Test, editorDesign_Test and multiUser_Isolation_Test.
 */

const demoDir =
  process.env.IMGCOMPRESS_DEMO_IMAGES_DIR ||
  path.resolve(__dirname, "../../../images/exact-image-resize");
const original = path.join(demoDir, "imgcompress-og-image.webp");
const mod = process.platform === "darwin" ? "Meta" : "Control";

type Fields = Record<string, string>;

/** Playwright cannot read multipart bodies with a Blob, so the page records the fields. */
function recordFitRequests() {
  const recorded: Fields[] = [];
  (window as unknown as { __fitRequests: Fields[] }).__fitRequests = recorded;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/crop/fit") && init?.body instanceof FormData) {
      const fields: Fields = {};
      init.body.forEach((value, key) => {
        fields[key] = typeof value === "string" ? value : `${value.name}:${value.size}`;
      });
      recorded.push(fields);
    }
    return original(input, init);
  };
}

const lastFitRequest = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __fitRequests: Fields[] }).__fitRequests)).at(-1);

const sentLayers = async (page: Page) => JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]");

test.beforeEach(async ({ page, request }) => {
  await clearStorageManagerAsync(request);
  await page.addInitScript(recordFitRequests);
  await page.goto("/");
  await setOutputFormatAsync(page, "PNG");
});

async function showTab(page: Page, tab: "crop" | "fit" | "background" | "layers") {
  const button = page.getByTestId(`crop-tab-${tab}`);
  if ((await button.getAttribute("aria-selected")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-selected", "true");
}

async function openEditorWithPreset(page: Page, preset: string, size: [number, number]) {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "fit");
  await page.getByTestId(`fit-preset-${preset}`).click();
  await expect
    .poll(async () => {
      const fields = await lastFitRequest(page);
      return [Number(fields?.fit_width), Number(fields?.fit_height)];
    })
    .toEqual(size);
}

async function readPreview(page: Page): Promise<Buffer> {
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await expect(page.getByTestId("crop-blur-canvas")).toHaveAttribute("data-current", "true");
  const url = await page.getByTestId("crop-blur-canvas").getAttribute("src");
  if (!url) throw new Error("No output preview");
  return Buffer.from(url.split(",")[1], "base64");
}

/** Saves, converts and checks the download: exact size, and the pixels of the preview. */
async function saveAndExport(page: Page, preview: Buffer, size: [number, number]) {
  await page.getByTestId("crop-save-btn").click();
  await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(1);
  const [file] = await downloadFilesAsync(page, page.getByTestId("drawer-uploaded-file-item-link"));
  const exported = await sharp(file).toBuffer();
  const metadata = await sharp(exported).metadata();
  expect([metadata.width, metadata.height]).toEqual(size);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
  return exported;
}

async function regionMean(image: Buffer, left: number, top: number, width: number, height: number) {
  const region = await sharp(image).removeAlpha().extract({ left, top, width, height }).png().toBuffer();
  const { channels } = await sharp(region).stats();
  return channels.map((channel) => Math.round(channel.mean));
}

async function pixelDifference(a: Buffer, b: Buffer): Promise<number> {
  const decode = (buffer: Buffer) => sharp(buffer).ensureAlpha().toColourspace("srgb").raw().toBuffer();
  const [left, right] = await Promise.all([decode(a), decode(b)]);
  expect(left.length).toBe(right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
}

const colourDistance = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const centreOf = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** Drags a turn handle by ``degrees`` (clockwise) around ``centre``. */
async function turnHandle(page: Page, handle: string, centre: { x: number; y: number }, degrees: number, shift = false) {
  const start = centreOf((await page.getByTestId(handle).boundingBox())!);
  const dx = start.x - centre.x;
  const dy = start.y - centre.y;
  const rad = (degrees * Math.PI) / 180;
  if (shift) await page.keyboard.down("Shift");
  await drag(page, start, {
    x: centre.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: centre.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  });
  if (shift) await page.keyboard.up("Shift");
}

test("YouTube thumbnail: own background picture, blur and dark gradient, tilted title and logo, 1280 × 720", async ({ page }) => {
  await openEditorWithPreset(page, "youtube-thumbnail", [1280, 720]);
  // The video frame a bit smaller, on a blurred picture of its own.
  const backdrop = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#f59e0b" } })
    .composite([{ input: { create: { width: 320, height: 360, channels: 3, background: "#0ea5e9" } }, left: 320, top: 0 }])
    .png()
    .toBuffer();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByTestId("fit-mode-image-btn").click()]);
  await chooser.setFiles({ name: "backdrop.png", mimeType: "image/png", buffer: backdrop });
  await expect(page.getByTestId("crop-tab-background")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("fit-background-name")).toContainText("backdrop.png");
  await page.getByTestId("fit-blur-slider").fill("0.5");
  await page.getByTestId("fit-tint-swatch-000000").click();
  await page.getByTestId("fit-tint-slider").fill("0.8");
  await page.getByTestId("fit-tint-style-gradient").click();
  await expect
    .poll(async () => {
      const fields = await lastFitRequest(page);
      return [fields?.fit_blur, fields?.fit_tint, fields?.fit_tint_color];
    })
    .toEqual(["0.5", "0.8", "#000000"]);
  await showTab(page, "fit");
  await page.getByTestId("fit-scale-input").fill("70");
  await expect.poll(async () => (await lastFitRequest(page))?.fit_scale).toBe("0.7");
  const withoutTitle = await readPreview(page);

  await showTab(page, "layers");
  await page.getByTestId("fit-add-title").click();
  await page.keyboard.type("Mein neues Video");
  await expect(page.getByTestId("fit-text-bold")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await sentLayers(page))[0]?.text).toBe("Mein neues Video");
  expect((await sentLayers(page))[0].bold).toBe(true);
  // Tilt the title: roughly with the handle on the stage, exactly in the angle field.
  const title = page.getByTestId("fit-text-frame");
  const straight = (await title.boundingBox())!;
  await turnHandle(page, "fit-text-rotate-handle", centreOf(straight), 30);
  await expect.poll(async () => (await sentLayers(page))[0]?.rotation ?? 0).toBeGreaterThan(22);
  expect((await sentLayers(page))[0].rotation).toBeLessThan(38);
  await page.getByTestId("fit-text-rotation-input").fill("20");
  await expect.poll(async () => (await sentLayers(page))[0]?.rotation).toBe(20);
  expect((await title.boundingBox())!.height).toBeGreaterThan(straight.height * 2);

  // A logo, tilted the other way.
  const logo = await sharp({ create: { width: 120, height: 40, channels: 3, background: "#e11d48" } }).png().toBuffer();
  await page.getByTestId("fit-picture-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await expect(page.getByTestId("fit-layer-frame")).toHaveAttribute("data-selected", "true");
  await page.getByTestId("fit-picture-rotation-input").fill("-10");
  const sentLogo = async () => (await sentLayers(page)).find((layer: { type: string }) => layer.type === "image");
  await expect.poll(async () => (await sentLogo())?.rotation).toBe(-10);
  await expect(page.getByTestId("fit-layer-frame")).toHaveAttribute("data-angle", "-10");

  const preview = await readPreview(page);
  expect(await pixelDifference(withoutTitle, preview)).toBeGreaterThan(0.3);
  // The gradient darkens the top of the side strips more than the bottom.
  const top = await regionMean(preview, 10, 10, 120, 40);
  const bottom = await regionMean(preview, 10, 670, 120, 40);
  expect(top.reduce((a, b) => a + b)).toBeLessThan(bottom.reduce((a, b) => a + b));
  await saveAndExport(page, preview, [1280, 720]);
});

test("Shorts: vertical 1080 × 1920, wide picture zoomed and moved to fill the frame", async ({ page }) => {
  await openEditorWithPreset(page, "shorts-story", [1080, 1920]);
  await page.getByTestId("fit-mode-blur-btn").click();
  await expect.poll(async () => (await lastFitRequest(page))?.fit_mode).toBe("blur");
  const filled = await readPreview(page);

  // Zoom the wide picture in until it covers the tall frame, then slide it to show its left part.
  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  const centre = centreOf(stage);
  await page.mouse.move(centre.x, centre.y);
  await page.keyboard.down(mod);
  for (let tick = 0; tick < 12; tick++) await page.mouse.wheel(0, -100);
  await page.keyboard.up(mod);
  await expect.poll(async () => Number(await page.getByTestId("fit-scale-input").inputValue())).toBeGreaterThan(300);
  await expect.poll(async () => pixelDifference(filled, await readPreview(page))).toBeGreaterThan(3);
  const zoomed = await readPreview(page);
  await drag(page, centre, { x: centre.x + stage.width * 0.4, y: centre.y });
  await expect.poll(async () => pixelDifference(zoomed, await readPreview(page))).toBeGreaterThan(3);

  const preview = await readPreview(page);
  await saveAndExport(page, preview, [1080, 1920]);
});

test("Instagram post: watermark and a logo in the corner, a deleted logo comes back with undo", async ({ page }) => {
  await openEditorWithPreset(page, "instagram-post", [1080, 1080]);
  await page.getByTestId("fit-mode-blur-btn").click();
  await showTab(page, "layers");
  await page.getByTestId("fit-add-watermark").click();
  await expect.poll(async () => (await sentLayers(page)).length).toBe(1);

  // The logo: left half red, right half see-through.
  const logo = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 50, height: 100, channels: 4, background: { r: 230, g: 20, b: 20, alpha: 1 } } }, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/editor/assets"));
  await page.getByTestId("fit-picture-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  expect((await uploaded).status()).toBe(200);
  const frame = page.getByTestId("fit-layer-frame");
  await expect(frame).toHaveAttribute("data-selected", "true");

  // Drag it into the bottom-right corner; it snaps to both edges.
  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  const box = (await frame.boundingBox())!;
  const from = centreOf(box);
  await drag(page, from, {
    x: from.x + (stage.x + stage.width - (box.x + box.width)) - 2,
    y: from.y + (stage.y + stage.height - (box.y + box.height)) - 2,
  });
  const cornered = async () => {
    const picture = (await sentLayers(page)).find((layer: { type: string }) => layer.type === "image");
    return picture ? [Math.round((picture.x + picture.width / 2) * 1000), Math.round((picture.y + picture.height / 2) * 1000)] : null;
  };
  await expect.poll(cornered).toEqual([1000, 1000]);

  // Oops, deleted. Undo brings it back where it was; redo and undo again.
  const rows = page.getByTestId("fit-layer-row");
  await expect(rows).toHaveCount(2);
  await page.getByTestId("fit-placement-stage").focus();
  await page.keyboard.press("Delete");
  await expect(rows).toHaveCount(1);
  await page.keyboard.press(`${mod}+z`);
  await expect(rows).toHaveCount(2);
  await page.getByTestId("fit-redo-btn").click();
  await expect(rows).toHaveCount(1);
  await page.getByTestId("fit-undo-btn").click();
  await expect(rows).toHaveCount(2);
  await expect.poll(cornered).toEqual([1000, 1000]);

  const preview = await readPreview(page);
  const picture = (await sentLayers(page)).find((layer: { type: string }) => layer.type === "image");
  const left = Math.round((picture.x - picture.width / 2) * 1080);
  const top = Math.round((picture.y - picture.height / 2) * 1080);
  const half = Math.floor((picture.width * 1080) / 2);
  const height = Math.round(picture.height * 1080);
  const exported = await saveAndExport(page, preview, [1080, 1080]);
  // The red half of the logo sits in the corner of the export.
  expect(colourDistance(await regionMean(exported, left + 4, top + 4, half - 8, height - 8), [230, 20, 20])).toBeLessThan(30);
});

test("Background picture: moved, zoomed, turned 20°, darkened, a little blur and a gradient tint, 1280 × 720", async ({ page }) => {
  await openEditorWithPreset(page, "youtube-thumbnail", [1280, 720]);
  // Four colours, so moving, zooming and turning all show in the pixels.
  const quarter = (background: string) => ({ create: { width: 400, height: 225, channels: 3 as const, background } });
  const backdrop = await sharp(quarter("#f59e0b"))
    .extend({ right: 400, bottom: 225, background: "#0ea5e9" })
    .composite([{ input: quarter("#22c55e"), left: 400, top: 225 }, { input: quarter("#a855f7"), left: 0, top: 225 }])
    .png()
    .toBuffer();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByTestId("fit-mode-image-btn").click()]);
  await chooser.setFiles({ name: "backdrop.png", mimeType: "image/png", buffer: backdrop });
  await expect(page.getByTestId("fit-background-name")).toContainText("backdrop.png");
  // The photo smaller, so the background shows around it.
  await showTab(page, "fit");
  await page.getByTestId("fit-scale-input").fill("50");
  await expect.poll(async () => (await lastFitRequest(page))?.fit_scale).toBe("0.5");
  await showTab(page, "background");
  const plain = await readPreview(page);

  // Pick the background next to the photo and drag it.
  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  const spot = { x: stage.x + stage.width * 0.1, y: stage.y + stage.height * 0.5 };
  await drag(page, spot, { x: spot.x + stage.width * 0.1, y: spot.y + stage.height * 0.1 });
  await expect(page.getByTestId("fit-background-frame")).toHaveAttribute("data-selected", "true");
  await expect.poll(async () => Number((await lastFitRequest(page))?.fit_bg_x)).toBeGreaterThan(0.55);
  // Zoom it with the wheel over the stage.
  const moved = { x: spot.x + stage.width * 0.1, y: spot.y + stage.height * 0.1 };
  await page.mouse.move(moved.x, moved.y);
  await page.keyboard.down(mod);
  for (let tick = 0; tick < 4; tick++) await page.mouse.wheel(0, -100);
  await page.keyboard.up(mod);
  await expect.poll(async () => Number((await lastFitRequest(page))?.fit_bg_scale)).toBeGreaterThan(1.2);
  // Turn it, darken it, blur it a little.
  await page.getByTestId("fit-bg-rotation-input").fill("20");
  await expect.poll(async () => (await lastFitRequest(page))?.fit_bg_rotation).toBe("20");
  await expect(page.getByTestId("fit-background-frame")).toHaveAttribute("data-angle", "20");
  await page.getByTestId("fit-dim-slider").fill("0.4");
  await page.getByTestId("fit-blur-slider").fill("0.1");
  await expect
    .poll(async () => {
      const fields = await lastFitRequest(page);
      return [fields?.fit_dim, fields?.fit_blur, fields?.fit_bg_rotation];
    })
    .toEqual(["0.4", "0.1", "20"]);
  const darkened = await readPreview(page);
  expect(await pixelDifference(plain, darkened)).toBeGreaterThan(3);
  // Darkened: the left strip is darker than the plain background was.
  const sum = (values: number[]) => values.reduce((a, b) => a + b);
  expect(sum(await regionMean(darkened, 10, 300, 100, 120))).toBeLessThan(sum(await regionMean(plain, 10, 300, 100, 120)));
  await saveAndExportAgainAfterTint(page, darkened);
});

/** The gradient variant: a dark tint fading out to the bottom, then the export. */
async function saveAndExportAgainAfterTint(page: Page, before: Buffer) {
  await page.getByTestId("fit-tint-swatch-000000").click();
  await page.getByTestId("fit-tint-slider").fill("0.7");
  await page.getByTestId("fit-tint-style-gradient").click();
  await expect.poll(async () => (await lastFitRequest(page))?.fit_tint_color_to).toBeTruthy();
  const preview = await readPreview(page);
  expect(await pixelDifference(before, preview)).toBeGreaterThan(1);
  await saveAndExport(page, preview, [1280, 720]);
}

test("Fill frame: the photo turned 30° still fills the square, 1080 × 1080", async ({ page }) => {
  await openEditorWithPreset(page, "instagram-post", [1080, 1080]);
  await expect.poll(async () => (await lastFitRequest(page))?.fit_mode).toBe("crop");
  // On the Text & Bilder tab the photo is picked on the stage and turned with Shift (15° steps).
  await showTab(page, "layers");
  const straight = await readPreview(page);
  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  await page.mouse.click(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await expect(page.getByTestId("fit-placement-frame")).toHaveAttribute("data-selected", "true");
  await turnHandle(page, "fit-placement-rotate-handle", centreOf(stage), 17, true);
  await expect.poll(async () => (await lastFitRequest(page))?.fit_rotation).toBe("15");
  expect((await lastFitRequest(page))?.fit_scale).toBeUndefined();
  // The next 15° step from the angle field.
  await showTab(page, "fit");
  await page.getByTestId("fit-rotation-input").press("Shift+ArrowUp");
  await expect.poll(async () => (await lastFitRequest(page))?.fit_rotation).toBe("30");
  await expect(page.getByTestId("fit-rotation-input")).toHaveValue("30");

  await showTab(page, "layers");
  const preview = await readPreview(page);
  expect(await pixelDifference(straight, preview)).toBeGreaterThan(3);
  await saveAndExport(page, preview, [1080, 1080]);
});
