import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { dropFolderLikeTheBrowserAsync, type DroppedBytes } from './utls/folderDrop';

// A dropped folder can hold files the app cannot take. The red message keeps
// its one-line summary; "Show details" lists which files were left out, from
// which folder, and why.

const MB = 1024 * 1024;

async function pngAsync(path: string): Promise<DroppedBytes> {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#3366aa' } }).png().toBuffer();
  return { path, bytes: [...bytes] };
}

const textFile = (path: string): DroppedBytes => ({ path, bytes: [...Buffer.from('not a picture')], type: 'text/plain' });

const toggle = (page: Page) => page.getByTestId('skipped-files-toggle');

test.describe('Skipped files can be expanded to see which ones', () => {
  test('a folder with one unsupported file names it under "Show details"', async ({ page, browserName }) => {
    await page.goto('/');
    await dropFolderLikeTheBrowserAsync(page, browserName, [
      await pngAsync('/holiday/beach.png'),
      textFile('/holiday/notes/readme.txt'),
    ]);

    await expect(page.getByTestId('dropzone-added-file')).toHaveText(['beach.png']);
    await expect(page.getByTestId('error-message-holder')).toContainText("Skipped 1 file(s). I can't open that file type.");
    await expect(page.locator('.Toastify__toast--error')).toHaveText(['Unsupported File Format: readme.txt']);

    // Collapsed by default: only the summary and the button.
    await expect(toggle(page)).toHaveText('Show details');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('skipped-files-list')).toHaveCount(0);

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page)).toHaveText('Hide details');
    const list = page.getByRole('list', { name: 'Skipped files' });
    await expect(list).toBeVisible();
    await expect(toggle(page)).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!);
    await expect(list.getByTestId('skipped-file')).toHaveCount(1);
    await expect(list.getByTestId('skipped-file-folder')).toHaveText('holiday/notes/');
    await expect(list.getByTestId('skipped-file-name')).toHaveText('readme.txt');
    await expect(list.getByTestId('skipped-file-reason')).toHaveText('File type not supported');

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('skipped-files-list')).toHaveCount(0);
  });

  test('a file above the upload limit is listed with its reason', async ({ page, browserName }) => {
    // Pretend the container runs with MAX_UPLOAD_SIZE_MB=1.
    await page.route('**/config/runtime.json', async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      await route.fulfill({ response, json: { ...config, MAX_UPLOAD_SIZE_MB: '1' } });
    });
    await page.goto('/');
    await expect(page.getByTestId('dropzone-max-size')).toHaveText('Max. 1 MB per file');
    await dropFolderLikeTheBrowserAsync(page, browserName, [
      { path: '/scans/big.png', bytes: new Array(2 * MB).fill(0) },
      textFile('/scans/list.csv'),
    ]);

    await expect(page.getByTestId('error-message-holder')).toContainText('Skipped 1 file(s).');
    await expect(page.getByTestId('error-message-holder')).toContainText('big.png is larger than 1 MB');
    await toggle(page).click();
    const rows = page.getByTestId('skipped-file');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'big.png' }).getByTestId('skipped-file-reason')).toHaveText('Larger than 1 MB');
    await expect(rows.filter({ hasText: 'list.csv' }).getByTestId('skipped-file-reason')).toHaveText('File type not supported');
  });

  test('a long list is capped with "+N more" and starts collapsed again on the next drop', async ({ page, browserName }) => {
    await page.goto('/');
    const many = Array.from({ length: 105 }, (_, i) => textFile(`/docs/file-${String(i).padStart(3, '0')}.txt`));
    await dropFolderLikeTheBrowserAsync(page, browserName, many);

    await expect(page.getByTestId('error-message-holder')).toContainText('Skipped 105 file(s).');
    // One toast for the whole drop, not one per file.
    const toasts = page.locator('.Toastify__toast--error');
    await expect(toasts).toHaveCount(1);
    await expect(toasts).toContainText("Skipped 105 file(s). I can't open that file type.");
    await toggle(page).click();
    await expect(page.getByTestId('skipped-file')).toHaveCount(100);
    await expect(page.getByTestId('skipped-files-more')).toHaveText('+5 more');
    const list = page.getByTestId('skipped-files-list');
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await dropFolderLikeTheBrowserAsync(page, browserName, [textFile('/other/again.txt')]);
    await expect(page.getByTestId('error-message-holder')).toContainText('Skipped 1 file(s).');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('loose files show no folder and the German texts are used', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('imgcompress_locale', 'de'));
    await page.goto('/');
    await page.getByTestId('dropzone-input').setInputFiles({
      name: 'invoice.docx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'),
    });

    await expect(page.getByTestId('error-message-holder')).toContainText('1 Datei(en) übersprungen.');
    await expect(toggle(page)).toHaveText('Details anzeigen');
    await toggle(page).click();
    await expect(page.getByTestId('skipped-file-name')).toHaveText('invoice.docx');
    await expect(page.getByTestId('skipped-file-folder')).toHaveCount(0);
    await expect(page.getByTestId('skipped-file-reason')).toHaveText('Dateityp wird nicht unterstützt');
  });
});
