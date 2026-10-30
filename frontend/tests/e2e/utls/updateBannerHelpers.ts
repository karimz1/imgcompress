import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { coerce, valid } from 'semver';
import { LatestReleasePayload } from './updateBannerTestData';

const latestVersionRoute = '**/repos/karimz1/imgcompress/releases/latest';
// Same rule as the app: the first entry is the installed version (an RC image
// has its own entry on top of the stable archive).
const releaseNotesPattern =
  /^##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}\s*$/m;

export async function mockLatestVersionResponseAsync(
  page: Page,
  payload: LatestReleasePayload
): Promise<void> {
  await page.route(latestVersionRoute, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

export async function mockLatestVersionErrorAsync(page: Page): Promise<void> {
  await page.route(latestVersionRoute, async (route) => {
    await route.abort('failed');
  });
}

export async function getCurrentVersionFromReleaseNotesAsync(
  request: APIRequestContext
): Promise<string> {
  const response = await request.get('/release-notes.md');
  expect(response.ok()).toBeTruthy();
  const version = (await response.text()).match(releaseNotesPattern)?.[1];
  if (!version) return '0.0.0';
  return valid(version) ?? coerce(version)?.version ?? '0.0.0';
}

export function getUpdateBannerLocator(page: Page): Locator {
  return page.getByText('Update available', { exact: false });
}

export function getWhatsNewLinkLocator(page: Page): Locator {
  return page.getByRole('link', { name: /What's new/i });
}

export function getFooterVersionLocator(page: Page): Locator {
  return page.locator('footer').getByText(/Version \d+\.\d+/);
}

export async function mockReleaseNotesAsync(page: Page, markdown: string): Promise<void> {
  await page.route('**/release-notes.md', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/markdown', body: markdown });
  });
}

export function getReleaseNotesLinkLocator(page: Page): Locator {
  return page.locator('footer').getByRole('link', { name: 'Release Notes' });
}

export async function waitForFooterVersionAsync(page: Page): Promise<void> {
  await expect(getFooterVersionLocator(page)).toBeVisible({ timeout: 5000 });
}
