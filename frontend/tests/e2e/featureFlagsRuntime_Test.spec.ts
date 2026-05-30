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

    // Visual proof of the rendered UI for this flag combination.
    // Small JPEG so artifact size stays low even when all 3 matrix runs upload.
    const label = `logo-${logoDisabled ? 'disabled' : 'enabled'}__storage-${storageDisabled ? 'disabled' : 'enabled'}`;
    const bannerText =
        `DISABLE_LOGO=${logoDisabled} (logo ${logoDisabled ? 'HIDDEN' : 'SHOWN'})  •  ` +
        `DISABLE_STORAGE_MANAGEMENT=${storageDisabled} (storage btn ${storageDisabled ? 'HIDDEN' : 'SHOWN'})`;

    // Inject a top-left banner so the screenshot self-documents which
    // feature-flag combination it was captured under. Removed after capture
    // so it never affects assertions.
    await page.evaluate((text) => {
        const banner = document.createElement('div');
        banner.id = '__feature-flags-banner__';
        banner.textContent = text;
        banner.style.cssText = [
            'position: fixed',
            'top: 12px',
            'left: 12px',
            'z-index: 2147483647',
            'padding: 10px 14px',
            'max-width: 90vw',
            'font: bold 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
            'color: #fff',
            'background: rgba(0, 0, 0, 0.85)',
            'border: 1px solid rgba(255, 255, 255, 0.45)',
            'border-radius: 8px',
            'box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45)',
            'pointer-events: none',
            'white-space: nowrap',
        ].join(';');
        document.body.appendChild(banner);
    }, bannerText);

    const screenshotPath = test.info().outputPath(`featureFlags-${label}.jpg`);
    await page.screenshot({
        path: screenshotPath,
        type: 'jpeg',
        quality: 65,
        fullPage: true,
    });
    await test.info().attach(`feature-flags-${label}`, {
        path: screenshotPath,
        contentType: 'image/jpeg',
    });

    await page.evaluate(() => {
        document.getElementById('__feature-flags-banner__')?.remove();
    });
});
