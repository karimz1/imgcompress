import { expect, test } from '@playwright/test';
import path from 'path';
import sharp from 'sharp';
import {
  clickConversionButtonAsync,
  setMaxSizeInMBAsync,
  setOutputFormatAsync,
  setRembgEnabledAsync,
  setResizeWidthAsync,
  switchCompressionModeAsync,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';

const SAMPLE = new ImageFileDto('pexels-pealdesign-28594392.jpg', 3486);
const SAMPLE_B = new ImageFileDto('pexels-willianjusten-29944187.jpg', 3648);

async function saveCustomCropAsync(
  page: import('@playwright/test').Page,
  fileIndex: number,
  width: number,
  height: number
): Promise<void> {
  await page.getByTestId('dropzone-crop-file-btn').nth(fileIndex).click();
  await page.getByTestId('crop-width-input').fill(String(width));
  await page.getByTestId('crop-height-input').fill(String(height));
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
}

test('crop runs first: resize-width applies to the cropped image', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await saveCustomCropAsync(page, 0, 800, 600);

  await setResizeWidthAsync(page, 400);
  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);
  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  expect(downloads[0].metadata.width).toBe(400);
  expect(downloads[0].metadata.height).toBe(300);
  expect(path.basename(downloads[0].newFilePath)).toContain('_cropped');
});

test('crop runs first: AVIF format conversion preserves cropped dimensions', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'AVIF');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await saveCustomCropAsync(page, 0, 500, 500);
  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);
  const linkTexts = await downloadLinks.allTextContents();
  expect(linkTexts.some((t) => t.includes('_cropped') && t.toLowerCase().endsWith('.avif'))).toBe(true);

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  expect(downloads[0].metadata.width).toBe(500);
  expect(downloads[0].metadata.height).toBe(500);
});

test('crop runs first: mixed batch keeps uncropped files untouched', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE, SAMPLE_B]);

  await saveCustomCropAsync(page, 0, 400, 300);

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(2);
  const linkTexts = await downloadLinks.allTextContents();
  expect(linkTexts.filter((t) => t.includes('_cropped')).length).toBe(1);

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  const cropped = downloads.find((d) => path.basename(d.newFilePath).includes('_cropped'));
  const untouched = downloads.find((d) => !path.basename(d.newFilePath).includes('_cropped'));
  expect(cropped, 'cropped output present').toBeDefined();
  expect(untouched, 'untouched output present').toBeDefined();
  expect(cropped!.metadata.width).toBe(400);
  expect(cropped!.metadata.height).toBe(300);
  expect(untouched!.metadata.width).toBe(SAMPLE_B.width);
});

test('crop runs first: AI background removal receives cropped pixels', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'PNG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await saveCustomCropAsync(page, 0, 321, 123);
  await setRembgEnabledAsync(page, true);

  const uploadSeen = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/compress')
  );

  await page.route('**/api/compress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        converted_files: ['pexels-pealdesign-28594392_cropped.png'],
        dest_folder: 'crop-rembg-order-test',
      }),
    });
  });

  await clickConversionButtonAsync(page);
  const request = await uploadSeen;
  const contentType = request.headers()['content-type'] ?? '';
  const body = request.postDataBuffer();
  expect(body, 'multipart upload body').toBeTruthy();

  const parts = parseMultipartFormData(body!, contentType);
  const fields = new Map(
    parts
      .filter((part) => !part.filename)
      .map((part) => [part.name, part.data.toString('utf8')])
  );
  const uploadedImage = parts.find((part) => part.name === 'files[]');

  expect(fields.get('format')).toBe('png');
  expect(fields.get('use_rembg')).toBe('true');
  expect(uploadedImage, 'cropped file uploaded to backend').toBeDefined();
  expect(uploadedImage!.filename).toContain('_cropped');

  const metadata = await sharp(uploadedImage!.data).metadata();
  expect(metadata.width).toBe(321);
  expect(metadata.height).toBe(123);
});

type MultipartPart = {
  name: string;
  filename?: string;
  data: Buffer;
};

function parseMultipartFormData(body: Buffer, contentType: string): MultipartPart[] {
  const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1];
  expect(boundary, 'multipart boundary').toBeTruthy();

  const delimiter = Buffer.from(`--${boundary}`);
  const parts: MultipartPart[] = [];
  let cursor = body.indexOf(delimiter);

  while (cursor !== -1) {
    cursor += delimiter.length;
    if (body.subarray(cursor, cursor + 2).toString() === '--') break;
    if (body.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd === -1) break;

    const headers = body.subarray(cursor, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(delimiter, dataStart);
    if (nextBoundary === -1) break;

    const dataEnd =
      body.subarray(nextBoundary - 2, nextBoundary).toString() === '\r\n'
        ? nextBoundary - 2
        : nextBoundary;
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headers)?.[1] ?? '';
    const name = /name="([^"]+)"/.exec(disposition)?.[1];
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1];

    if (name) {
      parts.push({
        name,
        filename,
        data: body.subarray(dataStart, dataEnd),
      });
    }

    cursor = nextBoundary;
  }

  return parts;
}
