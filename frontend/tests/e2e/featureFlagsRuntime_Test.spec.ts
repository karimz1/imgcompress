import { test, expect } from '@playwright/test';

const LOGO_ALT = 'ImgCompress - Image Compression Tool';
const FALLBACK_TAGLINE = 'An Image Compression Tool';
const STORAGE_BTN_SELECTOR = '[data-testid="storage-management-btn"]';

test('feature flags served by the running container match the rendered UI', async ({ page, request }) => {
    const configResponse = await request.get('/config/runtime.json');
    expect(configResponse.ok()).toBeTruthy();
    const config = await configResponse.json();

    const logoDisabled = config.DISABLE_LOGO === 'true';
    const storageDisabled = config.DISABLE_STORAGE_MANAGEMENT === 'true';

    test.info().annotations.push({
        type: 'runtime-config',
        description: `DISABLE_LOGO=${logoDisabled} DISABLE_STORAGE_MANAGEMENT=${storageDisabled}`,
    });

    await page.goto('/');

    const logo = page.getByAltText(LOGO_ALT);
    const fallbackTagline = page.getByText(FALLBACK_TAGLINE, { exact: true });
    await expect(logo.or(fallbackTagline).first()).toBeVisible({ timeout: 60_000 });

    if (logoDisabled) {
        await expect(fallbackTagline).toBeVisible();
        await expect(logo).toHaveCount(0);
    } else {
        await expect(logo).toBeVisible();
        await expect(fallbackTagline).toHaveCount(0);
    }

    const storageBtn = page.locator(STORAGE_BTN_SELECTOR);
    if (storageDisabled) {
        await expect(storageBtn).toHaveCount(0);
    } else {
        await expect(storageBtn).toBeVisible();
    }
});
