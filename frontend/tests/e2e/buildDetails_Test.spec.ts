import { test, expect } from '@playwright/test';

const commit = '9db1e75049562d315e06eec95252c0e515b8c52a';
const metadata = {
  schemaVersion: 1, version: '0.9.0', baseVersion: '0.9.0', channel: 'nightly',
  commit, builtAt: '2026-10-09T11:00:00.000Z',
  buildId: '0.9.0-nightly.20261009110000+9db1e75', ref: 'refs/heads/main',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('imgcompress_locale', 'en'));
  await page.route('**/release-notes.md', (route) => route.fulfill({
    contentType: 'text/markdown', body: '## v0.9.0 — 2026-08-22\n- Stable release',
  }));
  await page.route('**/repos/karimz1/imgcompress/releases/latest', (route) => route.fulfill({
    json: { tag_name: 'release_0.9.0' },
  }));
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`nightly details fit ${viewport.width}px and link the installed source`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/build-info.json', (route) => route.fulfill({ json: metadata }));
    await page.goto('/');
    const trigger = page.getByTestId('build-details-trigger');
    await expect(trigger).toContainText('Version 0.9.0');
    await expect(trigger).toContainText('Nightly');
    await expect(trigger).toContainText('9db1e75');
    await trigger.click();
    const dialog = page.getByTestId('build-details-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(metadata.buildId);
    await expect(dialog.getByRole('link', { name: '9db1e75' })).toHaveAttribute('href', `https://github.com/karimz1/imgcompress/commit/${commit}`);
    await dialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}

test('an RC shows its actual version instead of the previous stable notes', async ({ page }) => {
  await page.route('**/build-info.json', (route) => route.fulfill({ json: {
    ...metadata, version: '0.10.0-rc.1', channel: 'rc', buildId: '0.10.0-rc.1-rc.20261009110000+9db1e75',
  } }));
  await page.goto('/');
  await expect(page.getByTestId('build-details-trigger')).toContainText('Version 0.10.0-rc.1');
  await expect(page.getByTestId('build-details-trigger')).toContainText('Release candidate');
  await expect(page.getByText('Update available', { exact: false })).not.toBeVisible();
});

test('missing metadata retains the version and release-notes link', async ({ page }) => {
  await page.route('**/build-info.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('footer').getByText('Version 0.9.0', { exact: true })).toBeVisible();
  await expect(page.getByTestId('build-details-trigger')).not.toBeVisible();
  await expect(page.locator('footer').getByRole('link', { name: 'Release Notes' })).toBeVisible();
});

test('copy details includes the installed build and its source link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/build-info.json', (route) => route.fulfill({ json: metadata }));
  await page.goto('/');
  await page.getByTestId('build-details-trigger').click();
  await page.getByRole('button', { name: 'Copy details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(metadata.buildId);
  expect(copied).toContain(metadata.builtAt);
  expect(copied).toContain(`https://github.com/karimz1/imgcompress/commit/${commit}`);
});

test('a stable release keeps the quiet version label', async ({ page }) => {
  await page.route('**/build-info.json', (route) => route.fulfill({ json: {
    ...metadata, channel: 'stable', buildId: '0.9.0-stable.20261009110000+9db1e75', ref: 'release_0.9.0',
  } }));
  await page.goto('/');
  const trigger = page.getByTestId('build-details-trigger');
  await expect(trigger).toContainText('Version 0.9.0');
  await expect(trigger).not.toContainText('9db1e75');
  await expect(trigger).not.toContainText('Stable');
  await trigger.click();
  await expect(page.getByTestId('build-details-dialog')).toContainText('Stable');
});

test('a local build without a commit shows no source link', async ({ page }) => {
  await page.route('**/build-info.json', (route) => route.fulfill({ json: {
    ...metadata, channel: 'local', commit: null, ref: null, buildId: '0.9.0-local.20261009110000',
  } }));
  await page.goto('/');
  await page.getByTestId('build-details-trigger').click();
  const dialog = page.getByTestId('build-details-dialog');
  await expect(dialog).toContainText('Local build');
  await expect(dialog.getByRole('link')).toHaveCount(0);
});

test('without notes or metadata the version row stays hidden', async ({ page }) => {
  await page.route('**/release-notes.md', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/build-info.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('footer').getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(page.locator('footer').getByText(/Version/)).toHaveCount(0);
  await expect(page.locator('footer').getByRole('link', { name: 'Release Notes' })).toHaveCount(0);
});
