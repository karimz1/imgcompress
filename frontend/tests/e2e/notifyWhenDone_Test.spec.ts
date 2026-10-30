import http from 'http';
import path from 'path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setUpscaleAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';

/**
 * "Notify me when done". Without NOTIFY_URL (the default E2E container) the
 * switch must not exist. With NOTIFY_URL=json://127.0.0.1:5199/notify (CI
 * feature-flags entry "notify") the app posts to the capture server below,
 * a stand-in for ntfy: exactly one message for the opted-in job, none for others.
 * It also runs in the storage-HIDDEN entries, so it must not use the storage API.
 */

const PHOTO = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const CAPTURE_PORT = Number(process.env.NOTIFY_CAPTURE_PORT || 5199);
const SWITCH = '[data-testid="notify-switch"]';
const JOB_STATUS = /\/api\/jobs\/[^/]+$/;

type Message = { title?: string; message?: string };

async function notifyEnabledAsync(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/config/runtime.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()).NOTIFY_ENABLED === 'true';
}

async function startJobAsync(page: Page, name: string, upscale: boolean) {
  const photo = await sharp(PHOTO).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  await waitForSupportedFormatsCountAsync(page);
  await page.getByTestId('dropzone-input').setInputFiles([{ name, mimeType: 'image/jpeg', buffer: photo }]);
  if (upscale) await setUpscaleAsync(page, '4k');
  const started = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/jobs'));
  await clickConversionButtonAsync(page);
  const response = await started;
  expect(response.status()).toBe(202);
  return response.json() as Promise<{ id: string; token: string }>;
}

async function waitDoneAsync(request: APIRequestContext, job: { id: string; token: string }) {
  await expect
    .poll(
      async () => (await (await request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } })).json()).status,
      { timeout: 240_000 }
    )
    .toBe('done');
}

test.describe('Notify me when done', () => {
  test('the switch is hidden when the server has no NOTIFY_URL', async ({ page, request }) => {
    test.skip(await notifyEnabledAsync(request), 'NOTIFY_URL is set in this run');
    // Hold the polls so the splash stays up long enough to look at it.
    await page.route(JOB_STATUS, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await startJobAsync(page, 'quick.jpg', false);
    await expect(page.getByTestId('job-background-hint')).toBeVisible();
    await expect(page.locator(SWITCH)).toHaveCount(0);
  });

  test.describe('with NOTIFY_URL', () => {
    let server: http.Server;
    const received: Message[] = [];

    test.beforeAll(async ({ request }) => {
      if (!(await notifyEnabledAsync(request))) return;
      server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            received.push(JSON.parse(body));
          } catch {
            received.push({ message: body });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
        });
      });
      await new Promise<void>((resolve) => server.listen(CAPTURE_PORT, '127.0.0.1', resolve));
    });

    test.afterAll(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
    });

    test.beforeEach(async ({ request }) => {
      test.skip(!(await notifyEnabledAsync(request)), 'NOTIFY_URL is not set in this run');
      received.length = 0;
    });

    test('off by default; turned on, exactly one message for that job and none for another', async ({ page, request }) => {
      test.setTimeout(300_000);
      const mine = await startJobAsync(page, 'private-holiday-photo.jpg', true);
      const toggle = page.locator(SWITCH);
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');

      const saved = page.waitForResponse((r) => r.url().endsWith(`/api/jobs/${mine.id}/notify`));
      await toggle.click();
      expect((await saved).status()).toBe(204);
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // The tab may close now: the server sends the message on its own.
      await page.goto('about:blank');
      await waitDoneAsync(request, mine);
      await expect.poll(() => received.length, { timeout: 30_000 }).toBe(1);
      const [message] = received;
      // Server-side duration, worded like the done sheet.
      expect(message.title).toMatch(/^1 image ready in (\d+ s|\d+ min \d+ s)$/);
      // Where to open the result (it belongs to this browser). The link comes only from
      // PUBLIC_BASE_URL; CI sets it to https://imgcompress.example (never the request's host).
      expect(message.message).toMatch(/^Open imgcompress in .+ on your .+ to get your result\.\nhttps:\/\/imgcompress\.example$/);
      expect(JSON.stringify(message)).not.toContain('private-holiday-photo');

      // A second job without the switch: no message. Forget the first result,
      // so the page opens on an empty form rather than on that result.
      await page.goto('/');
      await page.evaluate(() => localStorage.removeItem('imgcompress.activeJob'));
      const other = await startJobAsync(page, 'second.jpg', false);
      await waitDoneAsync(request, other);
      await page.waitForTimeout(3000);
      expect(received).toHaveLength(1);
    });
  });
});
