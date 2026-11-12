import AdmZip from 'adm-zip';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  clickDownloadZipButtonAndGetUrlAsync,
  setOutputFormatAsync,
  waitForFinishedJobAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';

// A dropped folder keeps its layout in the results and in the ZIP. The browser
// tells react-dropzone the folder of each file through `path`, so the test
// gives its files the same property a real folder drop would.
const DROPPED_FILES = [
  { path: '/photos/test1.png', color: '#ff0000' },
  { path: '/photos/test-nested1/test2.png', color: '#00ff00' },
  { path: '/photos/test-nested1/test-nested2/test3.png', color: '#0000ff' },
];

async function dropFolderAsync(page: Page): Promise<void> {
  await waitForSupportedFormatsCountAsync(page);
  const files = await Promise.all(
    DROPPED_FILES.map(async ({ path, color }) => ({
      path,
      bytes: [
        ...(await sharp({ create: { width: 16, height: 16, channels: 3, background: color } }).png().toBuffer()),
      ],
    }))
  );
  await page.getByTestId('dropzone-input').evaluate((input: HTMLInputElement, dropped) => {
    const transfer = new DataTransfer();
    for (const { path, bytes } of dropped) {
      const file = new File([new Uint8Array(bytes)], path.split('/').pop()!, { type: 'image/png' });
      Object.defineProperty(file, 'path', { value: path });
      transfer.items.add(file);
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, files);
}

test.describe('Dropped folders keep their structure', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('results and the ZIP mirror the folders that were dropped', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await dropFolderAsync(page);
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(DROPPED_FILES.length);

    const finished = waitForFinishedJobAsync(page);
    await clickConversionButtonAsync(page);
    const job = await finished;
    expect([...job.converted_files].sort()).toEqual([
      'photos/test-nested1/test-nested2/test3.jpg',
      'photos/test-nested1/test2.jpg',
      'photos/test1.jpg',
    ]);

    const zip = new AdmZip(await clickDownloadZipButtonAndGetUrlAsync(page));
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([...job.converted_files].sort());

    const nested = page.getByTestId('drawer-uploaded-file-item-link').filter({ hasText: 'test-nested2/test3.jpg' });
    const [download] = await Promise.all([page.waitForEvent('download'), nested.click()]);
    expect(download.suggestedFilename()).toBe('test3.jpg');
    const metadata = await sharp(await download.path()).metadata();
    expect(metadata.format).toBe('jpeg');
  });
});
