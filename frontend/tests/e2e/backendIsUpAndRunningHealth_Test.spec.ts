import { test, expect } from '@playwright';

test('Test Backend Health - Expect Status Banner is not visible', async ({ page }) => {
  await page.goto('/');

  
  await expect(page.locator('[data-testid="backend-down-status-banner"]')).toBeHidden();
});
