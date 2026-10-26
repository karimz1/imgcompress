import fs from "fs";
import path from "path";
import sharp from "sharp";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { downloadFilesAsync } from "./utls/downloadHelper";
import {
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  getStorageManagerFileCountAsync,
  setOutputFormatAsync,
  uploadBuffersToDropzoneAsync,
} from "./utls/helpers";

/**
 * E2E: the container runs with a small MAX_UPLOAD_SIZE_MB (CI feature-flags matrix,
 * entry "upload limit 5 MB"). Checks the drawer text, an upload below the limit and
 * that a picture above it is refused by the UI and by the server.
 * With the default limit (40 GB) the spec skips itself, like the other flag specs
 * that read /config/runtime.json.
 */

const fixtures = path.resolve(__dirname, "fixtures/sample-images");
const underLimit = path.join(fixtures, "pexels-willianjusten-29944187.jpg"); // 1.18 MB
const overLimit = path.join(fixtures, "37443511_8499861.psd"); // 37.26 MB
const MB = 1024 * 1024;

let limitMb = 0;

async function readLimitMb(request: APIRequestContext): Promise<number> {
  const response = await request.get("/config/runtime.json");
  expect(response.ok()).toBeTruthy();
  return Number((await response.json()).MAX_UPLOAD_SIZE_MB);
}

test.beforeAll(async ({ request }) => {
  limitMb = await readLimitMb(request);
});

test.beforeEach(async ({ page, request }) => {
  const underSize = fs.statSync(underLimit).size;
  const overSize = fs.statSync(overLimit).size;
  test.skip(
    !(limitMb * MB > underSize * 2 && limitMb * MB < overSize / 2),
    `MAX_UPLOAD_SIZE_MB=${limitMb}: runs only in the small upload limit CI entry`,
  );
  test.info().annotations.push({ type: "runtime-config", description: `MAX_UPLOAD_SIZE_MB=${limitMb}` });
  await clearStorageManagerAsync(request);
  await page.goto("/");
  // The page reads the limit from /config/runtime.json after it loads. Wait
  // until the drawer shows it, so the files below are checked against it.
  await expect(page.getByTestId("dropzone-max-size")).toHaveText(`Max. ${limitMb} MB per file`);
  await setOutputFormatAsync(page, "PNG");
});

test("the drawer names the limit and a picture below it converts", async ({ page }) => {
  await expect(page.getByTestId("dropzone-max-size")).toHaveText(`Max. ${limitMb} MB per file`);

  await page.getByTestId("dropzone-input").setInputFiles(underLimit);
  await expect(page.getByTestId("dropzone-added-file")).toHaveCount(1);
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId("drawer-uploaded-file-item-link")).toHaveCount(1);
  const [exported] = await downloadFilesAsync(page, page.getByTestId("drawer-uploaded-file-item-link"));
  const source = await sharp(underLimit).metadata();
  const result = await sharp(exported).metadata();
  expect([result.format, result.width, result.height]).toEqual(["png", source.width, source.height]);
});

test("a picture above the limit is refused in the UI and never sent", async ({ page }) => {
  let compressRequests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/compress")) compressRequests += 1;
  });

  await page.getByTestId("dropzone-input").setInputFiles([overLimit, underLimit]);
  await expect(page.getByText(`37443511_8499861.psd is larger than ${limitMb} MB and was not added.`).first()).toBeVisible();
  // Only the small picture is in the list.
  await expect(page.getByTestId("dropzone-added-file")).toHaveCount(1);
  await expect(page.getByTestId("dropzone-added-file")).toContainText("pexels-willianjusten");
  expect(compressRequests).toBe(0);
});

test("pictures below the limit that are too big together are not sent in one request", async ({ page }) => {
  let compressRequests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/compress")) compressRequests += 1;
  });
  // Two BMPs, each a bit more than half of the limit.
  const side = Math.ceil(Math.sqrt((limitMb * MB * 0.6) / 3));
  const bmp = await sharp({ create: { width: side, height: side, channels: 3, background: "#3366cc" } })
    .raw()
    .toBuffer();
  const header = Buffer.alloc(54);
  const rowBytes = Math.ceil((side * 3) / 4) * 4;
  header.write("BM", 0);
  header.writeUInt32LE(54 + rowBytes * side, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(side, 18);
  header.writeInt32LE(side, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  const pixels = Buffer.alloc(rowBytes * side);
  for (let y = 0; y < side; y += 1) bmp.copy(pixels, y * rowBytes, y * side * 3, (y + 1) * side * 3);
  const file = Buffer.concat([header, pixels]);
  expect(file.length).toBeLessThan(limitMb * MB);
  expect(file.length * 2).toBeGreaterThan(limitMb * MB);

  await uploadBuffersToDropzoneAsync(page, [
    { name: "half-a.bmp", mimeType: "image/bmp", buffer: file },
    { name: "half-b.bmp", mimeType: "image/bmp", buffer: file },
  ]);
  await expect(page.getByTestId("dropzone-added-file")).toHaveCount(2);
  await clickConversionButtonAsync(page);
  await expect(page.getByText(`Together the files are larger than ${limitMb} MB.`, { exact: false }).first()).toBeVisible();
  expect(compressRequests).toBe(0);
});

test("the server refuses an upload above the limit by itself and stores nothing", async ({ request }) => {
  const psd = fs.readFileSync(overLimit);
  const before = await getStorageManagerFileCountAsync(request);

  const compress = await request.post("/api/compress", {
    multipart: { "files[]": { name: "big.psd", mimeType: "image/vnd.adobe.photoshop", buffer: psd }, format: "png" },
  });
  expect(compress.status()).toBe(413);
  const body = await compress.json();
  expect(body.max_upload_size_mb).toBe(limitMb);
  expect(body.message).toContain(`${limitMb} MB`);

  const asset = await request.post("/api/editor/assets", {
    multipart: { file: { name: "big.psd", mimeType: "image/vnd.adobe.photoshop", buffer: psd } },
  });
  expect(asset.status()).toBe(413);

  expect(await getStorageManagerFileCountAsync(request)).toBe(before);

  // A picture below the limit is still taken by the editor.
  const small = await request.post("/api/editor/assets", {
    multipart: { file: { name: "small.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(underLimit) } },
  });
  expect(small.status()).toBe(200);
  expect((await small.json()).session).toBeTruthy();
});

test("the editor refuses a picture above the limit and names it", async ({ page }) => {
  await page.getByTestId("dropzone-input").setInputFiles(underLimit);
  await page.getByTestId("dropzone-crop-file-btn").click();
  await page.getByTestId("crop-tab-layers").click();
  await page.getByTestId("fit-picture-input").setInputFiles(overLimit);
  await expect(page.getByTestId("fit-layers-error")).toHaveText(new RegExp(`\\b${limitMb}\\s?MB\\b`));
  await expect(page.getByTestId("fit-picture-controls")).toHaveCount(0);
});
