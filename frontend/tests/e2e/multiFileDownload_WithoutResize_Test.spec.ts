import { test } from '@playwright/test';
import {
    assertFilesPresentInDropzoneAsync,
    clickConversionButtonAsync,
    clickDownloadZipButtonAndGetUrlAsync,
    assertZipContentAsync,
    assertDownloadLinksAsync,
    uploadFilesToDropzoneAsync,
    AssertDownloadsIsEqualsToSourceImageWidth,
} from './utls/helpers';

import { ImageFileDto } from './utls/ImageFileDto';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';

test('should upload two files, verify individual downloads by clicking and ZIP download availability, without resize-width', async ({ page }) => {
    await page.goto('/');
    const imageFileNames: ImageFileDto[] = [
        new ImageFileDto("pexels-pealdesign-28594392.jpg", 3486),
        new ImageFileDto("pexels-willianjusten-29944187.jpg", 3648),
        new ImageFileDto("IMG_0935.heic", 4284),
        new ImageFileDto("vecteezy_new-update-logo-template-illustration_5412356-0.eps", 4000)
    ];

    await uploadFilesToDropzoneAsync(page, imageFileNames);

    await assertFilesPresentInDropzoneAsync(page, imageFileNames);

    await clickConversionButtonAsync(page);

    const zipDownloadPath: string = await clickDownloadZipButtonAndGetUrlAsync(page);
    await assertZipContentAsync(zipDownloadPath, imageFileNames);

    
    const fileItemLocator = await assertDownloadLinksAsync(page, imageFileNames);
    const downloads = await downloadFilesAndGetMetadataAsync(page, fileItemLocator);
    
    AssertDownloadsIsEqualsToSourceImageWidth(downloads, imageFileNames);
});

