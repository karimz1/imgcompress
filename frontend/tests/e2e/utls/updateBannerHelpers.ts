import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { maxSatisfying, valid } from 'semver';
import { LatestReleasePayload } from './updateBannerTestData';

const latestVersionRoute = '**/repos/karimz1/imgcompress/releases/latest';
const releaseNotesPattern =
  /##\s+v?(\d+\.\d+\.\d+(?:\.\d+)?)\s+[—-]\s+\d{4}-\d{2}-\d{2}/g;

const getMaxSemver = (versions: string[]): string | null => {
  const normalized = versions
    .map((version) => valid(version))
    .filter((version): version is string => Boolean(version));
  if (normalized.length === 0) return null;
  return maxSatisfying(normalized, "*");
};

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
  const text = await response.text();
  const matches = Array.from(text.matchAll(releaseNotesPattern), (match) => match[1]);
  return getMaxSemver(matches) ?? '0.0.0';
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

export function getReleaseNotesLinkLocator(page: Page): Locator {
  return page.locator('footer').getByRole('link', { name: 'Release Notes' });
}

export async function waitForFooterVersionAsync(page: Page): Promise<void> {
  await expect(getFooterVersionLocator(page)).toBeVisible({ timeout: 5000 });
}
