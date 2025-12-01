import path from 'path';
import { expect, test } from '@playwright/test';
import {
  uploadFilesToDropzoneAsync,
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';

test('should rasterize a PDF upload and expose the converted page for download', async ({ page }) => {
  await page.goto('/');

  const pdfFile = new ImageFileDto('imgcompress_screenshot.pdf');

  await uploadFilesToDropzoneAsync(page, [pdfFile]);
  await assertFilesPresentInDropzoneAsync(page, [pdfFile]);

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);

  const linkText = (await downloadLinks.first().textContent()) ?? '';
  expect(linkText).toContain('imgcompress_screenshot_page-1');

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  expect(downloads).toHaveLength(1);

  const { newFilePath, metadata } = downloads[0];
  expect(path.basename(newFilePath)).toMatch(/imgcompress_screenshot_page-1/i);
  expect((metadata.width ?? 0)).toBeGreaterThan(0);
  expect((metadata.height ?? 0)).toBeGreaterThan(0);
});

test('should rasterize a three-page PDF upload and expose all converted pages for download', async ({ page }) => {
  await page.goto('/');

  const fileBaseName = 'imgcompress_multipage_test';
  const pdfFile = new ImageFileDto(`${fileBaseName}.pdf`);
  const expectedPageCount = 3;

  await uploadFilesToDropzoneAsync(page, [pdfFile]);
  await assertFilesPresentInDropzoneAsync(page, [pdfFile]);

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(expectedPageCount);

  // Assert that each link exposes the correct page suffix
  const linkTexts = await downloadLinks.allTextContents();
  for (let pageIndex = 1; pageIndex <= expectedPageCount; pageIndex++) {
    const expectedLabel = `${fileBaseName}_page-${pageIndex}`;
    const found = linkTexts.some((text) => (text ?? '').includes(expectedLabel));
    expect(found).toBeTruthy();
  }

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  expect(downloads).toHaveLength(expectedPageCount);

  const expectedNames = new Set(
    Array.from({ length: expectedPageCount }, (_, idx) => `${fileBaseName}_page-${idx + 1}`),
  );

  downloads.forEach(({ newFilePath, metadata }) => {
    const baseName = path.basename(newFilePath, path.extname(newFilePath));
    expect(expectedNames.has(baseName)).toBeTruthy();
    expectedNames.delete(baseName);

    expect(metadata.width ?? 0).toBeGreaterThan(0);
    expect(metadata.height ?? 0).toBeGreaterThan(0);
  });
});
