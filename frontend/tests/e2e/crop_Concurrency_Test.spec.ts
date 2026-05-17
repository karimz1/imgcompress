import { expect, test, BrowserContext } from '@playwright/test';
import { CROP_FIXTURES } from './utls/cropHelpers';
import { setOutputFormatAsync, uploadFilesToDropzoneAsync } from './utls/helpers';

test('crop bitmap rendering is non-blocking across simultaneous browser contexts', async ({
  browser,
}) => {
  const PARALLEL_USERS = 3;

  const contexts: BrowserContext[] = await Promise.all(
    Array.from({ length: PARALLEL_USERS }, () => browser.newContext())
  );
  try {
    const bitmapResponses = await Promise.all(
      contexts.map(async (ctx, idx) => {
        const page = await ctx.newPage();
        await page.goto('/');
        await setOutputFormatAsync(page, 'PNG');
        await uploadFilesToDropzoneAsync(page, [CROP_FIXTURES.psd]);
        await expect(page.getByTestId('dropzone-added-file')).toContainText(
          CROP_FIXTURES.psd.fileName
        );

        const bitmapPromise = page.waitForResponse((response) => {
          const request = response.request();
          return (
            request.method() === 'POST' &&
            response.url().includes('/api/crop/bitmap')
          );
        });

        await page.getByTestId('dropzone-crop-file-btn').first().click();
        await expect(page.getByTestId('crop-dialog')).toBeVisible();

        const bitmapResponse = await bitmapPromise;
        await expect(page.getByTestId('crop-width-input')).toBeVisible({
          timeout: 60_000,
        });

        return { idx, status: bitmapResponse.status(), ok: bitmapResponse.ok() };
      })
    );

    for (const { idx, status, ok } of bitmapResponses) {
      expect(ok, `context ${idx} got status ${status}`).toBe(true);
      expect(status).toBe(200);
    }
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});
