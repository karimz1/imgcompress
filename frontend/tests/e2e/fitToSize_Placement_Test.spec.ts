import path from "path";
import sharp from "sharp";
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

type RecordedFitRequest = { fields: Record<string, string>; aborted: boolean };

/**
 * Playwright cannot read multipart bodies that contain a Blob, so the page
 * records the form fields (and whether the request was aborted) itself.
 */
function recordFitRequests() {
  const recorded: RecordedFitRequest[] = [];
  (window as unknown as { __fitRequests: RecordedFitRequest[] }).__fitRequests = recorded;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/crop/fit") && init?.body instanceof FormData) {
      const fields: Record<string, string> = {};
      init.body.forEach((value, key) => {
        // Files are recorded by name and size.
        fields[key] = typeof value === "string" ? value : `${value.name}:${value.size}`;
      });
      const entry = { fields, aborted: false };
      recorded.push(entry);
      init.signal?.addEventListener("abort", () => {
        entry.aborted = true;
      });
    }
    return original(input, init);
  };
}

const fitRequests = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __fitRequests: RecordedFitRequest[] }).__fitRequests,
  );

test.beforeEach(async ({ page, request }) => {
  await clearStorageManagerAsync(request);
  await page.addInitScript(recordFitRequests);
  await page.goto("/");
  await setOutputFormatAsync(page, "PNG");
});

/** Opens the editor on a square 800 x 800 target with the given mode. */
async function openSquareFit(page: Page, mode: "blur" | "solid" | "transparent" | "image") {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-tab-fit").click();
  await page.getByTestId("fit-preset-custom").click();
  await page.getByTestId("fit-width-input").fill("800");
  await page.getByTestId("fit-height-input").fill("800");
  if (mode === "image") {
    // Picking image mode without a picture opens the file chooser at once.
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByTestId("fit-mode-image-btn").click(),
    ]);
    await chooser.setFiles({ name: "backdrop.png", mimeType: "image/png", buffer: await backdropPng() });
  } else {
    await page.getByTestId(`fit-mode-${mode}-btn`).click();
  }
  await expect(page.getByTestId("crop-fit-output-size")).toContainText(
    "800 × 800",
  );
  await expect(page.getByTestId("fit-placement-stage")).toBeVisible();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
}

/** 300 x 100: red left, blue right. Covering 800 x 800 shows the middle of it. */
function backdropPng(): Promise<Buffer> {
  const half = (r: number, g: number, b: number) =>
    sharp({ create: { width: 150, height: 100, channels: 3, background: { r, g, b } } })
      .png()
      .toBuffer();
  return Promise.all([half(220, 30, 30), half(30, 30, 220)]).then(([left, right]) =>
    sharp({ create: { width: 300, height: 100, channels: 3, background: "#000" } })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: right, left: 150, top: 0 },
      ])
      .png()
      .toBuffer(),
  );
}

async function readPreview(page: Page): Promise<Buffer> {
  await expect(page.getByTestId("crop-blur-canvas")).toHaveAttribute(
    "data-current",
    "true",
  );
  const url = await page.getByTestId("crop-blur-canvas").getAttribute("src");
  if (!url) throw new Error("No output preview");
  return Buffer.from(url.split(",")[1], "base64");
}

async function convert(page: Page): Promise<Buffer> {
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(1);
  const [exported] = await downloadFilesAsync(
    page,
    page.getByTestId("drawer-uploaded-file-item-link"),
  );
  return sharp(exported).toBuffer();
}

/** Mean RGBA of a region, 0-255 per channel. */
async function regionMean(
  image: Buffer,
  left: number,
  top: number,
  width: number,
  height: number,
): Promise<number[]> {
  // stats() reads its input, so crop into a new image first.
  const region = await sharp(image)
    .ensureAlpha()
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  const { channels } = await sharp(region).stats();
  return channels.map((channel) => Math.round(channel.mean * 100) / 100);
}

async function pixelDifference(a: Buffer, b: Buffer): Promise<number> {
  const decode = (buffer: Buffer) =>
    sharp(buffer).ensureAlpha().toColourspace("srgb").raw().toBuffer();
  const [left, right] = await Promise.all([decode(a), decode(b)]);
  expect(left.length).toBe(right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
}

/** The image rectangle on the output, in output pixels: left, top, width, height. */
async function frameRect(page: Page): Promise<number[]> {
  const value = await page.getByTestId("fit-placement-frame").getAttribute("data-rect");
  return (value ?? "").split(",").map(Number);
}

/** Colour, blur, tint and patterns live in the background tab; size and placement in the size tab. */
async function showTab(page: Page, tab: "fit" | "background") {
  const button = page.getByTestId(`crop-tab-${tab}`);
  if ((await button.getAttribute("aria-selected")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-selected", "true");
}

/** Presses `key` `count` times on the focused placement stage. */
async function press(page: Page, key: string, count: number) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
}

test("changing the solid colour sends one preview request and never loops", async ({
  page,
}) => {
  await openSquareFit(page, "solid");
  const start = (await fitRequests(page)).length;
  const since = async () => (await fitRequests(page)).slice(start);
  await showTab(page, "background");

  // Dragging the native picker fires many input events in a row.
  await page.getByTestId("fit-color-picker").evaluate((input: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    for (const value of ["#110000", "#330000", "#660000", "#990000", "#cc0000", "#ff0000"]) {
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  // The picker commits after a short pause, then one preview follows.
  await expect
    .poll(async () => regionMean(await readPreview(page), 0, 0, 800, 100))
    .toEqual([255, 0, 0, 255]);
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();

  // Nothing else happens once the preview is current.
  await page.waitForTimeout(1500);
  let requests = await since();
  expect(requests).toHaveLength(1);
  expect(requests[0].fields.fit_color).toBe("#ff0000");
  expect(requests[0].fields).toHaveProperty("crop_x");

  // An incomplete hex value is not sent.
  await page.getByTestId("fit-color-input").fill("#12");
  await expect(page.getByTestId("fit-color-input")).toHaveAttribute("aria-invalid", "true");
  await page.waitForTimeout(800);
  expect(await since()).toHaveLength(1);
  await page.getByTestId("fit-color-input").fill("#0000ff");
  await expect(page.getByTestId("fit-color-input")).not.toHaveAttribute("aria-invalid");
  await expect
    .poll(async () => regionMean(await readPreview(page), 0, 0, 800, 100))
    .toEqual([0, 0, 255, 255]);
  await page.waitForTimeout(1000);
  requests = await since();
  expect(requests).toHaveLength(2);
  expect(requests[1].fields.fit_color).toBe("#0000ff");
});

test("an older preview response never replaces a newer one", async ({ page }) => {
  await openSquareFit(page, "solid");
  // The next preview (black) is slow; the slate one that follows answers at once.
  let delayNext = false;
  let slowSeen!: () => void;
  const slowStarted = new Promise<void>((resolve) => {
    slowSeen = resolve;
  });
  await page.route("**/api/crop/fit", async (route) => {
    if (delayNext) {
      delayNext = false;
      slowSeen();
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    try {
      await route.continue();
    } catch {
      // The browser already aborted this request.
    }
  });
  const start = (await fitRequests(page)).length;
  await showTab(page, "background");
  delayNext = true;
  await page.getByTestId("fit-color-swatch-000000").click();
  await slowStarted;
  await page.getByTestId("fit-color-swatch-0f172a").click();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const slate = [15, 23, 42, 255];
  expect(await regionMean(await readPreview(page), 0, 0, 800, 100)).toEqual(slate);
  const requests = (await fitRequests(page)).slice(start);
  expect(requests.map((request) => [request.fields.fit_color, request.aborted])).toEqual([
    ["#000000", true],
    ["#0f172a", false],
  ]);
  // Even after the slow response would have arrived, the newest one stays.
  await page.waitForTimeout(3000);
  expect(await regionMean(await readPreview(page), 0, 0, 800, 100)).toEqual(slate);
});

test("dragging and resizing the image changes the preview and the export the same way", async ({
  page,
}, testInfo) => {
  await openSquareFit(page, "solid");
  await showTab(page, "background");
  await page.getByTestId("fit-color-swatch-000000").click();
  await expect
    .poll(async () => regionMean(await readPreview(page), 0, 0, 800, 100))
    .toEqual([0, 0, 0, 255]);
  const before = await readPreview(page);
  await showTab(page, "fit");
  const start = (await fitRequests(page)).length;

  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  const frame = (await page.getByTestId("fit-placement-frame").boundingBox())!;
  // Move the image to the top-left corner of the canvas.
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(
      frame.x + frame.width / 2 - ((frame.x - stage.x) * step) / 10,
      frame.y + frame.height / 2 - ((frame.y - stage.y) * step) / 10,
    );
  }
  // While dragging only CSS moves; the server is not asked yet.
  await page.waitForTimeout(400);
  expect((await fitRequests(page)).slice(start)).toHaveLength(0);
  await expect(page.getByTestId("crop-blur-canvas")).toHaveAttribute(
    "data-current",
    "false",
  );
  await page.mouse.up();
  // Near the corner it snaps exactly onto the canvas edges.
  await expect.poll(async () => (await frameRect(page)).slice(0, 2)).toEqual([0, 0]);

  // Halve it with the bottom-right handle; the top-left corner stays put.
  const handle = (await page.getByTestId("fit-placement-handle-se").boundingBox())!;
  const resized = (await page.getByTestId("fit-placement-frame").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 - resized.width / 2,
    handle.y + handle.height / 2 - resized.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const scale = Number(await page.getByTestId("fit-scale-input").inputValue());
  expect(scale).toBeGreaterThan(45);
  expect(scale).toBeLessThan(55);
  expect((await frameRect(page)).slice(0, 2)).toEqual([0, 0]);
  // At most one request per finished gesture, none during the drag.
  const requests = (await fitRequests(page)).slice(start);
  expect(requests.length).toBeGreaterThanOrEqual(1);
  expect(requests.length).toBeLessThanOrEqual(2);
  expect(Number(requests.at(-1)!.fields.fit_scale)).toBeCloseTo(scale / 100, 2);

  const preview = await readPreview(page);
  expect(await pixelDifference(before, preview)).toBeGreaterThan(5);
  // The right half and the bottom half are now empty black canvas.
  expect(await regionMean(preview, 420, 0, 380, 800)).toEqual([0, 0, 0, 255]);
  expect(await regionMean(preview, 0, 300, 800, 500)).toEqual([0, 0, 0, 255]);
  expect((await regionMean(preview, 20, 20, 360, 220)).slice(0, 3).some((v) => v > 30)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("placement-drag.png") });

  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  const metadata = await sharp(exported).metadata();
  expect([metadata.width, metadata.height]).toEqual([800, 800]);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
});

test("scale field, slider, toolbar and arrow keys place the image exactly", async ({ page }) => {
  await openSquareFit(page, "transparent");
  await expect(page.getByTestId("fit-placement-reset-btn")).toBeDisabled();
  await page.getByTestId("fit-scale-input").fill("50");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  // 1536x1024 contained in 800x800 is 800x533; half of that stays centred.
  await expect.poll(() => frameRect(page)).toEqual([200, 267, 400, 267]);
  let preview = await readPreview(page);
  expect((await regionMean(preview, 202, 269, 396, 263))[3]).toBe(255);
  expect((await regionMean(preview, 0, 0, 198, 800))[3]).toBe(0);
  expect((await regionMean(preview, 0, 0, 800, 265))[3]).toBe(0);

  // Arrow keys nudge by one pixel, ten with Shift.
  await page.getByTestId("fit-placement-stage").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => (await frameRect(page)).slice(0, 2)).toEqual([201, 277]);

  await page.getByTestId("fit-placement-center-btn").click();
  await expect.poll(async () => (await frameRect(page)).slice(0, 2)).toEqual([200, 267]);
  await page.getByTestId("fit-placement-fill-btn").click();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  preview = await readPreview(page);
  // Fill covers the whole canvas, so nothing stays transparent.
  expect((await regionMean(preview, 0, 0, 800, 800))[3]).toBe(255);
  await page.getByTestId("fit-placement-fit-btn").click();
  await expect(page.getByTestId("fit-scale-input")).toHaveValue("100");

  // The slider works on a log scale: -1 is half size.
  await page.getByTestId("fit-scale-slider").fill("-1");
  await expect(page.getByTestId("fit-scale-input")).toHaveValue("50");
  await expect.poll(() => frameRect(page)).toEqual([200, 267, 400, 267]);

  // Tooltips name the shortcut. Radix closes a tooltip on click, so hover in fresh.
  await page.getByTestId("fit-placement-hint").hover();
  await page.getByTestId("fit-placement-fit-btn").hover();
  await expect(page.getByRole("tooltip", { name: /(Ctrl|⌘) \+ 0/ })).toBeVisible();

  await page.getByTestId("fit-placement-reset-btn").click();
  await expect(page.getByTestId("fit-placement-reset-btn")).toBeDisabled();
});

test("the placement toolbar fits a narrow panel and its labels stay inside", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await openSquareFit(page, "solid");
  const panel = (await page.getByTestId("fit-placement-controls").boundingBox())!;
  for (const id of ["center", "fit", "fill", "reset"]) {
    const button = page.getByTestId(`fit-placement-${id}-btn`);
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
    // Two-line or clipped labels would make the buttons uneven.
    expect(box.height).toBeLessThan(60);
  }
  const slider = (await page.getByTestId("fit-scale-slider").boundingBox())!;
  const field = (await page.getByTestId("fit-scale-input").boundingBox())!;
  expect(field.x + field.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
  expect(slider.width).toBeGreaterThan(40);
  await expect(page.getByTestId("fit-placement-hint")).toContainText(/(Ctrl|⌘) \+/);
  await page.getByTestId("fit-placement-controls").screenshot({
    path: testInfo.outputPath("placement-controls-narrow.png"),
  });
});

test("the grid is only drawn in the editor and never reaches the preview or export", async ({
  page,
}) => {
  await openSquareFit(page, "solid");
  const before = await readPreview(page);
  const start = (await fitRequests(page)).length;
  await expect(page.getByTestId("fit-grid-overlay")).toHaveCount(0);
  await page.getByTestId("fit-grid-toggle").click();
  await expect(page.getByTestId("fit-grid-toggle")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("fit-grid-overlay")).toBeVisible();
  // Thirds and centre lines.
  await expect(page.getByTestId("fit-grid-overlay").locator("div")).toHaveCount(6);
  await page.waitForTimeout(600);
  expect((await fitRequests(page)).slice(start)).toHaveLength(0);
  expect(await readPreview(page)).toEqual(before);
  // Snapping still works with the grid on.
  const frame = (await page.getByTestId("fit-placement-frame").boundingBox())!;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 3, cy + 2, { steps: 3 });
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const placed = await readPreview(page);
  await page.getByTestId("fit-grid-toggle").click();
  await expect(page.getByTestId("fit-grid-overlay")).toHaveCount(0);
  await page.getByTestId("fit-grid-toggle").click();
  await page.getByTestId("crop-save-btn").click();
  // Saved with the grid on: the export has no lines either.
  const exported = await convert(page);
  expect(await pixelDifference(placed, exported)).toBeLessThan(1);
});

test("Ctrl + wheel zooms at the cursor; Ctrl + plus, minus and 0 zoom from the keyboard", async ({
  page,
}) => {
  await openSquareFit(page, "transparent");
  // Record whether wheel events reached the page with their default prevented.
  await page.evaluate(() => {
    const seen: boolean[] = [];
    (window as unknown as { __wheel: boolean[] }).__wheel = seen;
    window.addEventListener("wheel", (e) => seen.push(e.defaultPrevented), { passive: true });
  });
  const wheelPrevented = () =>
    page.evaluate(() => (window as unknown as { __wheel: boolean[] }).__wheel.splice(0));
  const stage = (await page.getByTestId("fit-placement-stage").boundingBox())!;
  const pixel = stage.width / 800;
  const start = await frameRect(page);
  expect(start).toEqual([0, 133, 800, 533]);
  const requestsBefore = (await fitRequests(page)).length;

  // Zoom in around output point (200, 300).
  const anchor = { x: 200, y: 300 };
  await page.mouse.move(stage.x + anchor.x * pixel, stage.y + anchor.y * pixel);
  await page.keyboard.down("Control");
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  expect((await wheelPrevented()).every(Boolean)).toBe(true);
  await expect.poll(async () => (await frameRect(page))[2]).toBeGreaterThan(1000);
  const zoomed = await frameRect(page);
  // The point under the cursor stays on the same spot of the image.
  const share = (rect: number[]) => [
    (anchor.x - rect[0]) / rect[2],
    (anchor.y - rect[1]) / rect[3],
  ];
  expect(share(zoomed)[0]).toBeCloseTo(share(start)[0], 2);
  expect(share(zoomed)[1]).toBeCloseTo(share(start)[1], 2);
  const zoomedScale = Number(await page.getByTestId("fit-scale-input").inputValue());
  expect(zoomedScale).toBeGreaterThan(150);
  // Many wheel ticks, one settled preview (debounced, older ones aborted).
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await readPreview(page);
  await page.waitForTimeout(600);
  const sent = (await fitRequests(page)).slice(requestsBefore);
  expect(sent.filter((request) => !request.aborted)).toHaveLength(1);
  expect(Number(sent.at(-1)!.fields.fit_scale)).toBeCloseTo(zoomedScale / 100, 2);

  // A plain wheel does not zoom.
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(100);
  expect(await frameRect(page)).toEqual(zoomed);

  // Keyboard: 0 fits, plus and minus step by 10 % around the image centre.
  await page.getByTestId("fit-placement-stage").focus();
  await page.keyboard.press("Control+0");
  await expect.poll(() => frameRect(page)).toEqual(start);
  await page.keyboard.press("Control+Equal");
  await expect(page.getByTestId("fit-scale-input")).toHaveValue("110");
  await page.keyboard.press("Control+Minus");
  await expect(page.getByTestId("fit-scale-input")).toHaveValue("100");
  expect(await frameRect(page)).toEqual(start);

  // Clicking the image focuses the stage, so the keys work right after a drag.
  const frame = (await page.getByTestId("fit-placement-frame").boundingBox())!;
  await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await expect(page.getByTestId("fit-placement-stage")).toBeFocused();

  // Ctrl + wheel outside the stage does not move the image.
  const fitted = await frameRect(page);
  const panel = (await page.getByTestId("fit-placement-controls").boundingBox())!;
  await page.mouse.move(panel.x + 10, panel.y + 10);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  await page.waitForTimeout(100);
  expect(await frameRect(page)).toEqual(fitted);
});

test("pattern and darkening: same pixels in the preview and the export", async ({ page }) => {
  await openSquareFit(page, "solid");
  const start = (await fitRequests(page)).length;
  await showTab(page, "background");
  await page.getByTestId("fit-pattern-dots").click();
  await expect(page.getByTestId("fit-pattern-dots")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("fit-pattern-layer")).toHaveAttribute("data-pattern", "dots");
  await page.getByTestId("fit-dim-slider").fill("0.3");
  await expect(page.getByTestId("fit-dim-value")).toHaveText("30%");
  await expect(page.getByTestId("fit-dim-layer")).toBeVisible();
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await expect
    .poll(async () => (await fitRequests(page)).at(-1)?.fields.fit_dim)
    .toBe("0.3");
  const last = (await fitRequests(page)).at(-1)!;
  expect(last.fields.fit_pattern).toBe("dots");
  expect(last.fields).not.toHaveProperty("fit_background");
  const preview = await readPreview(page);
  // 800 px wide: one cell is 20 px, dots sit at the cell centres. White with
  // 16 % black ink is 214, darkened by 30 % that is 150; plain white is 178.
  const [dot] = await regionMean(preview, 9, 9, 2, 2);
  const [gap] = await regionMean(preview, 0, 0, 2, 2);
  expect(Math.abs(dot - 150)).toBeLessThanOrEqual(2);
  expect(Math.abs(gap - 178)).toBeLessThanOrEqual(2);
  // Settling took a handful of requests at most, none still running.
  await page.waitForTimeout(800);
  expect((await fitRequests(page)).slice(start).length).toBeLessThanOrEqual(4);

  await page.getByTestId("crop-save-btn").click();
  // Reopening keeps the pattern and the darkening.
  await page.getByTestId("dropzone-crop-file-btn").click();
  await expect(page.getByTestId("fit-pattern-dots")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("fit-dim-value")).toHaveText("30%");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  expect(await readPreview(page)).toEqual(preview);
  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
});

test("background image: covers the canvas, can be darkened and exports like the preview", async ({
  page,
}) => {
  await openSquareFit(page, "image");
  await expect(page.getByTestId("fit-background-name")).toHaveText("backdrop.png");
  await expect(page.getByTestId("fit-background-image")).toBeVisible();
  let preview = await readPreview(page);
  // 300 x 100 covering 800 x 800 shows its middle: red on the left, blue on the right.
  const left = await regionMean(preview, 0, 0, 300, 100);
  const right = await regionMean(preview, 500, 0, 300, 100);
  expect(left.slice(0, 3).map(Math.round)).toEqual([220, 30, 30]);
  expect(right.slice(0, 3).map(Math.round)).toEqual([30, 30, 220]);
  const sent = (await fitRequests(page)).at(-1)!;
  expect(sent.fields.fit_mode).toBe("image");
  // Uploaded once to this editor session; previews only name it.
  expect(sent.fields.fit_background_asset).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  expect(sent.fields.fit_session).toMatch(/^[A-Za-z0-9_-]{24,}$/);
  expect(sent.fields).not.toHaveProperty("fit_background");

  await page.getByTestId("fit-dim-slider").fill("0.5");
  await expect
    .poll(async () => Math.round((await regionMean(await readPreview(page), 0, 0, 300, 100))[0]))
    .toBe(110);
  preview = await readPreview(page);

  // A file that is not a picture is refused in the browser and keeps the old one.
  await page.getByTestId("fit-background-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByTestId("fit-background-error")).toBeVisible();
  await expect(page.getByTestId("fit-background-name")).toHaveText("backdrop.png");

  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  const metadata = await sharp(exported).metadata();
  expect([metadata.width, metadata.height]).toEqual([800, 800]);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
});

/** Standard deviation of the grey values in a region: lower means softer. */
async function regionStdev(image: Buffer, left: number, top: number, width: number, height: number) {
  const region = await sharp(image).extract({ left, top, width, height }).greyscale().png().toBuffer();
  return (await sharp(region).stats()).channels[0].stdev;
}

test("blur strength: default sends nothing, stronger blur is softer, export matches", async ({ page }) => {
  await openSquareFit(page, "blur");
  await showTab(page, "background");
  await expect(page.getByTestId("fit-blur-value")).toHaveText("25%");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  // Untouched, nothing new goes to the server, so old output stays identical.
  expect((await fitRequests(page)).at(-1)!.fields).not.toHaveProperty("fit_blur");
  // Make room above and below the image so the background shows.
  await showTab(page, "fit");
  await page.getByTestId("fit-scale-input").fill("50");
  await page.getByTestId("fit-scale-input").press("Enter");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await showTab(page, "background");

  await page.getByTestId("fit-blur-slider").fill("0");
  await expect(page.getByTestId("fit-blur-value")).toHaveText("0%");
  await expect.poll(async () => (await fitRequests(page)).at(-1)?.fields.fit_blur).toBe("0");
  const sharpPreview = await readPreview(page);
  await page.getByTestId("fit-blur-slider").fill("1");
  await expect.poll(async () => (await fitRequests(page)).at(-1)?.fields.fit_blur).toBe("1");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const softPreview = await readPreview(page);
  const sharpness = await regionStdev(sharpPreview, 0, 0, 800, 150);
  const softness = await regionStdev(softPreview, 0, 0, 800, 150);
  expect(softness).toBeLessThan(sharpness * 0.8);

  await page.getByTestId("crop-save-btn").click();
  await page.getByTestId("dropzone-crop-file-btn").click();
  await showTab(page, "background");
  await expect(page.getByTestId("fit-blur-value")).toHaveText("100%");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  expect(await pixelDifference(softPreview, exported)).toBeLessThan(1);
});

test("tint and blur on a background image: colour mixed in, image untouched, export matches", async ({
  page,
}) => {
  await openSquareFit(page, "image");
  await expect(page.getByTestId("fit-blur-value")).toHaveText("0%");
  await expect(page.getByTestId("fit-tint-value")).toHaveText("0%");
  await showTab(page, "fit");
  await page.getByTestId("fit-scale-input").fill("40");
  await page.getByTestId("fit-scale-input").press("Enter");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  await showTab(page, "background");

  // A swatch turns the tint on at 30 %; then set it to 50 %.
  await page.getByTestId("fit-tint-swatch-ffffff").click();
  await expect(page.getByTestId("fit-tint-value")).toHaveText("30%");
  await page.getByTestId("fit-tint-slider").fill("0.5");
  await expect(page.getByTestId("fit-tint-layer")).toBeVisible();
  await expect.poll(async () => (await fitRequests(page)).at(-1)?.fields.fit_tint).toBe("0.5");
  expect((await fitRequests(page)).at(-1)!.fields.fit_tint_color).toBe("#ffffff");
  // Red 220/30/30 halfway to white is about 238/143/143.
  const tinted = [238, 143, 143];
  await expect
    .poll(async () => {
      const mean = await regionMean(await readPreview(page), 20, 20, 100, 100);
      return Math.max(...tinted.map((value, index) => Math.abs(mean[index] - value)));
    })
    .toBeLessThanOrEqual(2);

  await page.getByTestId("fit-blur-slider").fill("0.5");
  await expect.poll(async () => (await fitRequests(page)).at(-1)?.fields.fit_blur).toBe("0.5");
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
  const preview = await readPreview(page);
  // Far from the red/blue edge the blur changes nothing; the edge goes soft.
  const corner = (await regionMean(preview, 20, 20, 60, 60)).slice(0, 3).map(Math.round);
  expect(corner.map((value, index) => Math.abs(value - tinted[index]) <= 3)).toEqual([true, true, true]);
  const edge = await regionMean(preview, 395, 20, 10, 60);
  expect(edge[0]).toBeLessThan(230);
  expect(edge[0]).toBeGreaterThan(160);

  await page.getByTestId("crop-save-btn").click();
  const exported = await convert(page);
  expect(await pixelDifference(preview, exported)).toBeLessThan(1);
});

test("moving snaps to the canvas centre with subtle guides; Alt places freely", async ({
  page,
}) => {
  await openSquareFit(page, "blur");
  const start = await frameRect(page);
  const frame = (await page.getByTestId("fit-placement-frame").boundingBox())!;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(0);
  // Back to within a few pixels of the centre: it snaps and shows guides.
  await page.mouse.move(cx + 3, cy - 2, { steps: 5 });
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(1);
  await expect(page.getByTestId("fit-snap-guide-y")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(0);
  expect(await frameRect(page)).toEqual(start);

  await page.mouse.move(cx, cy);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(cx + 3, cy, { steps: 3 });
  await expect(page.getByTestId("fit-snap-guide-x")).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up("Alt");
  expect((await frameRect(page))[0]).toBeGreaterThan(start[0]);
  await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
});

for (const mode of ["blur", "solid", "transparent"] as const) {
  test(`${mode}: a placed image is exported exactly like its preview`, async ({
    page,
  }, testInfo) => {
    await openSquareFit(page, mode);
    const centred = await readPreview(page);
    await page.getByTestId("fit-scale-input").fill("60");
    // 60% is 480x320, centred at 160,240; move it to 300,-40 with the keys.
    await expect.poll(() => frameRect(page)).toEqual([160, 240, 480, 320]);
    await page.getByTestId("fit-placement-stage").focus();
    await press(page, "Shift+ArrowRight", 14);
    await press(page, "Shift+ArrowUp", 28);
    await expect.poll(async () => (await frameRect(page)).slice(0, 2)).toEqual([300, -40]);
    await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
    const preview = await readPreview(page);
    expect(await pixelDifference(centred, preview)).toBeGreaterThan(5);
    if (mode === "transparent") {
      expect((await regionMean(preview, 0, 0, 280, 800))[3]).toBe(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`placement-${mode}.png`) });
    await page.getByTestId("crop-save-btn").click();

    // Reopening keeps the placement.
    await page.getByTestId("dropzone-crop-file-btn").click();
    await expect(page.getByTestId("fit-scale-input")).toHaveValue("60");
    await expect(page.getByTestId("crop-save-btn")).toBeEnabled();
    expect(await readPreview(page)).toEqual(preview);
    await page.getByTestId("crop-save-btn").click();

    const exported = await convert(page);
    const metadata = await sharp(exported).metadata();
    expect([metadata.width, metadata.height]).toEqual([800, 800]);
    expect(await pixelDifference(preview, exported)).toBeLessThan(1);
  });
}

test("crop tab: arrow keys nudge the selection and Center centres it", async ({
  page,
}) => {
  await page.getByTestId("dropzone-input").setInputFiles(original);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-precise-selection-toggle").click();
  await page.getByTestId("crop-width-input").fill("600");
  await page.getByTestId("crop-height-input").fill("400");
  const selection = page.getByTestId("crop-selection");
  const left = () => selection.evaluate((el) => parseFloat((el as HTMLElement).style.left));
  const top = () => selection.evaluate((el) => parseFloat((el as HTMLElement).style.top));
  await page.getByTestId("crop-selection-center-btn").click();
  const natural = await page
    .locator('[data-testid="crop-widget"] img')
    .first()
    .evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  expect(await left()).toBeCloseTo((Math.round((natural.w - 600) / 2) / natural.w) * 100, 3);
  expect(await top()).toBeCloseTo((Math.round((natural.h - 400) / 2) / natural.h) * 100, 3);
  const centredLeft = await left();
  await selection.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect(await left()).toBeCloseTo(centredLeft - (11 / natural.w) * 100, 3);
  await expect(page.getByTestId("crop-dims-label")).toContainText("600 × 400");
});
