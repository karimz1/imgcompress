import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  clearStorageManagerAsync,
  setOutputFormatAsync,
  setUpscaleAsync,
  uploadGeneratedImageToDropzoneAsync,
} from './utls/helpers';

// Runs the real bundled models on the CPU: one small tile per request.
const SKYLINE_PHOTO = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const SHOTS = process.env.PREVIEW_SCREENSHOT_DIR;

async function openPreviewAsync(page: Page) {
  const photo = await sharp(SKYLINE_PHOTO).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  await page.goto('/');
  await setOutputFormatAsync(page, 'PNG');
  await uploadGeneratedImageToDropzoneAsync(page, 'skyline.jpg', 'image/jpeg', photo);
  await setUpscaleAsync(page, '4x');
  await page.getByTestId('upscale-preview-button').click();
  const dialog = page.getByTestId('upscale-preview-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AI upscaling live preview', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('upscales only the chosen region and re-renders when the image type changes', async ({ page }) => {
    const sent: { model: string; bytes: number }[] = [];
    page.on('request', (request) => {
      if (!request.url().endsWith('/api/upscale/preview')) return;
      const body = request.postDataBuffer() ?? Buffer.alloc(0);
      const model = /name="upscale_model"\r\n\r\n([^\r]+)/.exec(body.toString('latin1'))?.[1] ?? '';
      sent.push({ model, bytes: body.length });
    });

    const dialog = await openPreviewAsync(page);
    const tile = dialog.getByTestId('upscale-preview-tile');
    await expect(tile).toHaveAttribute('data-model', 'general');

    // Drag the square to the top-left corner.
    const source = dialog.getByTestId('upscale-preview-source');
    const box = (await source.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2, box.y + 2, { steps: 5 });
    await page.mouse.up();
    await expect(dialog.getByTestId('upscale-preview-region')).toHaveAttribute('style', /left: 0%; top: 0%/);

    await dialog.getByTestId('upscale-preview-option-low').click();
    await expect(tile).toHaveAttribute('data-model', 'general-denoise-low');
    const after = dialog.getByTestId('upscale-preview-after');
    const rendered = await after.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(rendered).toEqual([640, 640]);
    if (SHOTS) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/preview-desktop.png` });
    }

    // The choice in the preview is the choice for the export.
    await dialog.getByTestId('upscale-preview-close').click();
    await expect(page.getByTestId('upscale-denoise-option-low')).toHaveAttribute('aria-checked', 'true');

    // Only small crops were uploaded, never the whole photo.
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent) expect(request.bytes).toBeLessThan(200_000);
  });

  test('shows only the newest tile and waits while the upscaler is busy', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/upscale/preview', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({ status: 503, headers: { 'Retry-After': '1' }, json: { error: 'busy' } });
        return;
      }
      await route.continue();
    });
    const dialog = await openPreviewAsync(page);
    await expect(dialog.getByTestId('upscale-preview-busy')).toBeVisible();
    // Switch twice quickly: the last choice wins.
    await dialog.getByTestId('upscale-preview-option-medium').click();
    await dialog.getByTestId('upscale-preview-option-low').click();
    await expect(dialog.getByTestId('upscale-preview-tile')).toHaveAttribute('data-model', 'general-denoise-low');
    await page.waitForTimeout(1500);
    await expect(dialog.getByTestId('upscale-preview-tile')).toHaveAttribute('data-model', 'general-denoise-low');
  });

  test('fits on a phone without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    const dialog = await openPreviewAsync(page);
    await expect(dialog.getByTestId('upscale-preview-tile')).toHaveAttribute('data-model', 'general');
    const fits = await dialog.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight && el.scrollHeight <= el.clientHeight;
    });
    expect(fits).toBe(true);
    await expect(dialog.getByTestId('upscale-preview-close')).toBeInViewport({ ratio: 1 });
    if (SHOTS) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/preview-phone-390x664.png` });
    }
  });
});
