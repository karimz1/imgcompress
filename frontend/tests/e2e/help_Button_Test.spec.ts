import { test, expect } from '@playwright/test';

test('How to Use button should have the correct documentation link', async ({ page }) => {
  await page.goto('/');

  const helpButton = page.getByTestId('how-to-use-btn');
  
  await expect(helpButton).toBeVisible();
  
  await expect(helpButton).toContainText('How to Use');
  
  const expectedUrl = 'https://karimz1.github.io/imgcompress/web-ui.html';
  await expect(helpButton).toHaveAttribute('href', expectedUrl);
  
  await expect(helpButton).toHaveAttribute('target', '_blank');
});
