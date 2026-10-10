import { test, expect } from '@playwright/test';
import { UpdateBannerTestData } from './utls/updateBannerTestData';
import {
  getFooterVersionLocator,
  getUpdateBannerLocator,
  mockLatestVersionResponseAsync,
  mockReleaseNotesAsync,
} from './utls/updateBannerHelpers';

// What the release workflow writes into an RC image: the RC entry on top of the
// stable archive from main.
const rcReleaseNotes = [
  '## v0.10.0-rc.1 — 2026-10-09',
  '',
  '### What\'s Changed',
  '* Release drafts from tags by @karimz1 in https://github.com/karimz1/imgcompress/pull/914',
  '',
  '## v0.9.0 — 2026-08-22',
  '',
  '- PDF quality presets.',
  '',
].join('\n');

test.describe('Update Banner for release candidates', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('imgcompress_locale', 'en'));
    await mockReleaseNotesAsync(page, rcReleaseNotes);
  });

  test('an RC shows its own version and no update for the older stable release', async ({ page }) => {
    await mockLatestVersionResponseAsync(page, UpdateBannerTestData.createLatestReleasePayload('0.9.0'));
    await page.goto('/');
    await expect(getFooterVersionLocator(page)).toHaveText('Version 0.10.0-rc.1');
    await expect(getUpdateBannerLocator(page)).not.toBeVisible();
  });

  test('an RC offers the stable release once it is published', async ({ page }) => {
    await mockLatestVersionResponseAsync(page, UpdateBannerTestData.createLatestReleasePayload('0.10.0'));
    await page.goto('/');
    await expect(getFooterVersionLocator(page)).toHaveText('Version 0.10.0-rc.1');
    await expect(getUpdateBannerLocator(page)).toBeVisible();
    await expect(getUpdateBannerLocator(page)).toContainText('0.10.0');
  });

  test('the first entry is the installed version, not the highest one in the file', async ({ page }) => {
    await mockReleaseNotesAsync(page, '## v0.9.1 — 2026-10-09\n\n- Backport fix.\n\n## v0.10.0 — 2026-09-30\n\n- Newer release.\n');
    await mockLatestVersionResponseAsync(page, UpdateBannerTestData.createLatestReleasePayload('0.10.0'));
    await page.goto('/');
    await expect(getFooterVersionLocator(page)).toHaveText('Version 0.9.1');
    await expect(getUpdateBannerLocator(page)).toContainText('0.10.0');
  });
});
