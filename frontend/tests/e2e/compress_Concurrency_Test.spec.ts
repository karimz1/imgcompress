import { test, expect, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import {
    setOutputFormatAsync,
    uploadFilesToDropzoneAsync,
    assertFilesPresentInDropzoneAsync,
    clickConversionButtonAsync,
    assertDownloadLinksAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

/**
 * E2E: concurrent compression across multiple simultaneous browser sessions.
 *
 * Self-hosted instances can have several users hitting the same backend at
 * the same time. This spec proves the compression pipeline does not collide,
 * stall, or cross-contaminate output between simultaneous sessions. Each
 * browser context represents an independent user; all three must finish
 * compression and receive their own download link.
 */

const PARALLEL_USERS = 3;
const FIXTURE = new ImageFileDto('pexels-pealdesign-28594392.jpg');

test('compression pipeline serves N simultaneous users without collisions', async ({ browser }) => {
    const contexts: BrowserContext[] = await Promise.all(
        Array.from({ length: PARALLEL_USERS }, () => browser.newContext())
    );

    try {
        const results = await Promise.all(
            contexts.map(async (ctx, idx) => {
                const page: Page = await ctx.newPage();
                await page.goto('/');

                await setOutputFormatAsync(page, 'JPEG');
                await uploadFilesToDropzoneAsync(page, [FIXTURE]);
                await assertFilesPresentInDropzoneAsync(page, [FIXTURE]);

                // Capture the /api/compress response so we can assert each
                // session got its own dest_folder (no cross-contamination).
                const compressResponsePromise = page.waitForResponse((response) => {
                    const request = response.request();
                    return (
                        request.method() === 'POST' &&
                        response.url().includes('/api/compress')
                    );
                });

                await clickConversionButtonAsync(page);

                const compressResponse = await compressResponsePromise;
                expect(compressResponse.ok(), `user ${idx} /api/compress not OK`).toBeTruthy();
                const body = await compressResponse.json();
                expect(Array.isArray(body.converted_files)).toBeTruthy();
                expect(body.converted_files.length).toBeGreaterThan(0);
                expect(typeof body.dest_folder).toBe('string');
                expect(body.dest_folder.length).toBeGreaterThan(0);

                // The drawer (with download links) opens once converted_files state lands.
                await expect(page.getByTestId('compressed-files-drawer-close-btn')).toBeVisible();
                const links = await assertDownloadLinksAsync(page, [FIXTURE]);
                await expect(links).toHaveCount(1);

                return {
                    idx,
                    destFolder: body.dest_folder as string,
                    convertedFiles: body.converted_files as string[],
                };
            })
        );

        // Every user finished with a working download link.
        expect(results).toHaveLength(PARALLEL_USERS);

        // No two users shared the same dest_folder. If they did, the temp-
        // storage isolation between sessions is broken and one user could
        // overwrite another's output.
        const destFolders = results.map((r) => r.destFolder);
        const uniqueDestFolders = new Set(destFolders);
        expect(uniqueDestFolders.size, `dest_folder collision: ${destFolders.join(', ')}`)
            .toBe(PARALLEL_USERS);

        // Sanity: every session's converted file names share the source basename.
        const expectedBase = path.basename(FIXTURE.fileName, path.extname(FIXTURE.fileName));
        for (const r of results) {
            const baseNames = r.convertedFiles.map((f) =>
                path.basename(f, path.extname(f))
            );
            expect(
                baseNames.some((b) => b === expectedBase),
                `user ${r.idx} returned unexpected files: ${r.convertedFiles.join(', ')}`
            ).toBeTruthy();
        }
    } finally {
        await Promise.all(contexts.map((c) => c.close()));
    }
});
