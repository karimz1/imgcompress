import path from "path";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { downloadFilesAsync } from "./utls/downloadHelper";
import {
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
} from "./utls/helpers";

/**
 * E2E: the design tools of the image editor. Size presets, gradients,
 * text and picture layers, editing shortcuts and the small-screen editor.
 * Pixels are checked on the server preview, and the export must match it.
 */

const demoDir =
  process.env.IMGCOMPRESS_DEMO_IMAGES_DIR ||
  path.resolve(__dirname, "../../../images/exact-image-resize");
const original = path.join(demoDir, "imgcompress-og-image.webp");
const mod = process.platform === "darwin" ? "Meta" : "Control";

type RecordedFitRequest = { fields: Record<string, string> };

/** Playwright cannot read multipart bodies with a Blob, so the page records the fields. */
function recordFitRequests() {
  const recorded: RecordedFitRequest[] = [];
  (window as unknown as { __fitRequests: RecordedFitRequest[] }).__fitRequests = recorded;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/crop/fit") && init?.body instanceof FormData) {
      const fields: Record<string, string> = {};
      init.body.forEach((value, key) => {
        fields[key] = typeof value === "string" ? value : `${value.name}:${value.size}`;
      });
      recorded.push({ fields });
    }
    return original(input, init);
  };
}

const fitRequestCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fitRequests: RecordedFitRequest[] }).__fitRequests.length);

const lastFitRequest = async (page: Page) =>
  (
    await page.evaluate(
      () => (window as unknown as { __fitRequests: RecordedFitRequest[] }).__fitRequests,
    )
  ).at(-1)?.fields;

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

/** 800 x 800 on a solid colour, image at `scale` percent so the canvas shows around it. */
async function openSolidCanvas(page: Page, color = "000000", scale = 100) {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "fit");
  await page.getByTestId("fit-preset-custom").click();
  await page.getByTestId("fit-width-input").fill("800");
  await page.getByTestId("fit-height-input").fill("800");
  await page.getByTestId("fit-mode-solid-btn").click();
  await expect(page.getByTestId("crop-fit-output-size")).toContainText("800 × 800");
  if (scale !== 100) {
    await page.getByTestId("fit-scale-input").fill(String(scale));
    await page.getByTestId("fit-scale-input").press("Enter");
  }
  await showTab(page, "background");
  await page.getByTestId(`fit-color-swatch-${color}`).click();
  await expect.poll(async () => (await lastFitRequest(page))?.fit_color).toBe(`#${color}`);
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
}

async function readPreview(page: Page): Promise<Buffer> {
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await expect(page.getByTestId("crop-blur-canvas")).toHaveAttribute("data-current", "true");
  const url = await page.getByTestId("crop-blur-canvas").getAttribute("src");
  if (!url) throw new Error("No output preview");
  return Buffer.from(url.split(",")[1], "base64");
}

async function convert(page: Page): Promise<Buffer> {
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(1);
  const [exported] = await downloadFilesAsync(page, page.getByTestId("drawer-uploaded-file-item-link"));
  return sharp(exported).toBuffer();
}

/** Mean RGBA of a region, 0-255 per channel. */
async function regionMean(image: Buffer, left: number, top: number, width: number, height: number) {
  const region = await sharp(image).ensureAlpha().extract({ left, top, width, height }).png().toBuffer();
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

const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

function expectNear(actual: number[], expected: number[], tolerance: number, what: string) {
  const worst = Math.max(...expected.map((value, index) => Math.abs(actual[index] - value)));
  expect(worst, `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

/** Saves, exports and checks the export is the preview. */
async function expectExportMatches(page: Page, preview: Buffer) {
  await page.getByTestId("crop-save-btn").click();
  await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
  const exported = await convert(page);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
}

/** 100 x 100, left half opaque red, right half fully transparent. */
const halfRedPng = () =>
  sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      {
        input: { create: { width: 50, height: 100, channels: 4, background: { r: 230, g: 20, b: 20, alpha: 1 } } },
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

async function addPicture(page: Page, name = "sticker.png") {
  await showTab(page, "layers");
  const uploaded = page.waitForResponse((r) => r.url().endsWith("/api/editor/assets"));
  await page.getByTestId("fit-picture-input").setInputFiles({ name, mimeType: "image/png", buffer: await halfRedPng() });
  expect((await uploaded).status()).toBe(200);
  await expect(page.getByTestId("fit-picture-controls")).toBeVisible();
}

const layerRows = (page: Page) => page.getByTestId("fit-layer-row");

test("size presets fill width and height; Custom keeps them editable", async ({ page }) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "fit");
  // Two groups: social posts first, then video and screen sizes (with Custom last).
  await expect(page.getByTestId("fit-preset-group-social").getByRole("radio")).toHaveCount(8);
  await expect(page.getByTestId("fit-preset-group-screen").getByRole("radio")).toHaveCount(4);
  await expect(page.getByTestId("fit-preset-group-screen").getByTestId("fit-preset-custom")).toBeVisible();
  for (const [preset, size] of [
    ["youtube-thumbnail", "1280 × 720"],
    ["shorts-story", "1080 × 1920"],
    ["instagram-portrait", "1080 × 1350"],
    ["pinterest-pin", "1000 × 1500"],
    ["full-hd", "1920 × 1080"],
    ["qhd", "2560 × 1440"],
    ["uhd-4k", "3840 × 2160"],
    ["open-graph", "1200 × 630"],
  ] as const) {
    await page.getByTestId(`fit-preset-${preset}`).click();
    await expect(page.getByTestId(`fit-preset-${preset}`)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("crop-fit-output-size")).toContainText(size);
  }
  await expect(page.getByTestId("fit-width-input")).toHaveCount(0);
  // Custom starts from the last preset.
  await page.getByTestId("fit-preset-custom").click();
  await expect(page.getByTestId("fit-width-input")).toHaveValue("1200");
  await expect(page.getByTestId("fit-height-input")).toHaveValue("630");
  await page.getByTestId("fit-width-input").fill("640");
  await expect(page.getByTestId("crop-fit-output-size")).toContainText("640 × 630");
  // The tile labels stay inside their tiles, also on a 1440 px screen.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const tile of await page.getByTestId("fit-presets").getByRole("radio").all()) {
    const fits = await tile.evaluate((el) => [...el.querySelectorAll("span")].every((s) => s.scrollWidth <= s.clientWidth + 1));
    expect(fits).toBe(true);
  }
});

test("4K preset: the preview stays a small proxy, the export is exactly 3840 × 2160", async ({ page }) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "fit");
  await page.getByTestId("fit-preset-uhd-4k").click();
  await page.getByTestId("fit-mode-blur-btn").click();
  await expect(page.getByTestId("crop-fit-output-size")).toContainText("3840 × 2160");
  await expect.poll(async () => (await lastFitRequest(page))?.fit_width).toBe("3840");
  expect((await lastFitRequest(page))?.fit_height).toBe("2160");
  // The editor never renders 4K while you work, only a 2048 px proxy.
  const preview = await sharp(await readPreview(page)).metadata();
  expect([preview.width, preview.height]).toEqual([2048, 1152]);
  await page.getByTestId("crop-save-btn").click();
  await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
  const exported = await sharp(await convert(page)).metadata();
  expect([exported.width, exported.height]).toEqual([3840, 2160]);
});

test("picture limit comes from the server setting MAX_UPLOAD_SIZE_MB and the message names it", async ({ page }) => {
  // The server is configured with 1 MB here (docker-compose: MAX_UPLOAD_SIZE_MB=1).
  await page.route("**/config/runtime.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ DISABLE_LOGO: "false", DISABLE_STORAGE_MANAGEMENT: "false", DEV_MODE: "false", MAX_UPLOAD_SIZE_MB: "1" }),
    }),
  );
  await page.reload();
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  const tooBig = { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(1024 * 1024 + 512 * 1024) };

  await showTab(page, "layers");
  await page.getByTestId("fit-picture-input").setInputFiles(tooBig);
  await expect(page.getByTestId("fit-layers-error")).toHaveText(/\b1\s?MB\b/);
  await expect(page.getByTestId("fit-picture-controls")).toHaveCount(0);
  // Below the limit still works.
  await addPicture(page);

  await showTab(page, "fit");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByTestId("fit-mode-image-btn").click(),
  ]);
  await chooser.setFiles(tooBig);
  await expect(page.getByTestId("fit-background-error")).toHaveText(/\b1\s?MB\b/);
});

test("solid fill gradient: preset and direction, preview matches the stage and the export", async ({ page }) => {
  await openSolidCanvas(page, "000000", 30);
  await page.getByTestId("fit-gradient-toggle").check();
  await page.getByTestId("fit-gradient-preset-ocean").click();
  await expect(page.getByTestId("fit-gradient-preset-ocean")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("fit-gradient-direction-90").click();
  await expect
    .poll(async () => {
      const fields = await lastFitRequest(page);
      return [fields?.fit_color, fields?.fit_color_to, fields?.fit_gradient_angle];
    })
    .toEqual(["#0ea5e9", "#6366f1", "90"]);
  // The stage draws the same gradient with CSS while the server renders.
  await expect(page.getByTestId("fit-placement-canvas")).toHaveAttribute("data-gradient", /linear-gradient\(90deg/);
  const preview = await readPreview(page);
  // Left to right: the start colour on the left edge, the end colour on the right edge.
  expectNear(await regionMean(preview, 0, 0, 4, 800), rgb("#0ea5e9"), 6, "left edge");
  expectNear(await regionMean(preview, 796, 0, 4, 800), rgb("#6366f1"), 6, "right edge");
  // Same colour from top to bottom.
  expectNear(await regionMean(preview, 0, 0, 4, 40), await regionMean(preview, 0, 760, 4, 40), 2, "left column");
  await expectExportMatches(page, preview);
});

test("tint gradient on a background picture runs top to bottom and exports like the preview", async ({ page }) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "fit");
  await page.getByTestId("fit-preset-custom").click();
  await page.getByTestId("fit-width-input").fill("600");
  await page.getByTestId("fit-height-input").fill("600");
  const white = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByTestId("fit-mode-image-btn").click(),
  ]);
  await chooser.setFiles({ name: "white.png", mimeType: "image/png", buffer: white });
  // Picking the picture leads straight to the background tab.
  await expect(page.getByTestId("crop-tab-background")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("fit-background-name")).toHaveText("white.png");
  await showTab(page, "fit");
  await page.getByTestId("fit-scale-input").fill("30");
  await page.getByTestId("fit-scale-input").press("Enter");
  await showTab(page, "background");
  await page.getByTestId("fit-tint-swatch-000000").click();
  await page.getByTestId("fit-tint-slider").fill("1");
  await page.getByTestId("fit-tint-style-gradient").click();
  await expect(page.getByTestId("fit-tint-style-gradient")).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => {
      const fields = await lastFitRequest(page);
      return [fields?.fit_tint, fields?.fit_tint_color, fields?.fit_tint_angle];
    })
    .toEqual(["1", "#000000", "180"]);
  const to = (await lastFitRequest(page))!.fit_tint_color_to;
  expect(to).toMatch(/^#[0-9a-f]{6}$/);
  const preview = await readPreview(page);
  // A full-strength tint is the gradient itself: start colour on top, end colour at the bottom.
  expectNear(await regionMean(preview, 0, 0, 600, 3), [0, 0, 0], 6, "top row");
  expectNear(await regionMean(preview, 0, 597, 600, 3), rgb(to), 6, "bottom row");
  await expectExportMatches(page, preview);
});

test("info hints explain a term on hover and on tap", async ({ page }) => {
  await openSolidCanvas(page);
  await page.getByTestId("fit-gradient-info").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/gradient/i);
  // Moving away closes it (Radix checks the next moves against its hover grace area).
  await page.mouse.move(5, 5, { steps: 6 });
  await expect(tooltip).toHaveCount(0);
  // Touch users tap: a click toggles it.
  await showTab(page, "fit");
  await page.getByTestId("fit-size-info").click();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("text layers: quick styles, editing, bold shortcut, fonts, limits; export matches the preview", async ({ page }) => {
  await openSolidCanvas(page, "000000");
  const before = await readPreview(page);
  await showTab(page, "layers");
  await expect(page.getByTestId("fit-layers-empty")).toBeVisible();

  await page.getByTestId("fit-add-title").click();
  const input = page.getByTestId("fit-text-input");
  // The sample text is selected, so typing replaces it.
  await expect(input).toBeFocused();
  await page.keyboard.type("Hallo Welt");
  await expect(input).toHaveValue("Hallo Welt");
  await expect(page.getByTestId("fit-text-count")).toHaveText("10 / 200");
  await expect(page.getByTestId("fit-text-frame")).toHaveAttribute("data-selected", "true");
  await expect.poll(async () => JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]")[0]?.text).toBe("Hallo Welt");

  // Bold by button and by shortcut on the stage.
  await expect(page.getByTestId("fit-text-bold")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("fit-text-bold").click();
  await expect(page.getByTestId("fit-text-bold")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("fit-placement-stage").focus();
  await page.keyboard.press(`${mod}+b`);
  await expect(page.getByTestId("fit-text-bold")).toHaveAttribute("aria-pressed", "true");

  // A bundled font is used on the stage, the same file as in the export.
  await page.getByTestId("fit-text-font").selectOption("jetbrains-mono");
  await expect(page.getByTestId("fit-text-layer")).toHaveCSS("font-family", /imgc-jetbrains-mono/);
  expect(
    await page.evaluate(async () => {
      await document.fonts.load('700 32px "imgc-jetbrains-mono"');
      return document.fonts.check('700 32px "imgc-jetbrains-mono"');
    }),
  ).toBe(true);
  // Caveat has no italics.
  await page.getByTestId("fit-text-font").selectOption("caveat");
  await expect(page.getByTestId("fit-text-italic")).toBeDisabled();
  await page.getByTestId("fit-text-font").selectOption("inter");

  // At most 200 characters.
  await input.fill("x".repeat(250));
  await expect(input).toHaveValue("x".repeat(200));
  await input.fill("Hallo Welt");

  // White text in the middle of a black canvas.
  await expect.poll(async () => JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]")[0]?.font_id).toBe("inter");
  const preview = await readPreview(page);
  expect(await pixelDifference(before, preview)).toBeGreaterThan(1);
  const [r, g, b] = await regionMean(preview, 100, 290, 600, 100);
  expect(Math.min(r, g, b)).toBeGreaterThan(20);

  // Five texts at most.
  for (let count = 2; count <= 5; count++) await page.getByTestId("fit-add-subtitle").click();
  await expect(layerRows(page)).toHaveCount(5);
  await expect(page.getByTestId("fit-add-title")).toBeDisabled();
  for (let count = 5; count > 1; count--) await page.getByTestId("fit-layer-delete").first().click();
  await expect(layerRows(page)).toHaveCount(1);

  await expectExportMatches(page, await readPreview(page));
});

test("double-clicking a text on the stage opens it for editing", async ({ page }) => {
  await openSolidCanvas(page);
  await showTab(page, "layers");
  await page.getByTestId("fit-add-watermark").click();
  await showTab(page, "fit");
  const frame = (await page.getByTestId("fit-text-frame").boundingBox())!;
  await page.mouse.dblclick(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await expect(page.getByTestId("crop-tab-layers")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("fit-text-input")).toBeFocused();
});

test("picture layers: alpha kept, snapping guides, aspect lock with Shift to free it", async ({ page }) => {
  await openSolidCanvas(page, "000000", 30);
  const before = await readPreview(page);
  await addPicture(page);
  await expect(layerRows(page)).toHaveCount(1);
  await expect(layerRows(page).first()).toHaveAttribute("data-kind", "image");
  const frame = page.getByTestId("fit-layer-frame");
  await expect(frame).toHaveAttribute("data-selected", "true");

  // While dragging near the centre, guides show; they go away on release.
  let box = (await frame.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 3, centre.y + 2, { steps: 4 });
  await expect(page.getByTestId("fit-snap-guide-x").first()).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(0);

  // A corner keeps the shape; with Shift it can change.
  box = (await frame.boundingBox())!;
  const ratio = box.width / box.height;
  let handle = (await page.getByTestId("fit-layer-handle-se").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 10, { steps: 6 });
  await page.mouse.up();
  box = (await frame.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(ratio, 1);
  handle = (await page.getByTestId("fit-layer-handle-se").boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  box = (await frame.boundingBox())!;
  expect(box.width / box.height).toBeGreaterThan(ratio * 1.2);

  // Back to its own shape, then check the transparent half stays see-through.
  const sentBefore = await fitRequestCount(page);
  await page.getByTestId("fit-picture-reset").click();
  // Square picture on a square canvas: square again once the reset is sent.
  // Only requests after the click count; an earlier one may be square too.
  await expect
    .poll(async () => {
      if ((await fitRequestCount(page)) <= sentBefore) return 0;
      const layer = JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]")[0];
      return layer ? Math.round((layer.width / layer.height) * 100) : 0;
    })
    .toBe(100);
  const sent = JSON.parse((await lastFitRequest(page))!.fit_layers)[0];
  expect((await lastFitRequest(page))!.fit_session).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  const left = Math.round((sent.x - sent.width / 2) * 800);
  const top = Math.round((sent.y - sent.height / 2) * 800);
  const width = Math.round(sent.width * 800);
  const height = Math.round(sent.height * 800);
  // The see-through half leaves what is below untouched. Polled, as the preview
  // of the stretched picture may still be on screen for a moment.
  const clear = [left + Math.ceil(width / 2) + 4, top + 4, Math.floor(width / 2) - 8, height - 8] as const;
  const below = await regionMean(before, ...clear);
  await expect
    .poll(async () => {
      const mean = await regionMean(await readPreview(page), ...clear);
      return Math.max(...below.map((value, index) => Math.abs(mean[index] - value)));
    })
    .toBeLessThanOrEqual(3);
  const preview = await readPreview(page);
  expectNear(await regionMean(preview, left + 4, top + 4, Math.floor(width / 2) - 8, height - 8), [230, 20, 20], 8, "red half");
  await expectExportMatches(page, preview);
});

test("editing keys and toolbar: delete, undo, redo, duplicate, Esc and the shortcut list", async ({ page }) => {
  await openSolidCanvas(page);
  await addPicture(page);
  const stage = page.getByTestId("fit-placement-stage");
  const undo = page.getByTestId("fit-undo-btn");
  const redo = page.getByTestId("fit-redo-btn");
  await expect(redo).toBeDisabled();

  await stage.focus();
  await page.keyboard.press("Delete");
  await expect(layerRows(page)).toHaveCount(0);
  await page.keyboard.press(`${mod}+z`);
  await expect(layerRows(page)).toHaveCount(1);
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect(layerRows(page)).toHaveCount(0);
  await undo.click();
  await expect(layerRows(page)).toHaveCount(1);
  await redo.click();
  await expect(layerRows(page)).toHaveCount(0);
  await undo.click();

  // Duplicate lands slightly offset and is selected.
  await page.getByTestId("fit-layer-select").first().click();
  await stage.focus();
  await page.keyboard.press(`${mod}+d`);
  await expect(layerRows(page)).toHaveCount(2);
  await page.getByTestId("fit-duplicate-btn").click();
  await expect(layerRows(page)).toHaveCount(3);
  await page.getByTestId("fit-delete-btn").click();
  await expect(layerRows(page)).toHaveCount(2);

  // Deleting leaves nothing selected; pick one again, then arrow keys move it.
  await expect(stage).toHaveAttribute("data-has-selection", "false");
  await page.getByTestId("fit-layer-select").first().click();
  const frame = page.getByTestId("fit-layer-frame");
  const start = (await frame.boundingBox())!;
  await stage.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await frame.boundingBox())!.x).toBeGreaterThan(start.x + 2);

  // The first Esc only deselects; the dialog stays open.
  await page.keyboard.press("Escape");
  await expect(stage).toHaveAttribute("data-has-selection", "false");
  await expect(page.getByTestId("crop-dialog")).toBeVisible();

  // '?' opens and closes the shortcut list.
  await stage.focus();
  await page.keyboard.press("?");
  const popover = page.getByTestId("fit-shortcuts-popover");
  await expect(popover).toBeVisible();
  await expect(popover).toContainText(/Esc/);
  await page.keyboard.press("?");
  await expect(popover).toHaveCount(0);
  await page.getByTestId("fit-shortcuts-btn").click();
  await expect(popover).toBeVisible();
});

test("small screens get crop and size only; the design made on a desktop stays", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSolidCanvas(page);
  for (const tab of ["crop", "fit", "background", "layers"])
    await expect(page.getByTestId(`crop-tab-${tab}`)).toBeVisible();
  await showTab(page, "layers");
  await page.getByTestId("fit-add-title").click();
  await expect.poll(async () => JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]").length).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("crop-adjust-trigger").click();
  await expect(page.getByTestId("crop-tab-crop-mobile")).toBeVisible();
  await expect(page.getByTestId("crop-tab-fit-mobile")).toBeVisible();
  await expect(page.getByTestId("crop-tab-background-mobile")).toHaveCount(0);
  await expect(page.getByTestId("crop-tab-layers-mobile")).toHaveCount(0);
  await expect(page.getByTestId("crop-tab-fit-mobile")).toHaveAttribute("aria-selected", "true");
  const note = page.getByTestId("crop-compact-note-mobile");
  await expect(note).toBeVisible();
  // Two sentences: more options on a desktop, and the design is kept.
  expect((await note.textContent())!.split(/[.!。]/).filter((part) => part.trim()).length).toBeGreaterThanOrEqual(2);
  // The solid colour stays reachable without the background tab.
  await expect(page.getByTestId("fit-color-input-mobile")).toBeVisible();
  // The picture background is a desktop tool.
  await expect(page.getByTestId("fit-mode-image-btn-mobile")).toHaveCount(0);
  await page.getByTestId("fit-color-swatch-ffffff-mobile").click();
  await expect.poll(async () => (await lastFitRequest(page))?.fit_color).toBe("#ffffff");
  expect(JSON.parse((await lastFitRequest(page))!.fit_layers)).toHaveLength(1);
});
