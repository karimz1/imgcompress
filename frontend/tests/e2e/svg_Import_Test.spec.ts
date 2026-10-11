import fs from 'fs/promises';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import decodeIco from 'decode-ico';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import {
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setResizeWidthAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';

const SVG_FILE_NAME = 'svg-import.svg';
const SVG_FIXTURE = path.resolve(__dirname, 'fixtures/sample-images', SVG_FILE_NAME);

async function uploadSvgAsync(page: Page, outputFormat: string): Promise<void> {
  await page.goto('/');
  await waitForSupportedFormatsCountAsync(page);
  await setOutputFormatAsync(page, outputFormat);
  await page.getByTestId('dropzone-input').setInputFiles(SVG_FIXTURE);
  await expect(page.getByTestId('dropzone-added-file')).toHaveText(SVG_FILE_NAME);
}

async function downloadOutputAsync(page: Page, filename: string): Promise<Buffer> {
  const links = page.getByTestId('drawer-uploaded-file-item-link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText(filename);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    links.click(),
  ]);
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('The converted SVG download has no file path.');
  return fs.readFile(downloadPath);
}

for (const { format, extension } of [
  { format: 'PNG', extension: 'png' },
  { format: 'JPEG', extension: 'jpg' },
  { format: 'AVIF', extension: 'avif' },
  { format: 'ICO', extension: 'ico' },
  { format: 'PDF', extension: 'pdf' },
]) {
  test(`imports an SVG and downloads a resized ${format}`, async ({ page }) => {
    await uploadSvgAsync(page, format);
    await setResizeWidthAsync(page, 60);
    await clickConversionButtonAsync(page);
    const output = await downloadOutputAsync(page, `svg-import.${extension}`);

    if (format === 'PDF') {
      const document = await PDFDocument.load(output);
      expect(document.getPageCount()).toBe(1);
      expect(document.getPage(0).getWidth()).toBeGreaterThan(0);
      expect(document.getPage(0).getHeight()).toBeGreaterThan(0);
      return;
    }
    if (format === 'ICO') {
      const icons = decodeIco(output);
      expect(icons.length).toBeGreaterThan(0);
      const largest = icons.reduce((previous, icon) =>
        icon.width > previous.width ? icon : previous
      );
      expect(largest.width).toBe(32);
      expect(largest.height).toBe(21);
      return;
    }

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(60);
    expect(metadata.height).toBe(40);
    if (format === 'AVIF') {
      expect(['avif', 'heif']).toContain(metadata.format);
    } else {
      expect(metadata.format).toBe(format.toLowerCase());
    }

    if (format === 'PNG') {
      expect(metadata.hasAlpha).toBe(true);
      const { data, info } = await sharp(output)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3]).toBe(0);
      const centerOffset = (20 * info.width + 30) * info.channels;
      expect(data[centerOffset + 3]).toBe(255);
    } else if (format === 'JPEG') {
      const pixel = await sharp(output)
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .raw()
        .toBuffer();
      expect(Array.from(pixel).every(channel => channel > 240)).toBe(true);
    }
  });
}

test('crops an imported SVG and downloads the selected dimensions as PNG', async ({ page }) => {
  await uploadSvgAsync(page, 'PNG');
  const cropButton = page.getByTestId('dropzone-crop-file-btn');
  await expect(cropButton).toBeEnabled();
  const bitmapResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().includes('/api/crop/bitmap')
  );
  await cropButton.click();
  const response = await bitmapResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await page.getByTestId('crop-width-input').fill('60');
  await page.getByTestId('crop-height-input').fill('40');
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-badge')).toContainText('cropped');

  await clickConversionButtonAsync(page);
  const output = await downloadOutputAsync(page, 'svg-import_cropped.png');
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe('png');
  expect(metadata.width).toBe(60);
  expect(metadata.height).toBe(40);
});
