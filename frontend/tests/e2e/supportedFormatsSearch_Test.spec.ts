import { test, expect, Locator } from '@playwright/test';
import { waitForSupportedFormatsCountAsync } from './utls/helpers';

async function isInContainerView(
  container: Locator,
  item: Locator
): Promise<boolean> {
  const containerHandle = await container.elementHandle();
  if (!containerHandle) {
    throw new Error('supported formats list container not found');
  }

  return item.evaluate((el, containerEl) => {
    if (!containerEl) {
      return false;
    }
    const containerRect = containerEl.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    return itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;
  }, containerHandle);
}

test('supported formats search highlights and scrolls to matches', async ({ page }) => {
  await page.goto('/');

  const supportedFormatsBtn = page.locator('[data-testid="supported-formats-btn"]');
  await waitForSupportedFormatsCountAsync(page);
  await supportedFormatsBtn.click();

  const dialog = page.locator('[data-testid="supported-formats-dialog"]');
  await expect(dialog).toBeVisible();

  const searchInput = page.locator('[data-testid="supported-formats-search"]');
  const list = page.locator('[data-testid="supported-formats-list"]');

  await searchInput.fill('png');
  const pngChip = page.locator('[data-testid="supported-format-png"]');
  await expect(pngChip).toBeVisible();
  await expect(pngChip).toHaveAttribute('data-search-match', 'true');

  const tiffChip = page.locator('[data-testid="supported-format-tiff"]');
  const wasInView = await isInContainerView(list, tiffChip);

  await searchInput.fill('tiff');
  await expect(tiffChip).toBeVisible();
  await expect(tiffChip).toHaveAttribute('data-search-match', 'true');
  await expect.poll(() => isInContainerView(list, tiffChip)).toBe(true);

  if (!wasInView) {
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  }

  await dialog.locator('[data-testid="dialog-close"]').click();
  await expect(dialog).toBeHidden();

  await supportedFormatsBtn.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
