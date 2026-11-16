import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  assertDownloadLinksAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setResizeWidthAsync,
  uploadGeneratedImageToDropzoneAsync,
  waitForFinishedJobAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';
import { downloadFilesAndGetMetadataAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';
import type { PresetSettings } from '../../src/lib/presets';

// Presets live in one file per server and every browser shares them, so the
// spec only ever touches presets whose name starts with this prefix.
const NAME_PREFIX = 'E2E preset ';

async function presetsDisabledAsync(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/config/runtime.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()).DISABLE_CUSTOM_PRESETS === 'true';
}

async function deleteTestPresetsAsync(request: APIRequestContext): Promise<void> {
  const response = await request.get('/api/presets');
  if (!response.ok()) return;
  for (const preset of (await response.json()).presets as { id: string; name: string }[]) {
    if (preset.name.startsWith(NAME_PREFIX)) await request.delete(`/api/presets/${preset.id}`);
  }
}

async function createPresetAsync(
  request: APIRequestContext,
  name: string,
  settings: Partial<PresetSettings>
): Promise<{ id: string; settings: PresetSettings }> {
  const response = await request.post('/api/presets', { data: { name, settings } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function getPresetAsync(request: APIRequestContext, id: string): Promise<{ name: string; settings: PresetSettings }> {
  const presets = (await (await request.get('/api/presets')).json()).presets as { id: string; name: string; settings: PresetSettings }[];
  const preset = presets.find((candidate) => candidate.id === id);
  expect(preset, `preset ${id} exists`).toBeTruthy();
  return preset!;
}

async function openAppAsync(page: Page): Promise<void> {
  await page.goto('/');
  await waitForSupportedFormatsCountAsync(page);
  await expect(page.getByTestId('compression-presets')).toBeVisible();
}

async function savePresetAsync(page: Page, name: string): Promise<void> {
  await page.getByTestId('preset-save-btn').click();
  const dialog = page.getByTestId('preset-save-dialog');
  await dialog.getByTestId('preset-name-input').fill(name);
  await dialog.getByTestId('preset-save-confirm-btn').click();
  await expect(dialog).toBeHidden();
}

async function selectPresetAsync(page: Page, name: string): Promise<void> {
  await page.getByTestId('preset-select').click();
  await page.getByTestId('preset-option').filter({ hasText: new RegExp(`^${name}$`) }).click();
}

const presetSelect = (page: Page) => page.getByTestId('preset-select');
const quality = (page: Page) => page.locator('#quality');
const widthInput = (page: Page) => page.getByTestId('resize-width-input');

test.describe('Compression presets', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(await presetsDisabledAsync(request), 'DISABLE_CUSTOM_PRESETS=true in this run');
    await deleteTestPresetsAsync(request);
  });

  test.afterEach(async ({ request }) => {
    await deleteTestPresetsAsync(request);
  });

  test('saves the current settings, applies them again and shows Custom after any change', async ({ page }) => {
    const name = `${NAME_PREFIX}Web JPEG`;
    await openAppAsync(page);
    await expect(presetSelect(page)).toHaveText('Custom');

    await setOutputFormatAsync(page, 'JPEG');
    await page.getByRole('button', { name: 'Smaller (60)' }).click();
    await setResizeWidthAsync(page, 640);
    await savePresetAsync(page, name);
    await expect(presetSelect(page)).toHaveText(name);

    // Any manual change clears the preset, and changing it back does not bring it back.
    await page.getByRole('button', { name: 'Balanced (75)' }).click();
    await expect(presetSelect(page)).toHaveText('Custom');
    await page.getByRole('button', { name: 'Smaller (60)' }).click();
    await expect(presetSelect(page)).toHaveText('Custom');

    await widthInput(page).fill('1024');
    await selectPresetAsync(page, name);
    await expect(presetSelect(page)).toHaveText(name);
    await expect(quality(page)).toHaveValue('60');
    await expect(widthInput(page)).toHaveValue('640');

    // Saved on the server: still there after a reload.
    await page.reload();
    await waitForSupportedFormatsCountAsync(page);
    await expect(presetSelect(page)).toHaveText('Custom');
    await selectPresetAsync(page, name);
    await expect(page.locator('#outputFormat')).toContainText('JPEG');
    await expect(quality(page)).toHaveValue('60');
    await expect(widthInput(page)).toHaveValue('640');
  });

  test('applies presets across formats without the format reset undoing them (JPEG -> PDF -> JPEG)', async ({
    page,
    request,
  }) => {
    const jpegName = `${NAME_PREFIX}JPEG 800`;
    const pdfName = `${NAME_PREFIX}A4 PDF`;
    await createPresetAsync(request, jpegName, { format: 'jpeg', quality: 75, width: 800 });
    await createPresetAsync(request, pdfName, {
      format: 'pdf',
      pdf_preset: 'a4-portrait',
      pdf_quality: 'small',
      pdf_margin_mm: 5,
      pdf_paginate: true,
    });
    await openAppAsync(page);

    await selectPresetAsync(page, jpegName);
    await expect(page.locator('#outputFormat')).toContainText('JPEG');
    await expect(quality(page)).toHaveValue('75');
    await expect(widthInput(page)).toHaveValue('800');
    await expect(presetSelect(page)).toHaveText(jpegName);

    await selectPresetAsync(page, pdfName);
    await expect(page.locator('#outputFormat')).toContainText('PDF');
    await expect(page.locator('#pdfPreset')).toContainText('A4 Portrait');
    await expect(page.getByTestId('pdf-quality-select')).toContainText('96 DPI');
    await expect(page.getByTestId('pdfMarginInput')).toHaveValue('5');
    await expect(page.getByTestId('pdf-paginate-switch')).toHaveAttribute('data-state', 'checked');
    await expect(page.getByTestId('resize-width-switch')).toHaveAttribute('data-state', 'unchecked');
    await expect(presetSelect(page)).toHaveText(pdfName);

    await selectPresetAsync(page, jpegName);
    await expect(page.locator('#outputFormat')).toContainText('JPEG');
    await expect(quality(page)).toHaveValue('75');
    await expect(widthInput(page)).toHaveValue('800');
    await expect(presetSelect(page)).toHaveText(jpegName);

    await setOutputFormatAsync(page, 'PNG');
    await expect(presetSelect(page)).toHaveText('Custom');
  });

  test('renames, overwrites only after confirming, and deletes presets', async ({ page, request }) => {
    const preset = await createPresetAsync(request, `${NAME_PREFIX}Manage`, { format: 'jpeg', quality: 60 });
    const renamed = `${NAME_PREFIX}Renamed`;
    await openAppAsync(page);
    await setOutputFormatAsync(page, 'PNG');

    await page.getByTestId('preset-manage-btn').click();
    const dialog = page.getByTestId('preset-manage-dialog');
    const row = dialog.locator(`[data-preset-name="${NAME_PREFIX}Manage"]`);
    await row.getByTestId('preset-row-name-input').fill(renamed);
    await row.getByTestId('preset-rename-btn').click();
    await expect(dialog.locator(`[data-preset-name="${renamed}"]`)).toBeVisible();
    expect((await getPresetAsync(request, preset.id)).name).toBe(renamed);

    const renamedRow = dialog.locator(`[data-preset-name="${renamed}"]`);
    await renamedRow.getByTestId('preset-overwrite-btn').click();
    await expect(renamedRow.getByTestId('preset-confirm')).toBeVisible();
    // Nothing changes until the user confirms.
    expect((await getPresetAsync(request, preset.id)).settings.format).toBe('jpeg');
    await renamedRow.getByTestId('preset-confirm-btn').click();
    await expect(renamedRow.getByTestId('preset-confirm')).toBeHidden();
    expect((await getPresetAsync(request, preset.id)).settings).toMatchObject({ format: 'png', quality: null, use_rembg: false });

    await renamedRow.getByTestId('preset-delete-btn').click();
    await renamedRow.getByTestId('preset-confirm-btn').click();
    await expect(dialog.locator(`[data-preset-name="${renamed}"]`)).toHaveCount(0);
    const remaining = (await (await request.get('/api/presets')).json()).presets as { id: string }[];
    expect(remaining.map((p) => p.id)).not.toContain(preset.id);

    await page.keyboard.press('Escape');
    await expect(presetSelect(page)).toHaveText('Custom');
  });

  test('refuses a second preset with the same name', async ({ page, request }) => {
    await createPresetAsync(request, `${NAME_PREFIX}Taken`, { format: 'png' });
    await openAppAsync(page);
    await setOutputFormatAsync(page, 'JPEG');

    await page.getByTestId('preset-save-btn').click();
    const dialog = page.getByTestId('preset-save-dialog');
    await dialog.getByTestId('preset-name-input').fill(`${NAME_PREFIX}TAKEN`);
    await dialog.getByTestId('preset-save-confirm-btn').click();

    await expect(dialog.getByTestId('preset-save-error')).toHaveText('A preset with this name already exists.');
    await expect(dialog).toBeVisible();
  });

  test('a selected preset decides how files are converted', async ({ page, request }) => {
    const name = `${NAME_PREFIX}Small WebP`;
    await createPresetAsync(request, name, { format: 'webp', quality: 70, width: 32 });
    await openAppAsync(page);
    await selectPresetAsync(page, name);

    const image = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3366cc' } }).png().toBuffer();
    await uploadGeneratedImageToDropzoneAsync(page, 'preset-source.png', 'image/png', image);
    const finished = waitForFinishedJobAsync(page);
    await clickConversionButtonAsync(page);
    expect((await finished).converted_files).toEqual(['preset-source.webp']);

    const links = await assertDownloadLinksAsync(page, [new ImageFileDto('preset-source.png')]);
    const [download] = await downloadFilesAndGetMetadataAsync(page, links);
    expect(download.metadata.format).toBe('webp');
    expect(download.metadata.width).toBe(32);
  });
});

test('DISABLE_CUSTOM_PRESETS=true hides the presets and the API refuses them', async ({ page, request }) => {
  test.skip(!(await presetsDisabledAsync(request)), 'presets are enabled in this run');

  await page.goto('/');
  await waitForSupportedFormatsCountAsync(page);
  await expect(page.getByTestId('compression-presets')).toHaveCount(0);

  const response = await request.get('/api/presets');
  expect(response.status()).toBe(403);
});
