import { test, expect } from '@playwright/test';
import { clickConversionButtonAsync as clickConversionButtonAsync, setOutputFormatAsync } from './utls/helpers';

test('Test_TryToConvertWithoutUpload_ExpectErrorMessageRendered', async ({ page }) => {
  await page.goto('/');
  await setOutputFormatAsync(page, "JPEG");
  await clickConversionButtonAsync(page);

  
  const errorMessage = await page.locator('[data-testid="error-message-holder"]').innerText();
  expect(errorMessage).toContain("Please drop or select some files first.");
});
