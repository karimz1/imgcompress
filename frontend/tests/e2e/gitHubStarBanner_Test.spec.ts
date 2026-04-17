import { test, expect, Page } from '@playwright/test';
import {
  uploadFilesToDropzoneAsync,
  clickConversionButtonAsync,
  assertCloseDrawerBtnClickAsync,
  setOutputFormatAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

const DISMISSED_KEY = 'imgcompress_github_star_dismissed';
const CONVERSIONS_KEY = 'imgcompress_conversion_count';

const fileA = new ImageFileDto('pexels-pealdesign-28594392.jpg');
const fileB = new ImageFileDto('pexels-willianjusten-29944187.jpg');

async function compressFileAsync(page: Page, file: ImageFileDto): Promise<void> {
  await setOutputFormatAsync(page, 'JPEG');
  await uploadFilesToDropzoneAsync(page, [file]);
  await clickConversionButtonAsync(page);
}

test.describe('GitHub Star Banner', () => {
  test('is not shown on the first compression', async ({ page }) => {
    await page.goto('/');
    await compressFileAsync(page, fileA);

    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();
  });

  test('is shown on the second compression in the same session using a different file', async ({ page }) => {
    await page.goto('/');
    await compressFileAsync(page, fileA);
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();

    await assertCloseDrawerBtnClickAsync(page);

    await compressFileAsync(page, fileB);
    await expect(page.getByTestId('github-star-banner')).toBeVisible();
  });

  test('is shown on the second session with the same file', async ({ page }) => {
    await page.goto('/');
    await compressFileAsync(page, fileA);
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();

    // Simulate a new session by clearing sessionStorage (same as closing and reopening the tab)
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/');

    await compressFileAsync(page, fileA);
    await expect(page.getByTestId('github-star-banner')).toBeVisible();
  });

  test('opening and closing the drawer multiple times does not trigger the banner early', async ({ page }) => {
    await page.goto('/');
    await compressFileAsync(page, fileA);
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();

    await assertCloseDrawerBtnClickAsync(page);
    await page.getByRole('button', { name: /Show Compressed/i }).click();
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();

    await assertCloseDrawerBtnClickAsync(page);
    await page.getByRole('button', { name: /Show Compressed/i }).click();
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();
  });

  test('dismissing hides the banner permanently across page reloads', async ({ page }) => {
    await page.goto('/');
    // Pre-seed count=1 so the next compression pushes it to 2 and triggers the banner
    await page.evaluate((key) => localStorage.setItem(key, '1'), CONVERSIONS_KEY);

    await compressFileAsync(page, fileA);
    const banner = page.getByTestId('github-star-banner');
    await expect(banner).toBeVisible();

    await page.getByTestId('github-star-banner-dismiss-btn').click();
    await expect(banner).not.toBeVisible();

    // Reload and compress again — banner must stay hidden
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/');
    await compressFileAsync(page, fileA);
    await expect(page.getByTestId('github-star-banner')).not.toBeVisible();

    const dismissed = await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY);
    expect(dismissed).toBe('1');
  });
});
