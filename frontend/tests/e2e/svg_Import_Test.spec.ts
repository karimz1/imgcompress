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
const DETAIL_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="4.2" width="0.1" height="10" fill="red"/></svg>');

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
  { format: 'WebP', extension: 'webp' },
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
  await page.getByTestId('crop-precise-selection-toggle').click();
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

async function uploadDetailSvgAsync(page: Page): Promise<void> {
  await page.goto('/');
  await waitForSupportedFormatsCountAsync(page);
  await setOutputFormatAsync(page, 'PNG');
  await page.getByTestId('dropzone-input').setInputFiles({
    name: 'detail.svg', mimeType: 'image/svg+xml', buffer: DETAIL_SVG,
  });
}

async function expectSharpDetail(output: Buffer): Promise<void> {
  const metadata = await sharp(output).metadata();
  expect([metadata.width, metadata.height]).toEqual([100, 100]);
  const pixel = await sharp(output).ensureAlpha()
    .extract({ left: 42, top: 50, width: 1, height: 1 }).raw().toBuffer();
  expect(Array.from(pixel)).toEqual([255, 0, 0, 255]);
}

test('renders thin SVG detail directly at the requested width', async ({ page }) => {
  await uploadDetailSvgAsync(page);
  await setResizeWidthAsync(page, 100);
  await clickConversionButtonAsync(page);
  await expectSharpDetail(await downloadOutputAsync(page, 'detail.png'));
});

test('keeps SVG vectors after cropping and resizing', async ({ page }) => {
  await uploadDetailSvgAsync(page);
  await page.getByTestId('dropzone-crop-file-btn').click();
  await expect(page.getByTestId('crop-width-input')).toHaveValue('10');
  await expect(page.getByTestId('crop-height-input')).toHaveValue('10');
  await page.getByTestId('crop-save-btn').click();
  await setResizeWidthAsync(page, 100);
  await clickConversionButtonAsync(page);
  await expectSharpDetail(await downloadOutputAsync(page, 'detail_cropped.png'));
});

test('scales an SVG without requiring an installed AI model', async ({ page }) => {
  await page.route('**/api/upscale_model', route => route.fulfill({
    json: { models: [
      { id: 'general', model_name: 'realesr-general-x4v3', available: false },
      { id: 'anime', model_name: 'realesr-animevideov3', available: false },
    ] },
  }));
  await uploadDetailSvgAsync(page);
  await expect(page.getByTestId('upscale-switch')).toHaveAccessibleName('Enlarge');
  await expect(page.getByTestId('upscale-switch')).toBeEnabled();
  await page.getByTestId('upscale-switch').click();
  await expect(page.getByTestId('upscale-model-select')).toHaveCount(0);
  await page.getByTestId('upscale-target-select').click();
  await page.getByTestId('upscale-target-option-8x').click();
  await clickConversionButtonAsync(page);
  const output = await downloadOutputAsync(page, 'detail.png');
  const metadata = await sharp(output).metadata();
  expect([metadata.width, metadata.height]).toEqual([80, 80]);
});

for (const mode of ['crop', 'blur']) {
  test(`keeps SVG detail sharp in the ${mode} fit preview and export`, async ({ page }) => {
    await uploadDetailSvgAsync(page);
    await page.getByTestId('dropzone-crop-file-btn').click();
    await expect(page.getByTestId('crop-width-input')).toHaveValue('10');
    await page.getByTestId('crop-tab-fit').click();
    await page.getByTestId(`fit-mode-${mode}-btn`).click();
    await expect(page.getByTestId('crop-save-btn')).toBeEnabled();
    const previewSource = await page.getByTestId('crop-fit-preview').getAttribute('src');
    expect(previewSource).toMatch(/^data:image\/png;base64,/);
    const preview = Buffer.from(previewSource!.split(',')[1], 'base64');
    await page.getByTestId('crop-save-btn').click();
    await clickConversionButtonAsync(page);
    const output = await downloadOutputAsync(page, 'detail_cropped.png');
    const previewPixels = await sharp(preview).ensureAlpha().raw().toBuffer();
    const outputPixels = await sharp(output).ensureAlpha().raw().toBuffer();
    expect(outputPixels.equals(previewPixels)).toBe(true);
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // This line has fully opaque pixels at export size; a 10px bitmap enlarged
    // after import would only contain the faint antialiasing from its source.
    const centerRow = data.subarray(Math.floor(info.height / 2) * info.width * 4, (Math.floor(info.height / 2) + 1) * info.width * 4);
    expect(centerRow.some((value, index) => index % 4 === 0 && value === 255 && centerRow[index + 1] === 0 && centerRow[index + 3] === 255)).toBe(true);
  });
}
