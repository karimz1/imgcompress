import path from 'path';
import { expect, Page } from '@playwright/test';
import { ImageFileDto } from './ImageFileDto';
import {
  setOutputFormatAsync,
  uploadFilesToDropzoneAsync,
  waitForSupportedFormatsCountAsync,
} from './helpers';

export const CROP_FIXTURES = {
  jpg: new ImageFileDto('pexels-pealdesign-28594392.jpg', 3486),
  jpgB: new ImageFileDto('pexels-willianjusten-29944187.jpg', 3648),
  psd: new ImageFileDto('37443511_8499861.psd'),
  eps: new ImageFileDto(
    'vecteezy_new-update-logo-template-illustration_5412356-0.eps'
  ),
  pdf: new ImageFileDto('imgcompress_multipage_test.pdf'),
};

export async function bootCropPageAsync(
  page: Page,
  outputFormat: string = 'JPEG'
): Promise<void> {
  await page.goto('/');
  await waitForSupportedFormatsCountAsync(page);
  await setOutputFormatAsync(page, outputFormat);
}

export async function uploadAndOpenCropAsync(
  page: Page,
  sample: ImageFileDto
): Promise<void> {
  await uploadFilesToDropzoneAsync(page, [sample]);
  await expect(page.getByTestId('dropzone-added-file')).toContainText(
    sample.fileName
  );
  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
}

export async function saveCustomCropAsync(
  page: Page,
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

export function fixturePath(sample: ImageFileDto): string {
  return path.resolve(__dirname, '..', 'fixtures', 'sample-images', sample.fileName);
}
