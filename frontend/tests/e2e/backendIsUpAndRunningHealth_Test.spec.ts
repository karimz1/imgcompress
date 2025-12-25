import { test, expect } from '@playwright/test';
import { setOutputFormatAsync } from './utls/helpers';

test('Test Backend Health - Expect Status Banner is not visible', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, "JPEG");
  
  await expect(page.locator('[data-testid="backend-down-status-banner"]')).toBeHidden();
});
