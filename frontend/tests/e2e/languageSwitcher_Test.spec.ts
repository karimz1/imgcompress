import { test, expect } from '@playwright/test';

test('language switcher should apply Hungarian translation to the UI', async ({ page }) => {
  await page.route('**/config/runtime.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ DISABLE_LOGO: 'true' }),
    })
  );

  await page.goto('/');

  const subtitle = page.getByTestId('page-subtitle');
  await expect(subtitle).toContainText('An Image Compression Tool');

  const trigger = page.getByRole('combobox', { name: 'Switch language' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  await page.getByText('Magyar').click();

  await expect(subtitle).toContainText('Képtömörítő');
});
