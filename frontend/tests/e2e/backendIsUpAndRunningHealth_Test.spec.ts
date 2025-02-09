import { test, expect } from '@playwright/test';

test('Test Backend Health - Expect Status Banner is not visible', async ({ page }) => {
  await page.goto('/');

  // Wait up to 30 seconds for the banner to be hidden or not present.
  await expect(page.locator('[data-testid="backend-down-status-banner"]')).toBeHidden();
});
