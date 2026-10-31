import path from 'path';
import AdmZip from 'adm-zip';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  AssertImageHasTransparentPixels,
  assertDownloadLinksAsync,
  assertFilesPresentInDropzoneAsync,
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  clickDownloadZipButtonAndGetUrlAsync,
  setOutputFormatAsync,
  setRembgEnabledAsync,
  setUpscaleAsync,
  uploadBuffersToDropzoneAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

/**
 * Real-world journeys with several images: edit one in the editor, run an AI
 * feature on all of them, download, and check every file. Sources are small
 * copies of the sample photos so the CPU models finish fast in CI.
 * (HEIC is left out: sharp in the test runner cannot write small HEIC copies,
 * and the full-size sample would make a CPU upscale far too slow.)
 */

const SKYLINE = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const PRODUCT = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-pealdesign-28594392.jpg');

type Upload = { name: string; mimeType: string; buffer: Buffer };

async function photoAsync(src: string, name: string, width: number, height: number, format: 'jpeg' | 'png' | 'webp'): Promise<Upload> {
  const buffer = await sharp(src).resize(width, height, { fit: 'cover' })[format]().toBuffer();
  return { name, mimeType: `image/${format}`, buffer };
}

async function cropAsync(page: Page, name: string, width: number, height: number): Promise<void> {
  const row = page.getByTestId('dropzone-added-file-wrapper').filter({ hasText: name });
  await row.getByTestId('dropzone-crop-file-btn').click();
  await page.getByTestId('crop-precise-selection-toggle').click();
  await page.getByTestId('crop-width-input').fill(String(width));
  await page.getByTestId('crop-height-input').fill(String(height));
  await page.getByTestId('crop-save-btn').click();
  await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
}

const stem = (file: string) => path.basename(file).split(/_cropped|_ai-/)[0].replace(/\.[^.]+$/, '');

test.describe('Real-world journeys with several images', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('photo book: crop one photo, upscale all 2× as photos, reload mid-job, download the ZIP', async ({ page, request }) => {
    const notifyEnabled = (await (await request.get('/config/runtime.json')).json()).NOTIFY_ENABLED === 'true';
    const uploads = [
      await photoAsync(SKYLINE, 'beach.jpg', 320, 180, 'jpeg'),
      await photoAsync(PRODUCT, 'family.png', 240, 240, 'png'),
      await photoAsync(SKYLINE, 'tower.webp', 200, 300, 'webp'),
    ];

    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await uploadBuffersToDropzoneAsync(page, uploads);
    await assertFilesPresentInDropzoneAsync(page, uploads.map((u) => new ImageFileDto(u.name)));

    // Landscape beach photo becomes a portrait page.
    await cropAsync(page, 'beach.jpg', 120, 160);

    await setUpscaleAsync(page, '2x');
    const photoPreset = page.getByRole('radiogroup', { name: 'Image type' }).getByRole('radio', { name: /Photo \(keep details\)/ });
    await photoPreset.click();
    await expect(photoPreset).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('upscale-slow-hint')).toContainText('Can take a few minutes per image.');
    await expect(page.getByTestId('upscale-notify-tip')).toHaveCount(notifyEnabled ? 0 : 1);

    const started = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/jobs'));
    await clickConversionButtonAsync(page);
    expect((await started).status()).toBe(202);

    // The user closes the tab mid-job and comes back in the same browser.
    await page.reload();
    const links = await assertDownloadLinksAsync(
      page,
      [new ImageFileDto('beach_cropped.jpg'), new ImageFileDto('family.jpg'), new ImageFileDto('tower.jpg')],
      '_ai-upscaled',
    );
    await expect(links).toHaveCount(3);

    const zip = new AdmZip(await clickDownloadZipButtonAndGetUrlAsync(page));
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    expect(entries).toHaveLength(3);
    const sizes: Record<string, string> = {};
    for (const entry of entries) {
      const meta = await sharp(entry.getData()).metadata();
      expect(meta.format, entry.entryName).toBe('jpeg');
      sizes[stem(entry.entryName)] = `${meta.width}×${meta.height}`;
    }
    // Crop first, then 2×: the cropped one is portrait, the others keep their shape.
    expect(sizes).toEqual({ beach: '240×320', family: '480×480', tower: '400×600' });
  });

  test('online shop: crop one product photo, remove all backgrounds, export PNG', async ({ page }) => {
    const uploads = [
      await photoAsync(PRODUCT, 'mug.jpg', 300, 200, 'jpeg'),
      await photoAsync(PRODUCT, 'lamp.png', 200, 200, 'png'),
      await photoAsync(PRODUCT, 'vase.webp', 240, 160, 'webp'),
    ];

    await page.goto('/');
    await uploadBuffersToDropzoneAsync(page, uploads);
    await assertFilesPresentInDropzoneAsync(page, uploads.map((u) => new ImageFileDto(u.name)));
    await cropAsync(page, 'mug.jpg', 150, 150);

    await setOutputFormatAsync(page, 'PNG');
    await setRembgEnabledAsync(page, true);
    await clickConversionButtonAsync(page);

    const links = await assertDownloadLinksAsync(
      page,
      [new ImageFileDto('mug_cropped.png'), new ImageFileDto('lamp.png'), new ImageFileDto('vase.png')],
      '_ai-bg-removed',
    );
    const downloads = await downloadFilesAndGetMetadataAsync(page, links);
    expect(downloads).toHaveLength(3);
    const sizes: Record<string, string> = {};
    for (const { metadata, newFilePath } of downloads) {
      expect(metadata.format).toBe('png');
      expect(metadata.hasAlpha).toBeTruthy();
      await AssertImageHasTransparentPixels(newFilePath);
      sizes[stem(newFilePath)] = `${metadata.width}×${metadata.height}`;
    }
    // Only the cropped one changes size; background removal keeps the rest as they are.
    expect(sizes).toEqual({ mug: '150×150', lamp: '200×200', vase: '240×160' });
  });
});
