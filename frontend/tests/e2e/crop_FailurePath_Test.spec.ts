import { expect, Locator, Page, Route, test } from '@playwright/test';
import path from 'path';

const PSD_FILE_NAME = '37443511_8499861.psd';

async function openCropFailureAsync(
  page: Page,
  handler: (route: Route) => Promise<void>
): Promise<Locator> {
  await mockCropShellApiAsync(page);
  await bootCropFailurePageAsync(page);
  await uploadPsdAsync(page);
  await page.route('**/api/crop/bitmap', handler);

  await page.getByTestId('dropzone-crop-file-btn').first().click();
  await expect(page.getByTestId('crop-dialog')).toBeVisible();

  const failurePanel = page.getByTestId('crop-load-failure');
  await expect(failurePanel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('crop-width-input')).toHaveCount(0);
  return failurePanel;
}

async function bootCropFailurePageAsync(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(async () => {
    const count = page.getByTestId('supported-formats-count');
    if ((await count.count()) === 0) return 0;
    const text = await count.first().innerText();
    const value = Number(text.trim());
    return Number.isFinite(value) ? value : 0;
  }).toBeGreaterThan(0);
  await setOutputFormatAsync(page, 'PNG');
}

async function setOutputFormatAsync(page: Page, format: string): Promise<void> {
  const trigger = page.locator('#outputFormat');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.locator('[data-radix-collection-item][role="option"]', {
    hasText: new RegExp(format, 'i'),
  });
  await expect(option).toBeVisible();
  await option.click();
}

async function uploadPsdAsync(page: Page): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    'fixtures',
    'sample-images',
    PSD_FILE_NAME
  );
  await page.getByTestId('dropzone-input').setInputFiles(filePath);
  await expect(page.getByTestId('dropzone-added-file')).toContainText(PSD_FILE_NAME);
}

async function mockCropShellApiAsync(page: Page): Promise<void> {
  await page.route('**/config/runtime.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        DISABLE_LOGO: 'false',
        DISABLE_STORAGE_MANAGEMENT: 'false',
        DEV_MODE: 'false',
      }),
    });
  });
  await page.route('**/api/images_supported', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        supported_formats: ['.png', '.jpg', '.jpeg', '.psd', '.eps'],
      }),
    });
  });
  await page.route('**/api/images_verified', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        verified_formats: ['.png', '.jpg', '.jpeg', '.psd', '.eps'],
      }),
    });
  });
  await page.route('**/api/crop_unsupported_formats', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        unsupported_formats: ['.pdf', '.svg', '.raw', '.cr2', '.nef', '.arw', '.dng'],
      }),
    });
  });
  await page.route('**/api/rembg_model', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ model_name: 'u2net' }),
    });
  });
  await page.route('**/api/health/backend', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'running',
        utc_time: new Date().toISOString(),
      }),
    });
  });
}

test('crop modal: bitmap render 500 surfaces actionable error with details', async ({ page }) => {
  const failurePanel = await openCropFailureAsync(page, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Could not decode this format for cropping.',
        details:
          "Traceback (most recent call last):\n  File 'psd_renderer.py', line 23, in render\n    psd = PSDImage.open(BytesIO(data))\nValueError: 2054 is not a valid ColorMode",
      }),
    });
  });

  await expect(failurePanel).toContainText('PSD');
  await expect(page.getByTestId('crop-load-failure-message')).toContainText(
    'after 3 attempts'
  );

  const detailsBlock = page.getByTestId('crop-load-failure-details');
  await expect(detailsBlock).toBeVisible();
  const detailsText = await detailsBlock.textContent();
  expect(detailsText).toContain('Attempt 1');
  expect(detailsText).toContain('Attempt 3');
  expect(detailsText).toContain('HTTP 500');
  await expect(page.getByTestId('crop-load-failure-causes')).toContainText(
    "decoder can't read"
  );
  await expect(page.getByTestId('crop-load-failure-causes')).toContainText(
    "PSD files always go through the backend's decoder"
  );
  await expect(page.getByTestId('crop-load-failure-causes')).toContainText(
    'open a ticket'
  );

  await page.getByTestId('crop-load-failure-report-btn').click();
  await expect(page.getByTestId('error-message')).toContainText('after 3 attempts');
  await expect(page.getByTestId('error-details')).toContainText('Attempt 1');
});

test('crop modal: missing crop bitmap route explains backend availability', async ({ page }) => {
  await openCropFailureAsync(page, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not found' }),
    });
  });

  await expect(page.getByTestId('crop-load-failure-message')).toContainText(
    'after 3 attempts'
  );
  await expect(page.getByTestId('crop-load-failure-causes')).toContainText(
    "The backend service isn't reachable yet"
  );
});

test('crop modal: crop bitmap network failure explains dropped connection', async ({ page }) => {
  await openCropFailureAsync(page, async (route) => {
    await route.abort('failed');
  });

  await expect(page.getByTestId('crop-load-failure-message')).toContainText(
    'after 3 attempts'
  );
  await expect(page.getByTestId('crop-load-failure-causes')).toContainText(
    'The connection to the backend dropped mid-upload'
  );
});
