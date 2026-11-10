import path from "path";
import sharp from "sharp";
import { devices, expect, test, type CDPSession, type Page } from "@playwright/test";
import { downloadFilesAsync } from "./utls/downloadHelper";
import { clearStorageManagerAsync, clickConversionButtonAsync, setOutputFormatAsync } from "./utls/helpers";

/**
 * E2E: the editor on an iPad Pro. In landscape (1194 and 1366 px wide) it is the
 * full editor, used by touch; in portrait (834 px) it is the small phone editor.
 * Chromium emulates the iPad here (screen, touch); WebKit is not part of the suite.
 */

const demoDir =
  process.env.IMGCOMPRESS_DEMO_IMAGES_DIR ||
  path.resolve(__dirname, "../../../images/exact-image-resize");
const original = path.join(demoDir, "imgcompress-og-image.webp");

const { defaultBrowserType: _landscapeBrowser, ...ipadLandscape } = devices["iPad Pro 11 landscape"];
const { defaultBrowserType: _portraitBrowser, ...ipadPortrait } = devices["iPad Pro 11"];

type Fields = Record<string, string>;
type Point = { x: number; y: number };

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
const sentText = async (page: Page) => JSON.parse((await lastFitRequest(page))?.fit_layers ?? "[]")[0];

/** Fingers on the screen, through the browser's touch input (pointerType "touch"). */
async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({ x: point.x, y: point.y, id })),
  });
}

async function touchDrag(cdp: CDPSession, from: Point, to: Point) {
  await touch(cdp, "touchStart", [from]);
  for (let step = 1; step <= 10; step++) {
    await touch(cdp, "touchMove", [{ x: from.x + ((to.x - from.x) * step) / 10, y: from.y + ((to.y - from.y) * step) / 10 }]);
  }
  await touch(cdp, "touchEnd", []);
}

async function pinch(cdp: CDPSession, centre: Point, fromGap: number, toGap: number) {
  const fingers = (gap: number) => [
    { x: centre.x - gap / 2, y: centre.y },
    { x: centre.x + gap / 2, y: centre.y },
  ];
  await touch(cdp, "touchStart", fingers(fromGap));
  for (let step = 1; step <= 10; step++) await touch(cdp, "touchMove", fingers(fromGap + ((toGap - fromGap) * step) / 10));
  await touch(cdp, "touchEnd", []);
}

async function doubleTap(cdp: CDPSession, at: Point) {
  for (let tap = 0; tap < 2; tap++) {
    await touch(cdp, "touchStart", [at]);
    await touch(cdp, "touchEnd", []);
  }
}

const centreOf = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

async function readPreview(page: Page): Promise<Buffer> {
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await expect(page.getByTestId("crop-blur-canvas")).toHaveAttribute("data-current", "true");
  const url = await page.getByTestId("crop-blur-canvas").getAttribute("src");
  if (!url) throw new Error("No output preview");
  return Buffer.from(url.split(",")[1], "base64");
}

async function pixelDifference(a: Buffer, b: Buffer): Promise<number> {
  const decode = (buffer: Buffer) => sharp(buffer).ensureAlpha().toColourspace("srgb").raw().toBuffer();
  const [left, right] = await Promise.all([decode(a), decode(b)]);
  expect(left.length).toBe(right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
}

async function openEditor(page: Page) {
  await page.addInitScript(recordFitRequests);
  await page.goto("/");
  await setOutputFormatAsync(page, "PNG");
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").tap();
}

test.describe("iPad Pro 11 in landscape", () => {
  test.use(ipadLandscape);

  test("full editor by touch: preset, title moved and pinched bigger, double-tap edits, blurred background, export 1600 × 900", async ({
    page,
    request,
  }) => {
    await clearStorageManagerAsync(request);
    await openEditor(page);
    const cdp = await page.context().newCDPSession(page);

    // The whole editor, inside the 834 px high screen.
    for (const tab of ["crop", "fit", "background", "layers"]) await expect(page.getByTestId(`crop-tab-${tab}`)).toBeVisible();
    await expect(page.getByTestId("crop-tab-background-mobile")).toHaveCount(0);
    const dialog = (await page.getByTestId("crop-dialog").boundingBox())!;
    expect(dialog.y).toBeGreaterThanOrEqual(0);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(834);
    await expect(page.getByTestId("crop-save-btn")).toBeInViewport();

    await page.getByTestId("crop-tab-fit").tap();
    await page.getByTestId("fit-preset-x-post").tap();
    await expect.poll(async () => [(await lastFitRequest(page))?.fit_width, (await lastFitRequest(page))?.fit_height]).toEqual(["1600", "900"]);
    await page.getByTestId("fit-mode-blur-btn").tap();
    await expect.poll(async () => (await lastFitRequest(page))?.fit_mode).toBe("blur");

    await page.getByTestId("crop-tab-layers").tap();
    await page.getByTestId("fit-add-title").tap();
    await page.getByTestId("fit-text-input").fill("Hallo iPad");
    await expect.poll(async () => (await sentText(page))?.text).toBe("Hallo iPad");
    const placed = await sentText(page);

    // Big enough to hit with a finger: toolbar buttons and the 44 px area around a handle.
    const undo = (await page.getByTestId("fit-undo-btn").boundingBox())!;
    expect(Math.min(undo.width, undo.height)).toBeGreaterThanOrEqual(44);
    const handle = centreOf((await page.getByTestId("fit-text-handle-se").boundingBox())!);
    expect(
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), {
        x: handle.x + 18,
        y: handle.y + 18,
      }),
    ).toBe("fit-text-handle-se");

    // One finger moves the title up and to the left.
    const frame = page.getByTestId("fit-text-frame");
    const start = centreOf((await frame.boundingBox())!);
    const pageBefore = await page.evaluate(() => [window.scrollX, window.scrollY, window.visualViewport?.scale ?? 1]);
    await touchDrag(cdp, start, { x: start.x - 120, y: start.y - 60 });
    await expect.poll(async () => (await sentText(page)).x).toBeLessThan(placed.x - 0.05);
    expect((await sentText(page)).y).toBeLessThan(placed.y - 0.03);
    // The page itself did not scroll or zoom.
    expect(await page.evaluate(() => [window.scrollX, window.scrollY, window.visualViewport?.scale ?? 1])).toEqual(pageBefore);

    // Two fingers make it bigger, like Ctrl + wheel.
    const moved = await sentText(page);
    await pinch(cdp, centreOf((await frame.boundingBox())!), 60, 180);
    await expect.poll(async () => (await sentText(page)).size).toBeGreaterThan(moved.size * 1.5);

    // Double-tap on the stage opens the text for editing.
    await page.getByTestId("crop-tab-fit").tap();
    await doubleTap(cdp, centreOf((await frame.boundingBox())!));
    await expect(page.getByTestId("crop-tab-layers")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fit-text-input")).toBeFocused();
    await expect(page.getByTestId("fit-text-input")).toHaveValue("Hallo iPad");

    const preview = await readPreview(page);
    await page.getByTestId("crop-save-btn").tap();
    await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
    await clickConversionButtonAsync(page);
    await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(1);
    const [file] = await downloadFilesAsync(page, page.getByTestId("drawer-uploaded-file-item-link"));
    const exported = await sharp(file).toBuffer();
    const metadata = await sharp(exported).metadata();
    expect([metadata.width, metadata.height]).toEqual([1600, 900]);
    expect(await pixelDifference(preview, exported)).toBeLessThan(1);
  });
});

test.describe("iPad Pro in portrait and 12.9 in landscape", () => {
  test.use(ipadPortrait);

  test("portrait gets the small editor with the hint; 1366 px landscape the full one", async ({ page }) => {
    await openEditor(page);
    await page.getByTestId("crop-adjust-trigger").tap();
    await expect(page.getByTestId("crop-tab-crop-mobile")).toBeVisible();
    await page.getByTestId("crop-tab-fit-mobile").tap();
    await expect(page.getByTestId("crop-tab-fit-mobile")).toBeVisible();
    await expect(page.getByTestId("crop-tab-background-mobile")).toHaveCount(0);
    await expect(page.getByTestId("crop-tab-layers-mobile")).toHaveCount(0);
    await expect(page.getByTestId("crop-compact-note-mobile")).toBeVisible();

    // Turned to landscape on the 12.9" model.
    await page.setViewportSize({ width: 1366, height: 1024 });
    for (const tab of ["crop", "fit", "background", "layers"]) await expect(page.getByTestId(`crop-tab-${tab}`)).toBeVisible();
    await expect(page.getByTestId("crop-save-btn")).toBeInViewport();
  });
});
