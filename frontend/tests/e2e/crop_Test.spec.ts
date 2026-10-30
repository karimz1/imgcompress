import { expect, test } from '@playwright/test';
import path from 'path';
import sharp, { type Metadata } from 'sharp';
import {
  assertFilesPresentInDropzoneAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  uploadFilesToDropzoneAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';

const SAMPLE = new ImageFileDto('pexels-pealdesign-28594392.jpg', 3486);

test('crop modal: opens, applies 16:9 preset, saves crop, badge appears', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);
  await assertFilesPresentInDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await expect(page.getByTestId('crop-widget')).toBeVisible();

  await page.getByTestId('crop-preset-16:9').click();
  const dimsLabel = page.getByTestId('crop-dims-label');
  await expect(dimsLabel).toContainText('×');
  await expect(dimsLabel).toContainText('px');

  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
  const badge = page.getByTestId('dropzone-crop-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('cropped');
});

test('crop modal: discard on a fresh modal leaves no badge', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await page.getByTestId('crop-discard-btn').click();

  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-badge')).toHaveCount(0);
});

test('crop modal: canceling the close warning keeps the editor open', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-precise-selection-toggle').click();
  await page.getByTestId('crop-width-input').fill('500');
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await page.getByTestId('dialog-close').click();
  await expect(page.getByTestId('crop-discard-confirm-dialog')).toBeVisible();

  await page.getByTestId('crop-discard-cancel-btn').click();
  await expect(page.getByTestId('crop-discard-confirm-dialog')).toHaveCount(0);
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
});

test('crop modal: discard while editing keeps the previously saved crop', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-1:1').click();
  await page.getByTestId('crop-save-btn').click();
  const badge = page.getByTestId('dropzone-crop-badge');
  await expect(badge).toBeVisible();
  const beforeText = await badge.textContent();

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-16:9').click();
  await page.getByTestId('crop-discard-btn').click();
  await expect(page.getByTestId('crop-discard-confirm-dialog')).toBeVisible();
  await page.getByTestId('crop-discard-confirm-btn').click();

  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(beforeText ?? '');
});

test('crop modal: closing via Escape preserves the saved crop', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-1:1').click();
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-precise-selection-toggle').click();
  await page.getByTestId('crop-width-input').fill('500');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('crop-discard-confirm-dialog')).toBeVisible();
  await page.getByTestId('crop-discard-confirm-btn').click();
  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();
});

test('crop badge × button removes the saved crop', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-1:1').click();
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();

  await page.getByTestId('dropzone-crop-badge-clear-btn').click();
  await expect(page.getByTestId('crop-remove-confirm-dialog')).toBeVisible();
  await page.getByTestId('crop-remove-confirm-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-file-btn')).toHaveText('Edit image');
});

test('crop modal: remove saved crop from the editor', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-1:1').click();
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();
  await expect(page.getByTestId('dropzone-crop-file-btn')).toHaveText('Edit');

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-remove-saved-btn')).toBeVisible();
  await page.getByTestId('crop-remove-saved-btn').click();
  await expect(page.getByTestId('crop-remove-confirm-dialog')).toBeVisible();
  await page.getByTestId('crop-remove-confirm-btn').click();

  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-badge')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-file-btn')).toHaveText('Edit image');
});

test('crop modal: canceling remove saved crop keeps the crop editor open', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-preset-1:1').click();
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-remove-saved-btn').click();
  await expect(page.getByTestId('crop-remove-confirm-dialog')).toBeVisible();

  await page.getByTestId('crop-remove-cancel-btn').click();
  await expect(page.getByTestId('crop-remove-confirm-dialog')).toHaveCount(0);
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();
});

test('crop modal: reset selection restores the default crop for the active preset', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  const dimsLabel = page.getByTestId('crop-dims-label');
  const defaultText = await dimsLabel.textContent();

  await page.getByTestId('crop-precise-selection-toggle').click();
  await page.getByTestId('crop-width-input').fill('500');
  await page.getByTestId('crop-height-input').fill('400');
  await expect(dimsLabel).toHaveText('500 × 400 px');

  await page.getByTestId('crop-selection-reset-btn').click();
  await expect(dimsLabel).toHaveText(defaultText ?? '');
});

test('zooming out keeps the image centered and preserves exported crop dimensions', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-width-input')).toBeHidden();
  await page.getByTestId('crop-precise-selection-toggle').click();
  await page.getByTestId('crop-width-input').fill('500');
  await page.getByTestId('crop-height-input').fill('400');

  await page.getByTestId('crop-widget').evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
  });
  const image = page.getByRole('img', { name: SAMPLE.fileName, exact: true });
  const initial = await image.boundingBox();
  if (!initial) throw new Error('Crop image is missing');
  await page.getByTestId('crop-zoom-out').click();
  await page.getByTestId('crop-zoom-out').click();
  await expect(page.getByTestId('crop-zoom-label')).toHaveText('50%');
  const smaller = await image.boundingBox();
  if (!smaller) throw new Error('Zoomed crop image is missing');
  expect(smaller.width / initial.width).toBeCloseTo(0.5, 2);
  expect(Math.abs(smaller.x + smaller.width / 2 - initial.x - initial.width / 2)).toBeLessThan(2);
  expect(Math.abs(smaller.y + smaller.height / 2 - initial.y - initial.height / 2)).toBeLessThan(2);
  await expect(page.getByTestId('crop-dims-label')).toHaveText('500 × 400 px');

  await page.getByTestId('crop-zoom-out').click();
  await expect(page.getByTestId('crop-zoom-label')).toHaveText('25%');
  await expect(page.getByTestId('crop-zoom-out')).toBeDisabled();
  await page.getByTestId('crop-zoom-reset').click();
  await expect(page.getByTestId('crop-zoom-label')).toHaveText('100%');
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.mouse.wheel(0, 150);
  await expect(page.getByTestId('crop-zoom-label')).toHaveText('75%');
  await page.getByTestId('crop-zoom-out').click();

  await page.getByTestId('crop-save-btn').click();

  const badge = page.getByTestId('dropzone-crop-badge');
  await expect(badge).toContainText('500');
  await expect(badge).toContainText('400');

  await clickConversionButtonAsync(page);
  await expect(page.getByTestId('drawer-uploaded-file-item-link')).toHaveCount(1);
  const downloads = await downloadFilesAndGetMetadataAsync(page, page.getByTestId('drawer-uploaded-file-item-link'));
  expect(downloads[0].metadata.width).toBe(500);
  expect(downloads[0].metadata.height).toBe(400);
});

test('changing only the view zoom closes without an unsaved-edit warning', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);
  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await page.getByTestId('crop-zoom-out').click();
  await expect(page.getByTestId('crop-zoom-label')).toHaveText('75%');
  await page.getByTestId('crop-discard-btn').click();
  await expect(page.getByTestId('crop-dialog')).toBeHidden();
  await expect(page.getByTestId('crop-discard-confirm-dialog')).toHaveCount(0);
  await expect(page.getByTestId('dropzone-crop-badge')).toHaveCount(0);
});

test('crop is applied to the converted output and filename carries _cropped suffix', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [SAMPLE]);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  const widthInput = page.getByTestId('crop-width-input');
  const heightInput = page.getByTestId('crop-height-input');
  await page.getByTestId('crop-precise-selection-toggle').click();
  await widthInput.fill('400');
  await heightInput.fill('300');
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('dropzone-crop-badge')).toBeVisible();

  await clickConversionButtonAsync(page);

  const downloadLinks = page.locator('[data-testid="drawer-uploaded-file-item-link"]');
  await expect(downloadLinks).toHaveCount(1);
  const linkTexts = await downloadLinks.allTextContents();
  expect(linkTexts.some((t) => t.includes('_cropped'))).toBe(true);

  const downloads = await downloadFilesAndGetMetadataAsync(page, downloadLinks);
  expect(downloads.length).toBe(1);
  const meta: Metadata = downloads[0].metadata;
  expect(meta.width).toBe(400);
  expect(meta.height).toBe(300);
  const downloadedName = path.basename(downloads[0].newFilePath);
  expect(downloadedName).toContain('_cropped');
});
