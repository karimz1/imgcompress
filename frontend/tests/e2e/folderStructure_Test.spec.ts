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
import { dropFolderLikeTheBrowserAsync } from './utls/folderDrop';

// With "Keep folder structure" on, a dropped folder keeps its layout in the
// results and in the ZIP; off (the default) it comes back flat like before.
// The browser tells react-dropzone the folder of each file through `path`, so
// most tests give their files the same property a real folder drop would.
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

async function pngBytesAsync(color: string, width = 16, height = 16): Promise<number[]> {
  return [...(await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer())];
}

/** A dropped folder of small PNGs, delivered the way this browser hands it over. */
async function dropPngFolderLikeTheBrowserAsync(page: Page, browserName: string, paths: string[]): Promise<void> {
  const files = await Promise.all(paths.map(async (path, i) => ({ path, bytes: await pngBytesAsync(`#${(i * 40 + 30).toString(16).padStart(2, '0')}2040`) })));
  await dropFolderLikeTheBrowserAsync(page, browserName, files);
}

const keepFoldersSwitch = (page: Page) => page.getByTestId('keep-folders-switch');

async function setKeepFoldersAsync(page: Page, on: boolean): Promise<void> {
  const toggle = keepFoldersSwitch(page);
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on));
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
    await setKeepFoldersAsync(page, true);

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
    await setKeepFoldersAsync(page, true);
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

  test('the switch is hidden for loose files and off by default for folders', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await dropFolderAsync(page, [{ path: './loose.png', color: '#ff0000' }]);
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(1);
    await expect(keepFoldersSwitch(page)).toHaveCount(0);

    await dropFolderAsync(page, [{ path: '/trip/holiday.png', color: '#00ff00' }]);
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(2);
    await expect(keepFoldersSwitch(page)).toBeVisible();
    await expect(keepFoldersSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('dropzone-added-file-folder')).toHaveCount(0);

    await setKeepFoldersAsync(page, true);
    await expect(page.getByTestId('dropzone-added-file-folder')).toHaveText(['trip/']);
  });

  test('the info tooltip explains the switch', async ({ page }) => {
    await page.goto('/');
    await dropFolderAsync(page, [{ path: '/trip/holiday.png', color: '#00ff00' }]);
    await page.getByTestId('keep-folders-info').hover();
    const tooltip = page.getByTestId('keep-folders-tooltip');
    await expect(tooltip).toContainText('Keeps the folders you dropped in the results and the ZIP');
    await expect(tooltip).toContainText('Only works with drag and drop.');
    await expect(tooltip).toContainText('duplicate file names get a number');
  });

  test('switch off: same-named files from different folders come back flat with unique names', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await dropFolderAsync(page, [
      { path: '/trip/holiday.png', color: '#ff0000', width: 40, height: 20 },
      { path: '/trip/sub/holiday.png', color: '#00ff00', width: 30, height: 20 },
      { path: '/trip/sub/subsub/holiday.png', color: '#0000ff', width: 20, height: 20 },
    ]);
    await expect(keepFoldersSwitch(page)).toHaveAttribute('aria-checked', 'false');

    const finished = waitForFinishedJobAsync(page);
    await clickConversionButtonAsync(page);
    const job = await finished;
    expect([...job.converted_files].sort()).toEqual(['holiday.jpg', 'holiday_1.jpg', 'holiday_2.jpg']);

    const zip = new AdmZip(await clickDownloadZipButtonAndGetUrlAsync(page));
    const entries = zip.getEntries().map((entry) => entry.entryName).sort();
    expect(entries).toEqual(['holiday.jpg', 'holiday_1.jpg', 'holiday_2.jpg']);
    const widths = await Promise.all(entries.map(async (name) => (await sharp(zip.readFile(name)!).metadata()).width));
    expect([...widths].sort()).toEqual([20, 30, 40]); // three different files, none overwritten
  });

  test('the choice is remembered after a reload', async ({ page }) => {
    await page.goto('/');
    await dropFolderAsync(page, [{ path: '/trip/holiday.png', color: '#00ff00' }]);
    await setKeepFoldersAsync(page, true);
    expect(await page.evaluate(() => localStorage.getItem('imgcompress.keepFolderStructure'))).toBe('true');

    await page.reload();
    await dropFolderAsync(page, [{ path: '/trip/holiday.png', color: '#00ff00' }]);
    await expect(keepFoldersSwitch(page)).toHaveAttribute('aria-checked', 'true');

    await setKeepFoldersAsync(page, false);
    await page.reload();
    await dropFolderAsync(page, [{ path: '/trip/holiday.png', color: '#00ff00' }]);
    await expect(keepFoldersSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('a folder dropped the way this browser delivers it keeps its tree', async ({ page, browserName }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await dropPngFolderLikeTheBrowserAsync(page, browserName, [
      'trip/holiday.png',
      'trip/sub/holiday.png',
      'trip/sub/subsub/holiday.png',
      'trip/b/other.png',
    ]);
    await expect(page.getByTestId('dropzone-added-file')).toHaveCount(4);
    await setKeepFoldersAsync(page, true);
    // The order follows the walk of the tree, which differs between handles and entries.
    await expect
      .poll(async () => (await page.getByTestId('dropzone-added-file-folder').allTextContents()).sort())
      .toEqual(['trip/', 'trip/b/', 'trip/sub/', 'trip/sub/subsub/']);

    const finished = waitForFinishedJobAsync(page);
    await clickConversionButtonAsync(page);
    const job = await finished;
    const expected = ['trip/b/other.jpg', 'trip/holiday.jpg', 'trip/sub/holiday.jpg', 'trip/sub/subsub/holiday.jpg'];
    expect([...job.converted_files].sort()).toEqual(expected);
    const zip = new AdmZip(await clickDownloadZipButtonAndGetUrlAsync(page));
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual(expected);
  });
});
