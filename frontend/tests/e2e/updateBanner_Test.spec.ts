import { test, expect } from '@playwright/test';

test.describe('Update Banner', () => {
  test('should display update banner when newer version is available', async ({ page }) => {
    // Mock the latest version API to return a newer version
    await page.route('https://imgcompress.karimzouine.com/api/latest-version.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 'v99.99.99', // Much newer version to trigger update banner
          release_date: '2026-12-31',
          changelog: ['Test update'],
          url: 'https://github.com/karimz1/imgcompress/releases/tag/v99.99.99',
        }),
      });
    });

    await page.goto('/');

    // Wait for the version check to complete
    await page.waitForTimeout(1000);

    // Check that the update banner is visible
    const updateBanner = page.locator('text=Update available');
    await expect(updateBanner).toBeVisible();

    // Verify it shows the correct version
    await expect(page.locator('text=v99.99.99')).toBeVisible();

    // Verify "What's new" link is present and has correct href
    const whatsNewLink = page.locator('a:has-text("What\'s new")');
    await expect(whatsNewLink).toBeVisible();
    await expect(whatsNewLink).toHaveAttribute(
      'href',
      'https://imgcompress.karimzouine.com/release-notes/'
    );
  });

  test('should NOT display update banner when current version is latest', async ({ page }) => {
    // Get the current version from release-notes.md first
    const releaseNotesResponse = await page.request.get('http://localhost:3000/release-notes.md');
    const releaseNotesText = await releaseNotesResponse.text();
    const versionMatch = releaseNotesText.match(/##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}/);
    const currentVersion = versionMatch ? versionMatch[1] : '0.0.0';

    // Mock the API to return the same version
    await page.route('https://imgcompress.karimzouine.com/api/latest-version.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: `v${currentVersion}`,
          release_date: '2026-01-04',
          changelog: ['No new updates'],
          url: `https://github.com/karimz1/imgcompress/releases/tag/v${currentVersion}`,
        }),
      });
    });

    await page.goto('/');

    // Wait for the version check to complete
    await page.waitForTimeout(1000);

    // Check that the update banner is NOT visible
    const updateBanner = page.locator('text=Update available');
    await expect(updateBanner).not.toBeVisible();
  });

  test('should display current version in footer', async ({ page }) => {
    await page.goto('/');

    // Wait for version to load
    await page.waitForTimeout(1000);

    // Check that version is displayed in footer
    const versionText = page.locator('footer').locator('text=/Version \\d+\\.\\d+/');
    await expect(versionText).toBeVisible();
  });

  test('should display "Release Notes" link in footer', async ({ page }) => {
    await page.goto('/');

    // Check that Release Notes link exists in footer
    const releaseNotesLink = page.locator('footer').locator('a:has-text("Release Notes")');
    await expect(releaseNotesLink).toBeVisible();
    await expect(releaseNotesLink).toHaveAttribute(
      'href',
      'https://imgcompress.karimzouine.com/release-notes/'
    );
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Mock the API to fail
    await page.route('https://imgcompress.karimzouine.com/api/latest-version.json', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // Wait for the version check to complete
    await page.waitForTimeout(1000);

    // Page should still load and show current version
    const versionText = page.locator('footer').locator('text=/Version \\d+\\.\\d+/');
    await expect(versionText).toBeVisible();

    // Update banner should not appear
    const updateBanner = page.locator('text=Update available');
    await expect(updateBanner).not.toBeVisible();
  });
});
