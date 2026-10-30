import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import { clickConversionButtonAsync, setOutputFormatAsync, uploadBuffersToDropzoneAsync } from './utls/helpers';

/**
 * The wait screen on phones: Cancel, the "Notify me when done" switch, the
 * timer and the tip must all be on screen without scrolling (iPhone Safari
 * shows about 390×664, an iPhone 15 Pro Max about 430×740, an iPhone SE about 375×548). On a very short screen it
 * may scroll, but Cancel must stay reachable.
 *
 * The job status is answered by the test (a long upscale at part 13 of 18,
 * the longest progress line), and runtime.json turns the switch on, so this
 * runs the same in every CI entry and never waits for a real conversion.
 */

const MARGIN = 8;
const JOB_STATUS = /\/api\/jobs\/[^/]+$/;
const SCREENS = [
  { name: 'iPhone 15 Pro Max Safari', width: 430, height: 740 },
  { name: 'iPhone 15 Safari', width: 390, height: 664 },
  { name: 'iPhone SE Safari', width: 375, height: 548 },
];
// English plus the locales with the longest wait-screen texts.
const LOCALES = ['en', 'de', 'fr', 'ru', 'hi'];

async function showWaitScreenAsync(page: Page, locale: string): Promise<void> {
  await page.addInitScript((code) => window.localStorage.setItem('imgcompress_locale', code), locale);
  await page.route('**/config/runtime.json', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), NOTIFY_ENABLED: 'true' } });
  });
  await page.route(JOB_STATUS, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const now = Date.now() / 1000;
    await route.fulfill({
      json: {
        id: 'x',
        status: 'running',
        created_at: now - 210,
        started_at: now - 210,
        server_time: now,
        progress: { files_done: 0, files_total: 1, tiles_done: 13, tiles_total: 18 },
      },
    });
  });
  await page.goto('/');
  await setOutputFormatAsync(page, 'JPEG');
  const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#3366cc' } }).png().toBuffer();
  await uploadBuffersToDropzoneAsync(page, [{ name: 'photo.png', mimeType: 'image/png', buffer: photo }]);
  await clickConversionButtonAsync(page);
  await expect(page.getByTestId('job-elapsed')).toBeVisible();
  await expect(page.getByTestId('notify-switch')).toBeVisible();
}

async function expectInViewportAsync(page: Page, locator: Locator, what: string): Promise<void> {
  const box = await locator.boundingBox();
  const { height, width } = page.viewportSize()!;
  expect(box, `${what} is rendered`).not.toBeNull();
  // A little room at both edges, so nothing sits under the Safari toolbar.
  expect(box!.y, `${what} starts on screen`).toBeGreaterThanOrEqual(MARGIN);
  expect(box!.y + box!.height, `${what} ends on screen (viewport ${height}px)`).toBeLessThanOrEqual(height - MARGIN);
  expect(box!.x + box!.width, `${what} fits the width`).toBeLessThanOrEqual(width + 0.5);
}

for (const screen of SCREENS) {
  test.describe(`Wait screen on ${screen.name} (${screen.width}×${screen.height})`, () => {
    test.use({ viewport: { width: screen.width, height: screen.height }, hasTouch: true, isMobile: true });

    for (const locale of LOCALES) {
      test(`everything fits without scrolling (${locale})`, async ({ page }) => {
        await showWaitScreenAsync(page, locale);
        // Local review only: MOBILE_SHOTS=/some/dir saves what the phone shows.
        if (process.env.MOBILE_SHOTS && locale === 'en') {
          await page.screenshot({ path: `${process.env.MOBILE_SHOTS}/${screen.width}x${screen.height}.png` });
        }
        await expectInViewportAsync(page, page.getByTestId('splash-cancel'), 'Cancel');
        await expectInViewportAsync(page, page.getByTestId('notify-switch'), 'Notify switch');
        await expectInViewportAsync(page, page.getByTestId('job-elapsed'), 'Timer');
        await expectInViewportAsync(page, page.getByTestId('job-progress'), 'Progress');
        await expectInViewportAsync(page, page.getByTestId('job-background-hint'), 'Tip');
        if (locale === 'en') {
          // An upscale gets the slow-CPU tip that points to the notify switch.
          await expect(page.getByTestId('job-background-hint')).toHaveText(
            'AI upscaling can take minutes, on small CPUs much longer. Turn on “Notify me when done” and close this tab.'
          );
        }
      });
    }
  });
}

test.describe('Wait screen on a phone in landscape (664×300)', () => {
  test.use({ viewport: { width: 664, height: 300 }, hasTouch: true, isMobile: true });

  test('it scrolls, and Cancel can be reached', async ({ page }) => {
    await showWaitScreenAsync(page, 'de');
    const cancel = page.getByTestId('splash-cancel');
    // Too short for everything: the screen scrolls (no clipping), so Cancel is reachable.
    const scrolls = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="splash-cancel"]')!;
      el.scrollIntoView({ block: 'center' });
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    expect(scrolls).toBe(true);
    await expectInViewportAsync(page, cancel, 'Cancel');
    await expect(cancel).toBeEnabled();
  });
});

test.describe('Wait screen on desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps the large logo and shows everything', async ({ page }) => {
    await showWaitScreenAsync(page, 'en');
    const logo = page.getByAltText('ImgCompress Logo');
    expect((await logo.boundingBox())!.height).toBeGreaterThanOrEqual(200);
    await expectInViewportAsync(page, page.getByTestId('splash-cancel'), 'Cancel');
  });
});
