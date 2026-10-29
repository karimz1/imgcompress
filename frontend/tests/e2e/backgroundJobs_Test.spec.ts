import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  assertDownloadLinksAsync,
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setUpscaleAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';

// Conversions run as background jobs, so leaving the page (an iPhone app
// switch, a reload, a closed tab) or a dropped request no longer loses them.
const PHOTO = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const NAME = 'skyline-720p.jpg';
const UPSCALED = new ImageFileDto(NAME);
const JOB_STATUS = /\/api\/jobs\/[^/]+$/;

async function startSlowUpscaleAsync(page: Page): Promise<{ id: string; token: string }> {
  const photo = await sharp(PHOTO).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await waitForSupportedFormatsCountAsync(page);
  await page.getByTestId('dropzone-input').setInputFiles([{ name: NAME, mimeType: 'image/jpeg', buffer: photo }]);
  await setUpscaleAsync(page, '4k');
  const started = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/jobs'));
  await clickConversionButtonAsync(page);
  const response = await started;
  expect(response.status()).toBe(202);
  return response.json();
}

async function hidePageAsync(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (isHidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('Background conversion jobs', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('an upscale keeps running while the user leaves, and the result is there on return', async ({ page }) => {
    await startSlowUpscaleAsync(page);
    await expect(page.getByTestId('job-background-hint')).toContainText('You can switch to another app or close this tab');
    await expect(page.getByTestId('job-progress')).toContainText(/Upscaling: part \d+ of \d+/);

    // The phone switches apps: the page is hidden, then gone completely.
    await hidePageAsync(page, true);
    await page.goto('about:blank');
    await page.waitForTimeout(1500);

    // Back in Safari: the page loads again and picks the job up.
    await page.goto('/');
    const links = await assertDownloadLinksAsync(page, [UPSCALED], '_ai-upscaled');
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    const [file] = await downloadFilesAsync(page, links);
    const { width, height } = await sharp(file).metadata();
    expect(`${width}×${height}`).toBe('3840×2160');
    // The job is finished, so the next reload does not start waiting again.
    await page.reload();
    await expect(page.getByTestId('job-progress')).toHaveCount(0);
  });

  test('a reload in the middle of a job resumes it', async ({ page }) => {
    await startSlowUpscaleAsync(page);
    await expect(page.getByTestId('job-progress')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('job-background-hint')).toBeVisible();
    await assertDownloadLinksAsync(page, [UPSCALED], '_ai-upscaled');
  });

  test('a dropped status request is retried quietly instead of showing "Load failed"', async ({ page }) => {
    let dropped = 0;
    await page.route(JOB_STATUS, async (route) => {
      if (dropped < 2) {
        dropped += 1;
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    });
    await startSlowUpscaleAsync(page);
    await assertDownloadLinksAsync(page, [UPSCALED], '_ai-upscaled');
    expect(dropped).toBe(2);
    await expect(page.getByText('Load failed')).toHaveCount(0);
    await expect(page.locator('div[role="alertdialog"]')).toHaveCount(0);
  });

  test("another user cannot read a job even when they know its id", async ({ browser }) => {
    const alice = await browser.newContext();
    const bob = await browser.newContext();
    try {
      const alicePage = await alice.newPage();
      const job = await startSlowUpscaleAsync(alicePage);
      await assertDownloadLinksAsync(alicePage, [UPSCALED], '_ai-upscaled');

      const own = await alice.request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } });
      expect(own.status()).toBe(200);

      const unknown = await bob.request.get(`/api/jobs/${'Z'.repeat(22)}`, { headers: { 'X-Job-Token': 'guess' } });
      for (const response of [
        await bob.request.get(`/api/jobs/${job.id}`),
        await bob.request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': 'guess' } }),
        await bob.request.get(`/api/jobs/${job.id}/zip`),
        await bob.request.get(`/api/jobs/${job.id}/files/skyline-720p_ai-upscaled.jpg`),
      ]) {
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual(await unknown.json());
      }

      // Even with Alice's id planted in Bob's browser, Bob's page shows nothing of hers.
      const bobPage = await bob.newPage();
      await bobPage.goto('/');
      await bobPage.evaluate((id) => localStorage.setItem('imgcompress.activeJob', JSON.stringify({ id, token: 'guess' })), job.id);
      await bobPage.reload();
      await expect(bobPage.getByText('This conversion is no longer available.').first()).toBeVisible();
      await expect(bobPage.getByTestId('drawer-uploaded-file-item-link')).toHaveCount(0);
    } finally {
      await alice.close();
      await bob.close();
    }
  });
});
