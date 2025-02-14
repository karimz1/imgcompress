import path from 'path';
import fs from 'fs';
import { expect, Page, Locator } from '@playwright/test';
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
  dropzoneAddedFileWrapper: '[data-testid="dropzone-added-file-wrapper"]'
};

export async function removeImageFileFromDropzoneAsync(page: Page, imageFile: ImageFileDto): Promise<void> {
  const fileWrappers = page.locator(selectors.dropzoneAddedFileWrapper);
  const count = await fileWrappers.count();

  for (let i = 0; i < count; i++) {
    const wrapper = fileWrappers.nth(i);
    const fileNameElement = wrapper.locator(selectors.dropzoneAddedFile);
    const fileNameText = await fileNameElement.textContent();

    if (fileNameText && fileNameText.trim() === imageFile.fileName.trim()) {
      const removeButton = wrapper.locator(selectors.removeItemFromDropzoneBtn);
      await removeButton.click();
      return;
    }
  }

  throw new Error(`Remove button not found for image: ${imageFile.fileName}`);
}


export function GetFullFilePathOfImageFile(fileName: ImageFileDto): string {
  const filePath = path.resolve(__dirname, '../fixtures/sample-images', fileName.fileName);
  if (!fs.existsSync(filePath)) {
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
  const dropzoneInput = page.locator(selectors.dropzoneInput);
  const filePaths = fileNames.map(GetFullFilePathOfImageFile);
  await dropzoneInput.setInputFiles(filePaths);
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
