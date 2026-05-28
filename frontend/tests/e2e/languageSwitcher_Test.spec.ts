import { test, expect } from '@playwright/test';

test('language switcher should apply Hungarian translation to the UI', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('imgcompress_locale');
  });
  await page.goto('/');

  await expect(page.getByText('Output Format', { exact: true })).toBeVisible();

  const trigger = page.getByRole('combobox', { name: 'Switch language' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  await page.getByText('Magyar', { exact: true }).click();

  await expect(page.getByText('Kimeneti formátum', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});
