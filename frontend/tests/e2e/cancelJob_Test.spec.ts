import path from 'path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setUpscaleAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';

// Cancel must stop the worker in the container, not only the browser wait screen.
const PHOTO = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const NAME = 'skyline-720p.jpg';

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

async function waitForStatusAsync(
  request: APIRequestContext,
  job: { id: string; token: string },
  want: string,
  timeoutMs = 120_000
) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    const response = await request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    last = body.status;
    if (body.status === want) return body;
    if (body.status === 'done' || body.status === 'failed') {
      throw new Error(`job reached ${body.status} before ${want}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${want} (last=${last})`);
}

test.describe('Cancel conversion job', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('Cancel stops the container job: status canceled, no downloads', async ({ page, request }) => {
    const job = await startSlowUpscaleAsync(page);
    await expect(page.getByTestId('job-progress')).toBeVisible();
    await expect(page.getByTestId('splash-cancel')).toBeVisible();

    const canceled = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith(`/api/jobs/${job.id}/cancel`)
    );
    await page.getByTestId('splash-cancel').click();
    const cancelResponse = await canceled;
    expect(cancelResponse.status()).toBe(204);

    await expect(page.getByTestId('job-progress')).toHaveCount(0);
    await expect(page.getByText('Show Compressed Image', { exact: false })).toHaveCount(0);

    const state = await waitForStatusAsync(request, job, 'canceled');
    expect(state.status).toBe('canceled');
    expect(state.result?.converted_files ?? []).toEqual([]);

    const zip = await request.get(`/api/jobs/${job.id}/zip`, { headers: { 'X-Job-Token': job.token } });
    expect(zip.status()).toBe(404);
    const file = await request.get(`/api/jobs/${job.id}/files/${NAME.replace('.jpg', '_ai-upscaled.jpg')}`, {
      headers: { 'X-Job-Token': job.token },
    });
    expect(file.status()).toBe(404);

    // Stays canceled; never flips to done after a short wait.
    await page.waitForTimeout(2000);
    const again = await request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } });
    expect((await again.json()).status).toBe('canceled');
  });

  test('another user cannot cancel a job with a wrong token', async ({ page, request }) => {
    const job = await startSlowUpscaleAsync(page);
    await expect(page.getByTestId('job-progress')).toBeVisible();

    const forbidden = await request.post(`/api/jobs/${job.id}/cancel`, {
      headers: { 'X-Job-Token': 'guess' },
    });
    expect(forbidden.status()).toBe(404);

    const own = await request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } });
    expect(['queued', 'running']).toContain((await own.json()).status);

    // Owner cancels so the suite does not leave a long upscale running.
    expect(
      (
        await request.post(`/api/jobs/${job.id}/cancel`, {
          headers: { 'X-Job-Token': job.token },
        })
      ).status()
    ).toBe(204);
    await waitForStatusAsync(request, job, 'canceled');
  });
});
