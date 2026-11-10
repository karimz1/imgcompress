import fs from 'fs';
import path from 'path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  AssertImageHasTransparentPixels,
  assertDownloadLinksAsync,
  assertFilesPresentInDropzoneAsync,
  assertZipButtonNotRenderedAsync,
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  GetFullFilePathOfImageFileAsync,
  setMaxSizeInMBAsync,
  setOutputFormatAsync,
  setRembgEnabledAsync,
  setResizeWidthAsync,
  setWebpLosslessEnabledAsync,
  switchCompressionModeAsync,
  uploadBuffersToDropzoneAsync,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

const PHOTO = new ImageFileDto('pexels-willianjusten-29944187.jpg');
const TRANSPARENT_PNG = new ImageFileDto('ico-datei.png');
const IPHONE_HEIC = new ImageFileDto('IMG_0935.heic');

test.describe('WebP export', () => {
  test.beforeEach(async ({ request }) => {
    await startFromEmptyStorageAsync(request);
  });

  test('converts a photo to lossy WebP at the requested width', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await expect(page.getByText('WebP settings mode')).toBeVisible();
    await uploadAndAssertAsync(page, PHOTO);
    await setResizeWidthAsync(page, 800);

    const webpPath = await convertAndDownloadSingleAsync(page, PHOTO);

    assertHasWebpSignature(webpPath);
    expect(readWebpBitstream(webpPath)).toBe('VP8 ');
    const metadata = await sharp(webpPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(800);
    expect(metadata.hasAlpha).toBeFalsy();
  });

  test('lossless WebP keeps transparency and every visible pixel', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await setWebpLosslessEnabledAsync(page, true);
    // Lossless has no quality knob, so neither quality nor max file size is offered.
    await expect(page.getByTestId('compression-mode-quality-btn')).toBeHidden();
    await expect(page.getByTestId('compression-mode-size-btn')).toBeHidden();
    await uploadAndAssertAsync(page, TRANSPARENT_PNG);

    const webpPath = await convertAndDownloadSingleAsync(page, TRANSPARENT_PNG);

    assertHasWebpSignature(webpPath);
    expect(readWebpBitstream(webpPath)).toBe('VP8L');
    const metadata = await sharp(webpPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.hasAlpha).toBeTruthy();
    await AssertImageHasTransparentPixels(webpPath);
    await assertVisiblePixelsMatchSourceAsync(
      webpPath,
      await GetFullFilePathOfImageFileAsync(TRANSPARENT_PNG)
    );
  });

  test('max file size keeps the WebP under the limit', async ({ page }) => {
    const maxSizeInMB = 0.3;
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await uploadAndAssertAsync(page, PHOTO);
    await switchCompressionModeAsync(page, 'size');
    await setMaxSizeInMBAsync(page, maxSizeInMB);

    const webpPath = await convertAndDownloadSingleAsync(page, PHOTO);

    assertHasWebpSignature(webpPath);
    // The backend aims for 98% of the target and accepts up to 2% over it.
    expect(fs.statSync(webpPath).size).toBeLessThanOrEqual(maxSizeInMB * 1024 * 1024 * 1.02);
  });

  test('removes the background with local AI and keeps it transparent', async ({ page }) => {
    const subject = new ImageFileDto('pexels-pealdesign-28594392.jpg');
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await setRembgEnabledAsync(page, true);
    await uploadAndAssertAsync(page, subject);

    const webpPath = await convertAndDownloadSingleAsync(page, subject, '_ai-bg-removed');

    assertHasWebpSignature(webpPath);
    const metadata = await sharp(webpPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.hasAlpha).toBeTruthy();
    await AssertImageHasTransparentPixels(webpPath);
  });

  test('keeps the Display P3 profile of an iPhone HEIC', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await uploadAndAssertAsync(page, IPHONE_HEIC);
    await setResizeWidthAsync(page, 800);

    const webpPath = await convertAndDownloadSingleAsync(page, IPHONE_HEIC);

    const metadata = await sharp(webpPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(800);
    expect(metadata.icc, 'ICC profile missing in the WebP').toBeDefined();
    // ICC v4 stores the profile description as UTF-16BE.
    expect(metadata.icc!.includes(Buffer.from('Display P3', 'utf16le').swap16())).toBeTruthy();
  });

  test('a rotated phone photo comes out upright at the requested width', async ({ page }) => {
    // Stored as 600 x 300, EXIF orientation 6 shows it as 300 x 600.
    const rotated = await sharp({
      create: { width: 600, height: 300, channels: 3, background: { r: 200, g: 60, b: 40 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const image = new ImageFileDto('rotated-phone-photo.jpg');
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await uploadBuffersToDropzoneAsync(page, [
      { name: image.fileName, mimeType: 'image/jpeg', buffer: rotated },
    ]);
    await assertFilesPresentInDropzoneAsync(page, [image]);
    await setResizeWidthAsync(page, 150);

    const webpPath = await convertAndDownloadSingleAsync(page, image);

    const metadata = await sharp(webpPath).metadata();
    expect(metadata.width).toBe(150);
    expect(metadata.height).toBe(300);
    expect(metadata.orientation).toBeUndefined();
  });

  test('an image wider than 16383 px fails with a readable message', async ({ page }) => {
    const tooWide = await sharp({
      create: { width: 16384, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();
    await page.goto('/');
    await setOutputFormatAsync(page, 'WebP');
    await uploadBuffersToDropzoneAsync(page, [
      { name: 'too-wide.png', mimeType: 'image/png', buffer: tooWide },
    ]);
    await assertFilesPresentInDropzoneAsync(page, [new ImageFileDto('too-wide.png')]);

    await clickConversionButtonAsync(page);

    await expect(page.getByTestId('error-message-holder')).toContainText(
      'WebP supports at most 16383x16383 pixels'
    );
    await expect(page.getByTestId('error-holder')).not.toContainText('Traceback');
  });
});

async function startFromEmptyStorageAsync(request: APIRequestContext): Promise<void> {
  await clearStorageManagerAsync(request);
}

async function uploadAndAssertAsync(page: Page, image: ImageFileDto): Promise<void> {
  await uploadFilesToDropzoneAsync(page, [image]);
  await assertFilesPresentInDropzoneAsync(page, [image]);
}

async function convertAndDownloadSingleAsync(
  page: Page,
  image: ImageFileDto,
  expectedSuffix = ''
): Promise<string> {
  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);
  const links = await assertDownloadLinksAsync(page, [image], expectedSuffix);
  const [downloadedPath] = await downloadFilesAsync(page, links);
  expect(path.extname(downloadedPath).toLowerCase()).toBe('.webp');
  return downloadedPath;
}

/** RIFF container with the WEBP form type, as defined by the WebP container spec. */
function assertHasWebpSignature(filePath: string): void {
  const header = fs.readFileSync(filePath).subarray(0, 12);
  expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(header.subarray(8, 12).toString('ascii')).toBe('WEBP');
}

/**
 * Returns the FourCC of the image bitstream chunk: 'VP8 ' for lossy, 'VP8L' for
 * lossless. Files with alpha or metadata use the extended 'VP8X' layout, where the
 * bitstream chunk follows the header chunks, so walk the chunk list to find it.
 */
function readWebpBitstream(filePath: string): string {
  const data = fs.readFileSync(filePath);
  let offset = 12;
  while (offset + 8 <= data.length) {
    const fourCC = data.subarray(offset, offset + 4).toString('ascii');
    if (fourCC === 'VP8 ' || fourCC === 'VP8L') {
      return fourCC;
    }
    const chunkSize = data.readUInt32LE(offset + 4);
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error(`No VP8/VP8L bitstream chunk in ${filePath}`);
}

async function assertVisiblePixelsMatchSourceAsync(webpPath: string, sourcePath: string): Promise<void> {
  const [output, source] = await Promise.all([
    sharp(webpPath).ensureAlpha().raw().toBuffer(),
    sharp(sourcePath).ensureAlpha().raw().toBuffer(),
  ]);
  expect(output.length).toBe(source.length);

  // libwebp is free to rewrite the colour of fully transparent pixels, so only
  // pixels with some opacity have to survive unchanged.
  let mismatches = 0;
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] === 0) continue;
    if (
      output[i] !== source[i] ||
      output[i + 1] !== source[i + 1] ||
      output[i + 2] !== source[i + 2] ||
      output[i + 3] !== source[i + 3]
    ) {
      mismatches++;
    }
  }
  expect(mismatches, 'visible pixels changed by lossless WebP').toBe(0);
}
