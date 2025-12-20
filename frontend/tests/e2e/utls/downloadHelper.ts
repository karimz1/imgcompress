import fs from 'fs';
import path from 'path';
import { Page, Locator } from '@playwright';
import sharp from 'sharp';
import { DownloadType } from './DownloadType';



export async function downloadFilesAndGetMetadataAsync(
  page: Page,
  linkLocator: Locator
): Promise<Array<DownloadType>> {
  const downloadResults: Array<DownloadType> = [];
  const linksCount = await linkLocator.count();

  
  const tempDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  
  for (let i = 0; i < linksCount; i++) {
    
    const currentLink = linkLocator.nth(i);

    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      currentLink.click(),
    ]);

    
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error(`Download path is undefined for link index ${i}.`);
    }
    console.log('Downloaded file path:', downloadPath);

    
    const newFilePath = path.join(tempDir, download.suggestedFilename());
    await download.saveAs(newFilePath);
    console.log('Saved file to:', newFilePath);

    
    const metadata = await sharp(newFilePath).metadata();

    downloadResults.push({ newFilePath, metadata });
  }

  return downloadResults;
}

export async function downloadFilesAsync(
  page: Page,
  linkLocator: Locator
): Promise<Array<string>> {
  const downloadResults: Array<string> = [];
  const linksCount = await linkLocator.count();

  
  const tempDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  
  for (let i = 0; i < linksCount; i++) {
    const currentLink = linkLocator.nth(i);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      currentLink.click(),
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error(`Download path is undefined for link index ${i}.`);
    }
    console.log('Downloaded file path:', downloadPath);

    
    const newFilePath = path.join(tempDir, download.suggestedFilename());
    await download.saveAs(newFilePath);
    console.log('Saved file to:', newFilePath);
    downloadResults.push(newFilePath);
  }

  return downloadResults;
}