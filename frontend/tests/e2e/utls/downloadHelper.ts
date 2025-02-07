import fs from 'fs';
import path from 'path';
import { Page, Locator } from '@playwright/test';
import sharp from 'sharp';
import { DownloadType } from './DownloadType';


/**
 * Downloads all files triggered by the provided locator, saves them in a temporary directory,
 * and returns an array of objects containing the new file path and image metadata.
 *
 * @param page - The Playwright Page instance.
 * @param linkLocator - A Locator matching one or more elements that trigger a download.
 * @returns A Promise that resolves to an array of objects, each with the downloaded file's path and its metadata.
 */
export async function downloadFilesAndGetMetadataAsync(
  page: Page,
  linkLocator: Locator
): Promise<Array<DownloadType>> {
  const downloadResults: Array<DownloadType> = [];
  const linksCount = await linkLocator.count();

  // Create a temporary directory (only once) to store downloaded files.
  const tempDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Iterate over each download link.
  for (let i = 0; i < linksCount; i++) {
    // Get the nth download link.
    const currentLink = linkLocator.nth(i);

    // Trigger the download and wait for the download event.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      currentLink.click(),
    ]);

    // Wait for the download to complete and get its temporary path.
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error(`Download path is undefined for link index ${i}.`);
    }
    console.log('Downloaded file path:', downloadPath);

    // Construct a new file path using the suggested filename.
    const newFilePath = path.join(tempDir, download.suggestedFilename());
    await download.saveAs(newFilePath);
    console.log('Saved file to:', newFilePath);

    // Use sharp to read the image metadata.
    const metadata = await sharp(newFilePath).metadata();

    downloadResults.push({ newFilePath, metadata });
  }

  return downloadResults;
}