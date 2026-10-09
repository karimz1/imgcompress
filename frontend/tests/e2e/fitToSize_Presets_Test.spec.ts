import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  AssertImageHasTransparentPixels,
  assertDownloadLinksAsync,
  assertFilesPresentInDropzoneAsync,
  assertZipButtonNotRenderedAsync,
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  setFitToSizeAsync,
  setMaxSizeInMBAsync,
  setOutputFormatAsync,
  switchCompressionModeAsync,
  uploadFilesToDropzoneAsync,
  uploadGeneratedImageToDropzoneAsync,
  type FitToSizeOptions,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

const PORTRAIT_PHOTO = new ImageFileDto('pexels-pealdesign-28594392.jpg');
const SKYLINE_PHOTO = new ImageFileDto('pexels-willianjusten-29944187.jpg');
const TRANSPARENT_PNG = new ImageFileDto('ico-datei.png');

// A 3:2 card like a typical hero image: flat background with one detailed band
// (a checkerboard standing in for a title line) low in the frame.
const BAND_CARD = new ImageFileDto('fit-band-card.png');
const BAND_CARD_SIZE = { width: 1500, height: 1000 };
const BAND_ROWS = { top: 820, bottom: 960 };

test.describe('Fit to exact size', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('GitHub preset with automatic crop keeps the detailed band whole', async ({ page }) => {
    const outputPath = await convertBandCardAsync(page, { preset: 'github-social', anchor: 'auto' });

    const { width, height, rows } = await rowContrastAsync(outputPath);
    expect({ width, height }).toEqual({ width: 1280, height: 640 });

    // Scaled to 1280 wide the band is ~119 rows tall. A centred crop would cut
    // it in half; the automatic crop has to keep all of it.
    const bandHeight = Math.round(((BAND_ROWS.bottom - BAND_ROWS.top) * 1280) / BAND_CARD_SIZE.width);
    const detailedRows = rows.filter((contrast) => contrast > 40).length;
    expect(detailedRows).toBeGreaterThanOrEqual(bandHeight - 4);
  });

  test('a manual anchor overrides the automatic crop', async ({ page }) => {
    const outputPath = await convertBandCardAsync(page, { preset: 'github-social', anchor: 'top' });

    const { width, height, rows } = await rowContrastAsync(outputPath);
    expect({ width, height }).toEqual({ width: 1280, height: 640 });
    // Keeping the top of the card leaves the band (in the lower part) out.
    expect(rows.filter((contrast) => contrast > 40).length).toBe(0);
  });

  test('blurred background keeps the whole photo and fills the sides', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await uploadAndAssertAsync(page, PORTRAIT_PHOTO);
    await setFitToSizeAsync(page, { preset: 'open-graph', mode: 'blur' });

    const outputPath = await convertAndDownloadSingleAsync(page, PORTRAIT_PHOTO, '.jpg');

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);

    // The 2:3 photo scaled to 630 high is 420 wide and sits in the middle
    // (x 390..810). The sides are a blurred copy: far smoother than the photo.
    const sideDetail = await horizontalDetailAsync(outputPath, 20, 360);
    const photoDetail = await horizontalDetailAsync(outputPath, 420, 780);
    expect(sideDetail).toBeLessThan(photoDetail * 0.5);
  });

  test('custom size works together with max file size', async ({ page }) => {
    const maxSizeInMB = 0.1;
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await uploadAndAssertAsync(page, SKYLINE_PHOTO);
    await setFitToSizeAsync(page, { preset: 'custom', width: 1000, height: 1000, anchor: 'center' });
    await switchCompressionModeAsync(page, 'size');
    await setMaxSizeInMBAsync(page, maxSizeInMB);

    const outputPath = await convertAndDownloadSingleAsync(page, SKYLINE_PHOTO, '.jpg');

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(1000);
    expect(metadata.height).toBe(1000);
    // The backend aims for 98% of the target and accepts up to 2% over it.
    expect(fs.statSync(outputPath).size).toBeLessThanOrEqual(maxSizeInMB * 1024 * 1024 * 1.02);
  });

  test('crop keeps transparency in PNG output', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await uploadAndAssertAsync(page, TRANSPARENT_PNG);
    await setFitToSizeAsync(page, { preset: 'custom', width: 300, height: 500 });

    const outputPath = await convertAndDownloadSingleAsync(page, TRANSPARENT_PNG, '.png');

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(500);
    expect(metadata.hasAlpha).toBeTruthy();
    await AssertImageHasTransparentPixels(outputPath);
  });

  test('is replaced by page presets for PDF and turns off resize width', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await uploadAndAssertAsync(page, SKYLINE_PHOTO);
    await setFitToSizeAsync(page, { preset: 'github-social' });
    const resizeSwitch = page.getByTestId('resize-width-switch');
    await expect(page.getByTestId('fit-size-switch')).toHaveCount(0);
    await expect(resizeSwitch).toBeDisabled();
    await expect(page.getByTestId('resize-width-fit-hint')).toBeVisible();

    await setOutputFormatAsync(page, 'PDF');
    await expect(resizeSwitch).toBeEnabled();
    await page.getByTestId('dropzone-crop-file-btn').first().click();
    await expect(page.getByTestId('crop-fit-controls')).toHaveCount(0);

  });
});

async function uploadAndAssertAsync(page: Page, image: ImageFileDto): Promise<void> {
  await uploadFilesToDropzoneAsync(page, [image]);
  await assertFilesPresentInDropzoneAsync(page, [image]);
}

async function convertBandCardAsync(page: Page, fit: FitToSizeOptions): Promise<string> {
  await page.goto('/');
  await setOutputFormatAsync(page, 'PNG');
  await uploadGeneratedImageToDropzoneAsync(page, BAND_CARD.fileName, 'image/png', await buildBandCardAsync());
  await assertFilesPresentInDropzoneAsync(page, [BAND_CARD]);
  await setFitToSizeAsync(page, fit);
  return convertAndDownloadSingleAsync(page, BAND_CARD, '.png');
}

async function convertAndDownloadSingleAsync(page: Page, image: ImageFileDto, extension: string): Promise<string> {
  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);
  const links = await assertDownloadLinksAsync(page, [image], '_cropped');
  const [downloadedPath] = await downloadFilesAsync(page, links);
  expect(path.extname(downloadedPath).toLowerCase()).toBe(extension);
  return downloadedPath;
}

async function buildBandCardAsync(): Promise<Buffer> {
  const { width, height } = BAND_CARD_SIZE;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const inBand = y >= BAND_ROWS.top && y < BAND_ROWS.bottom;
      if (inBand) {
        const value = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0 ? 20 : 235;
        pixels.fill(value, offset, offset + 3);
      } else {
        pixels[offset] = 200;
        pixels[offset + 1] = 220;
        pixels[offset + 2] = 240;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Standard deviation of the grey value along each row. */
async function rowContrastAsync(filePath: string): Promise<{ width: number; height: number; rows: number[] }> {
  const { data, info } = await sharp(filePath).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rows: number[] = [];
  for (let y = 0; y < info.height; y++) {
    let sum = 0;
    let sumSq = 0;
    for (let x = 0; x < info.width; x++) {
      const value = data[y * info.width * info.channels + x * info.channels];
      sum += value;
      sumSq += value * value;
    }
    const mean = sum / info.width;
    rows.push(Math.sqrt(Math.max(sumSq / info.width - mean * mean, 0)));
  }
  return { width: info.width, height: info.height, rows };
}

/** Mean absolute difference between horizontal neighbours in the column range [from, to). */
async function horizontalDetailAsync(filePath: string, from: number, to: number): Promise<number> {
  const { data, info } = await sharp(filePath).greyscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  let count = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = from + 1; x < to; x++) {
      const index = (y * info.width + x) * info.channels;
      total += Math.abs(data[index] - data[index - info.channels]);
      count++;
    }
  }
  return total / count;
}
