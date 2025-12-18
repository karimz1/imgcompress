import { expect, test } from '@playwright/test';
import {
    uploadFilesToDropzoneAsync,
    assertFilesPresentInDropzoneAsync,
    clickConversionButtonAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

test('should display detailed error modal when backend returns 500 with stacktrace', async ({ page }) => {
    await page.goto('/');

    // Mock the API response to simulate a backend crash
    await page.route('/api/compress', async (route) => {
        await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
                error: 'ValueError',
                message: 'Simulated Backend Crash',
                stacktrace: 'Traceback (most recent call last):\n  File "server.py", line 100, in <module>\n    raise ValueError("Simulated Backend Crash")',
            }),
        });
    });

    const pdfFile = new ImageFileDto('imgcompress_screenshot.pdf');

    await uploadFilesToDropzoneAsync(page, [pdfFile]);
    await assertFilesPresentInDropzoneAsync(page, [pdfFile]);

    await clickConversionButtonAsync(page);

    // Assert Error Modal appears
    const errorModal = page.locator('div[role="dialog"]');
    await expect(errorModal).toBeVisible();

    // Assert Error Title
    await expect(errorModal.getByText('Error Occurred')).toBeVisible();

    // Assert Error Message
    await expect(errorModal.getByText('Simulated Backend Crash')).toBeVisible();

    // Assert Stacktrace (details) is visible
    // The details are inside a <pre> tag in the modal
    const details = errorModal.locator('pre');
    await expect(details).toBeVisible();
    await expect(details).toContainText('Traceback (most recent call last)');
    await expect(details).toContainText('raise ValueError("Simulated Backend Crash")');
});
