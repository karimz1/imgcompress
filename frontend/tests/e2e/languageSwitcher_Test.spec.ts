import { test, expect } from '@playwright/test';

test('language switcher should apply Hungarian translation to the UI', async ({ page }) => {
  await page.goto('/');

  const subtitle = page.getByTestId('page-subtitle');
  await expect(subtitle).toContainText('An Image Compression Tool');

  const trigger = page.getByRole('button', { name: 'Select language' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  await page.getByText('Magyar').click();

  await expect(subtitle).toContainText('Képtömörítő Eszköz');
});
