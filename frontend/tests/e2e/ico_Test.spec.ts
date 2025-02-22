import { expect, test } from '@playwright/test';
import decodeIco from 'decode-ico';
import fs from 'fs';
import {
  assertFilesPresentInDropzoneAsync,
  setResizeWidthAsync,
  clickConversionButtonAsync,
  assertZipButtonNotRenderedAsync,
  assertDownloadLinksAsync,
  uploadFilesToDropzoneAsync,
  setOutputFormatAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';


test("should upload a file, convert it to ICO with a given width, and verify download", async ({
  page,
}) => {
  await page.goto("/");

  const desiredWidth: number = 128;
  const fileNames: ImageFileDto[] = [new ImageFileDto("ico-datei.png")];

  await uploadFilesToDropzoneAsync(page, fileNames);
  await assertFilesPresentInDropzoneAsync(page, fileNames);
  await setResizeWidthAsync(page, desiredWidth);
  await setOutputFormatAsync(page, "ICO");
  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);


const fileItemLocator = await assertDownloadLinksAsync(page, fileNames);
const dls = await downloadFilesAsync(page, fileItemLocator);
for (const dl of dls) {
    const source = fs.readFileSync(dl)
    const images = decodeIco(source);
    const widths = images.map(img => img.width);
    const maxWidth = Math.max(...widths);
    console.log('ICO widths:', widths, 'Max width:', maxWidth);
    expect(maxWidth).toEqual(128);
    }
});
