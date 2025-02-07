import fs from 'fs';
import path from 'path';
import { expect, Page, Locator } from '@playwright/test';
import AdmZip, { IZipEntry } from 'adm-zip';
import sharp from 'sharp';
import {ImageFileDto} from './ImageFileDto';
import { DownloadType } from './DownloadType';

const selectors = {
  zipDownloadButton: '[data-testid="drawer-download-all-as-zip-btn"]',
  resizeWidthSwitch: '[data-testid="resize-width-switch"]',
  resizeWidthInput: '[data-testid="resize-width-input"]',
  dropzoneInput: '[data-testid="dropzone-input"]',
  dropzoneAddedFile: '[data-testid="dropzone-added-file"]',
  conversionButton: '[data-testid="convert-btn"]',
  downloadLink: '[data-testid="drawer-uploaded-file-item-link"]',
};

/**
 * Returns the absolute file path for a test file in the sample-images fixture directory.
 * Throws an error if the file does not exist.
 *
 * @param fileName - Name of the file (e.g., "file1.jpg").
 * @returns The absolute file path.
 */
export function GetFullFilePathOfImageFile(fileName: ImageFileDto): string {
  const filePath = path.resolve(__dirname, '../fixtures/sample-images', fileName.fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file does not exist: ${filePath}`);
  }
  return filePath;
}

/**
 * Asserts that the ZIP download button is NOT rendered.
 *
 * @param page - The Playwright Page instance.
 * @returns A Promise that resolves when the assertion passes.
 */
export async function assertZipButtonNotRenderedAsync(page: Page): Promise<void> {
  const zipButton = page.locator(selectors.zipDownloadButton);
  const count = await zipButton.count();
  if (count !== 0) {
    throw new Error('ZIP download button should not be rendered when uploading only one file.');
  }
}

/**
 * Sets the resize width value by toggling the width switch and filling in the input.
 *
 * @param page - The Playwright Page instance.
 * @param width - The desired width value.
 * @returns A Promise that resolves when the width has been set.
 */
export async function setResizeWidthAsync(page: Page, width: number): Promise<void> {
  const widthSwitch = page.locator(selectors.resizeWidthSwitch);
  await widthSwitch.click();
  const widthInput = page.locator(selectors.resizeWidthInput);
  await expect(widthInput).toBeEnabled();
  await widthInput.fill(width.toString());
}

/**
 * Uploads the specified files to the dropzone.
 * Files must be located in the fixtures/sample-images folder.
 *
 * @param page - The Playwright Page instance.
 * @param fileNames - An array of file names.
 * @returns A Promise that resolves when the upload is complete.
 */
export async function uploadFilesToDropzoneAsync(page: Page, fileNames: ImageFileDto[]): Promise<void> {
  const dropzoneInput = page.locator(selectors.dropzoneInput);
  const filePaths = fileNames.map(GetFullFilePathOfImageFile);
  await dropzoneInput.setInputFiles(filePaths);
}

/**
 * Clicks the ZIP download button and returns the downloaded file's path.
 *
 * @param page - The Playwright Page instance.
 * @returns A Promise that resolves to the path of the downloaded ZIP file.
 */
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

/**
 * Asserts that the contents of the ZIP file include the expected files.
 *
 * @param zipFilePath - The path to the ZIP file.
 * @param expectedFiles - An array of expected file names.
 * @returns A Promise that resolves when the assertion is complete.
 */
export async function assertZipContentAsync(zipFilePath: string, expectedFiles: ImageFileDto[]): Promise<void> {
  const zip = new AdmZip(zipFilePath);
  const entries = zip.getEntries();
  expect(entries.length).toBeGreaterThan(0);

  const zipFileNames: string[] = entries.map((entry: IZipEntry) => entry.entryName);
  for (const expectedFileDto of expectedFiles) {
    expect(zipFileNames).toContain(expectedFileDto.fileName);
  }
}

/**
 * Asserts that the dropzone displays the expected files.
 *
 * @param page - The Playwright Page instance.
 * @param imageFileDto - An array of file names expected to be present in the dropzone.
 * @returns A Promise that resolves when the assertion is complete.
 */
export async function assertFilesPresentInDropzoneAsync(page: Page, imageFileDto: ImageFileDto[]): Promise<void> {
  const addedFiles = page.locator(selectors.dropzoneAddedFile);
  await expect(addedFiles).toHaveCount(imageFileDto.length);
  const fileContents = await addedFiles.allTextContents();
  for (const file of imageFileDto) {
    expect(fileContents).toContain(file.fileName);
  }
}

/**
 * Triggers the file conversion process by clicking the conversion button.
 *
 * @param page - The Playwright Page instance.
 * @returns A Promise that resolves when the conversion has been triggered.
 */
export async function clickConversionButtonAsync(page: Page): Promise<void> {
  await page.click(selectors.conversionButton);
}

/**
 * Asserts that download links appear and that each link contains the expected file name.
 *
 * @param expectedFileNames - An array of expected file names.
 * @returns A Promise that resolves to the Locator for the download link elements.
 */
export async function assertDownloadLinksAsync(page: Page, expectedFileNames: ImageFileDto[]): Promise<Locator> {
  const downloadLinks = page.locator(selectors.downloadLink);
  await expect(downloadLinks).toHaveCount(expectedFileNames.length, { timeout: 10000 });
  for (let i = 0; i < expectedFileNames.length; i++) {
    await expect(downloadLinks.nth(i)).toContainText(expectedFileNames[i].fileName);
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

      for (const sourceImageNames of imageFileNames) {
          if (sourceImageNames.fileName == path.basename(newFilePath))
              AssertImageWidth(sourceImageNames.width!, metadata);
      }
  }
}