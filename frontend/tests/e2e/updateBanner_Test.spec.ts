import { test, expect } from '@playwright/test';
import { UpdateBannerTestData } from './utls/updateBannerTestData';
import {
  getCurrentVersionFromReleaseNotesAsync,
  getReleaseNotesLinkLocator,
  getUpdateBannerLocator,
  getWhatsNewLinkLocator,
  mockLatestVersionErrorAsync,
  mockLatestVersionResponseAsync,
  waitForFooterVersionAsync,
} from './utls/updateBannerHelpers';

test.describe('Update Banner', () => {
  const bannerScenarios = [
    {
      name: 'shows update banner when newer version is available',
      buildPayload: async () => UpdateBannerTestData.newerVersion,
      expectsBanner: true,
      expectedVersion: UpdateBannerTestData.newerVersion.tag_name,
    },
    {
      name: 'hides update banner when current version is latest',
      buildPayload: async (request: Parameters<typeof getCurrentVersionFromReleaseNotesAsync>[0]) =>
        UpdateBannerTestData.createCurrentVersionPayload(
          await getCurrentVersionFromReleaseNotesAsync(request)
        ),
      expectsBanner: false,
      expectedVersion: null,
    },
  ];

  for (const scenario of bannerScenarios) {
    test(scenario.name, async ({ page, request }) => {
      const payload = await scenario.buildPayload(request);
      await mockLatestVersionResponseAsync(page, payload);
      await page.goto('/');
      await waitForFooterVersionAsync(page);

      const updateBanner = getUpdateBannerLocator(page);
      if (scenario.expectsBanner) {
        await expect(updateBanner).toBeVisible();
        await expect(page.getByText(scenario.expectedVersion ?? '')).toBeVisible();
        const whatsNewLink = getWhatsNewLinkLocator(page);
        await expect(whatsNewLink).toBeVisible();
        await expect(whatsNewLink).toHaveAttribute('href', UpdateBannerTestData.releaseNotesUrl);
      } else {
        await expect(updateBanner).not.toBeVisible();
      }
    });
  }

  test('shows current version in footer', async ({ page }) => {
    await page.goto('/');
    await waitForFooterVersionAsync(page);
  });

  test('shows release notes link in footer', async ({ page }) => {
    await page.goto('/');
    await waitForFooterVersionAsync(page);
    const releaseNotesLink = getReleaseNotesLinkLocator(page);
    await expect(releaseNotesLink).toBeVisible();
    await expect(releaseNotesLink).toHaveAttribute(
      'href',
      UpdateBannerTestData.releaseNotesUrl
    );
  });

  test('handles API error gracefully', async ({ page }) => {
    await mockLatestVersionErrorAsync(page);
    await page.goto('/');
    await waitForFooterVersionAsync(page);
    await expect(getUpdateBannerLocator(page)).not.toBeVisible();
  });
});
