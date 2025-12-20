import { test, expect } from '@playwright';
import { clickConversionButtonAsync as clickConversionButtonAsync } from './utls/helpers';

test('Test_TryToConvertWithoutUpload_ExpectErrorMessageRendered', async ({ page }) => {
  await page.goto('/');
  await clickConversionButtonAsync(page);

  
  const errorMessage = await page.locator('[data-testid="error-message-holder"]').innerText();
  expect(errorMessage).toContain("Please drop or select some files first.");
});
