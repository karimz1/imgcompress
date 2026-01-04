import path from 'path';
import { promises as fsPromises } from 'fs';
import {expect, Page, Locator, APIRequestContext} from '@playwright/test';
import AdmZip, { IZipEntry } from 'adm-zip';
import sharp from 'sharp';
import { ImageFileDto } from './ImageFileDto';
import { DownloadType } from './DownloadType';

const selectors = {
  zipDownloadButton: '[data-testid="drawer-download-all-as-zip-btn"]',
  resizeWidthSwitch: '[data-testid="resize-width-switch"]',
  resizeWidthInput: '[data-testid="resize-width-input"]',
  dropzoneInput: '[data-testid="dropzone-input"]',
  dropzoneAddedFile: '[data-testid="dropzone-added-file"]',
  conversionButton: '[data-testid="convert-btn"]',
  downloadLink: '[data-testid="drawer-uploaded-file-item-link"]',
  removeItemFromDropzoneBtn: '[data-testid="dropzone-remove-file-btn"]',
  targetSizeMBInput: '[data-testid="targetSizeMBInput"]',
  dropzoneAddedFileWrapper: '[data-testid="dropzone-added-file-wrapper"]',
  outputFormatSelect: '#outputFormat',
  storageManagementButton: '[data-testid="storage-management-btn"]',
  storageManagementDownloadLink: '[data-testid="storage-management-file-download-link"]',
  rembgSwitch: '[data-testid="rembg-switch"]',
  supportedFormatsBtn: '[data-testid="supported-formats-btn"]',
  compressionModeQualityBtn: '[data-testid="compression-mode-quality-btn"]',
  compressionModeSizeBtn: '[data-testid="compression-mode-size-btn"]'
};

export async function clearStorageManagerAsync(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/force_cleanup');
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.status).toBe('ok');

  // Poll until storage is empty (IO cleanup can take time, especially on github actions, my pipeline).
    await expect
        .poll(async () => {
            const totalCount = await getStorageManagerFileCountAsync(request);
            console.log("Polling file count:", totalCount); // Log the count each time
            return totalCount;
        }, {
            timeout: 30_000,  // Wait for a max of 30 seconds
            intervals: [500], // Check every 500 ms
        })
        .toBe(0);  // Expect the storage to be empty

}

export async function assertStorageManagerFileCountAsync(
  request: APIRequestContext,
  expectedCount: number
): Promise<void> {
  const totalCount = await getStorageManagerFileCountAsync(request);
  expect(totalCount).toBe(expectedCount);
}

export async function getStorageManagerFileCountAsync(request: APIRequestContext): Promise<number> {
  const storageState = await request.get('/api/container_files');
  expect(storageState.ok()).toBeTruthy();
  const storagePayload = await storageState.json();
  return storagePayload.total_count;
}

export async function assertCloseDrawerBtnClickAsync(page: Page) {
  const compressedFilesDrawerCloseButton = page.getByTestId('compressed-files-drawer-close-btn');
  await expect(compressedFilesDrawerCloseButton).toBeVisible();
  await compressedFilesDrawerCloseButton.click();
  await expect(compressedFilesDrawerCloseButton).toBeHidden();
}

export async function openStorageManagerAsync(page: Page): Promise<void> {
  const storageManagementButton = page.locator(selectors.storageManagementButton);
  await expect(storageManagementButton).toBeVisible();
  await storageManagementButton.click();
}

export function getStorageManagementDownloadLinkLocator(page: Page, expectedFileName: string): Locator {
  return page
    .locator(selectors.storageManagementDownloadLink)
    .filter({ hasText: expectedFileName });
}

export async function removeImageFileFromDropzoneAsync(page: Page, imageFile: ImageFileDto): Promise<void> {
    const fileWrappers = page.locator(selectors.dropzoneAddedFileWrapper);
    const count = await fileWrappers.count();

    for (let i = 0; i < count; i++) {
        const wrapper = fileWrappers.nth(i);
        const fileNameElement = wrapper.locator(selectors.dropzoneAddedFile);
        const fileNameText = await fileNameElement.textContent();

        if (fileNameText && fileNameText.trim().toLowerCase() === imageFile.fileName.trim().toLowerCase()) {
            const removeButton = wrapper.locator(selectors.removeItemFromDropzoneBtn);
            await removeButton.click();

            // Retry logic to check if file has been removed (with delay)
            const newCount = await fileWrappers.count();
            if (newCount === count - 1) {
                return; // File removed successfully
            }

            throw new Error(`File not removed: ${imageFile.fileName}`);
        }
    }

    throw new Error(`Remove button not found for image: ${imageFile.fileName}`);
}

export async function setMaxSizeInMBAsync(page: Page, sizeInMB: number): Promise<void> {
    const input = page.locator(selectors.targetSizeMBInput);
    await input.fill(sizeInMB.toString());
}


export async function GetFullFilePathOfImageFileAsync(fileName: ImageFileDto): Promise<string> {
    const filePath = path.resolve(__dirname, '../fixtures/sample-images', fileName.fileName);

    try {
        await fsPromises.access(filePath); // Non-blocking async check
    } catch (error) {
        throw new Error(`Test file does not exist: ${filePath}`);
    }

    return filePath;
}


export async function assertZipButtonNotRenderedAsync(page: Page): Promise<void> {
  const zipButton = page.locator(selectors.zipDownloadButton);
  const count = await zipButton.count();
  if (count !== 0) {
    throw new Error('ZIP download button should not be rendered when uploading only one file.');
  }
}


export async function setResizeWidthAsync(page: Page, width: number): Promise<void> {
  const widthSwitch = page.locator(selectors.resizeWidthSwitch);
  await widthSwitch.click();
  const widthInput = page.locator(selectors.resizeWidthInput);
  await expect(widthInput).toBeEnabled();
  await widthInput.fill(width.toString());
}


export async function uploadFilesToDropzoneAsync(page: Page, fileNames: ImageFileDto[]): Promise<void> {
    // Wait for supported formats to be loaded to avoid race condition in onDrop
    const supportedFormatsBtn = page.locator(selectors.supportedFormatsBtn);
    await expect(supportedFormatsBtn).not.toContainText('(…)');

    const dropzoneInput = page.locator(selectors.dropzoneInput);
    const filePaths = await Promise.all(fileNames.map(GetFullFilePathOfImageFileAsync));
    await dropzoneInput.setInputFiles(filePaths);
}

export async function switchCompressionModeAsync(page: Page, mode: 'quality' | 'size'): Promise<void> {
    const selector = mode === 'quality' ? selectors.compressionModeQualityBtn : selectors.compressionModeSizeBtn;
    const modeBtn = page.locator(selector);
    await expect(modeBtn).toBeVisible();
    await modeBtn.click();
}

export async function clickDownloadZipButtonAndGetUrlAsync(page: Page): Promise<string> {
  const zipButton = page.locator(selectors.zipDownloadButton);
  await expect(zipButton).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    zipButton.click(),
  ]);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  return downloadPath!;
}


export async function assertZipContentAsync(zipFilePath: string, expectedFiles: ImageFileDto[]): Promise<void> {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();
    expect(entries.length).toBeGreaterThan(0);

    const zipFileNames: string[] = entries.map((entry: IZipEntry) => entry.entryName);

    for (const expectedFileDto of expectedFiles) {
        const expectedBaseName = path.basename(expectedFileDto.fileName, path.extname(expectedFileDto.fileName));
        const found = zipFileNames.some(zipFile => {
            const zipBaseName = path.basename(zipFile, path.extname(zipFile));
            return zipBaseName === expectedBaseName;
        });
        expect(found).toBeTruthy();
    }
}



export async function assertFilesPresentInDropzoneAsync(page: Page, imageFileDto: ImageFileDto[]): Promise<void> {
  const addedFiles = page.locator(selectors.dropzoneAddedFile);
  await expect(addedFiles).toHaveCount(imageFileDto.length);
  const fileContents = await addedFiles.allTextContents();
  for (const file of imageFileDto) {
    expect(fileContents).toContain(file.fileName);
  }
}


export async function clickConversionButtonAsync(page: Page): Promise<void> {
  await page.click(selectors.conversionButton);
}


export async function assertDownloadLinksAsync(page: Page, expectedFileNames: ImageFileDto[]): Promise<Locator> {
  const downloadLinks = page.locator(selectors.downloadLink);
  await expect(downloadLinks).toHaveCount(expectedFileNames.length);
  const downloadLinksText = await downloadLinks.allTextContents();
  for (const expectedFile of expectedFileNames) {
    const expectedBaseName = path.basename(expectedFile.fileName, path.extname(expectedFile.fileName));
    const found = downloadLinksText.some(text => {
      const linkBaseName = path.basename(text, path.extname(text));
      return linkBaseName === expectedBaseName;
    });
    expect(found).toBeTruthy();
  }
  return downloadLinks;
}


export async function AssertImageWidth(expectedWidth: number, metadata: sharp.Metadata) {
  console.log('Downloaded file metadata:', metadata);
  expect(metadata.width).toEqual(expectedWidth);
}


export function AssertDownloadsIsEqualsToSourceImageWidth(downloads: DownloadType[], imageFileNames: ImageFileDto[]) {
  for (const download of downloads) {
    const metadata = download.metadata;
    const newFilePath = download.newFilePath;

    for (const sourceImage of imageFileNames) {
      const sourceBaseName = path.basename(sourceImage.fileName, path.extname(sourceImage.fileName));
      const downloadBaseName = path.basename(newFilePath, path.extname(newFilePath));
      if (sourceBaseName === downloadBaseName) {
        AssertImageWidth(sourceImage.width!, metadata);
      }
    }
  }
}

/**
 * setOutputFormatAsync:
 * 1) Click the trigger button with id="outputFormat"
 * 2) Then click the corresponding SelectItem (by text)
 */
export async function setOutputFormatAsync(page: Page, format: string): Promise<void> {
  const trigger = page.locator('#outputFormat');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.locator('[data-radix-collection-item][role="option"]', {
    hasText: new RegExp(format, 'i'),
  });
  await expect(option).toBeVisible();
  await option.click();
}

export async function setRembgEnabledAsync(page: Page, enabled: boolean): Promise<void> {
  const toggle = page.locator(selectors.rembgSwitch);
  await expect(toggle).toBeVisible();
  const isChecked = await toggle.getAttribute('data-state');
  if ((isChecked === 'checked') !== enabled) {
    await toggle.click();
  }
}

export async function AssertImageHasTransparentPixels(filePath: string): Promise<void> {
  const stats = await sharp(filePath).stats();
  expect(stats.channels.length).toBeGreaterThanOrEqual(4);
  const alpha = stats.channels[3];
  expect(alpha.min).toBeLessThan(255);
}
