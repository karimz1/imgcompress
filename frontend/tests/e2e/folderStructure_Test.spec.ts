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

type DroppedFile = { path: string; color: string; width?: number; height?: number };

async function dropFolderAsync(page: Page, dropped: DroppedFile[] = DROPPED_FILES): Promise<void> {
  await waitForSupportedFormatsCountAsync(page);
  const files = await Promise.all(
    dropped.map(async ({ path, color, width = 16, height = 16 }) => ({
      path,
      bytes: [
        ...(await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer()),
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

  test('the same file name in different folders stays independent', async ({ page }) => {
    // holiday.png three times: top, sub and sub-sub folder. Sizes tell them apart.
    const sameName: DroppedFile[] = [
      { path: '/trip/holiday.png', color: '#ff0000', width: 400, height: 200 },
      { path: '/trip/sub/holiday.png', color: '#00ff00', width: 360, height: 180 },
      { path: '/trip/sub/subsub/holiday.png', color: '#0000ff', width: 300, height: 150 },
    ];
    const item = (folder: string) =>
      page.getByTestId('dropzone-added-file-wrapper').filter({
        has: page.getByTestId('dropzone-added-file-folder').getByText(`${folder}/`, { exact: true }),
      });

    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await dropFolderAsync(page, sameName);
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(3);
    await expect(page.getByTestId('dropzone-added-file')).toHaveText(['holiday.png', 'holiday.png', 'holiday.png']);
    await expect(item('trip')).toHaveCount(1);
    await expect(item('trip/sub')).toHaveCount(1);
    await expect(item('trip/sub/subsub')).toHaveCount(1);

    // Removing one keeps the others.
    await item('trip/sub').getByTestId('dropzone-remove-file-btn').click();
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(2);
    await expect(item('trip/sub')).toHaveCount(0);
    await expect(item('trip')).toHaveCount(1);
    await expect(item('trip/sub/subsub')).toHaveCount(1);

    // A crop on one applies to that one only.
    await item('trip').getByTestId('dropzone-crop-file-btn').click();
    await expect(page.getByTestId('crop-dialog')).toBeVisible();
    await page.getByTestId('crop-preset-1:1').click();
    await page.getByTestId('crop-save-btn').click();
    await expect(page.getByTestId('crop-dialog')).toHaveCount(0);
    await expect(item('trip').getByTestId('dropzone-crop-badge')).toBeVisible();
    await expect(item('trip/sub/subsub').getByTestId('dropzone-crop-badge')).toHaveCount(0);
    await expect(page.getByTestId('dropzone-crop-badge')).toHaveCount(1);

    const finished = waitForFinishedJobAsync(page);
    await clickConversionButtonAsync(page);
    const job = await finished;
    // The crop is cut in the browser, which names the file holiday_cropped.
    expect([...job.converted_files].sort()).toEqual(['trip/holiday_cropped.jpg', 'trip/sub/subsub/holiday.jpg']);

    const zip = new AdmZip(await clickDownloadZipButtonAndGetUrlAsync(page));
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([...job.converted_files].sort());
    const cropped = await sharp(zip.readFile('trip/holiday_cropped.jpg')!).metadata();
    expect(cropped.width).toBe(cropped.height);
    const untouched = await sharp(zip.readFile('trip/sub/subsub/holiday.jpg')!).metadata();
    expect([untouched.width, untouched.height]).toEqual([300, 150]);
  });
});
