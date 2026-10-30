import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  AssertImageHasTransparentPixels,
  assertDownloadLinksAsync,
  assertFilesPresentInDropzoneAsync,
  assertZipButtonNotRenderedAsync,
  clearStorageManagerAsync,
  clickConversionButtonAsync,
  setOutputFormatAsync,
  setUpscaleAsync,
  uploadFilesToDropzoneAsync,
  uploadGeneratedImageToDropzoneAsync,
  waitForSupportedFormatsCountAsync,
} from './utls/helpers';
import { downloadFilesAsync } from './utls/downloadHelper';
import { ImageFileDto } from './utls/ImageFileDto';
import type { UpscaleTarget } from '../../src/lib/upscale';

// These run against the real bundled model on the CPU (CI runners have no GPU).
const UPSCALED_SUFFIX = '_ai-upscaled';
const SKYLINE_PHOTO = path.resolve(__dirname, 'fixtures/sample-images', 'pexels-willianjusten-29944187.jpg');
const TRANSPARENT_PNG = new ImageFileDto('ico-datei.png');

test.describe('AI upscaling', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('shows each image its own size before converting', async ({ page }) => {
    const landscape = await sharp(SKYLINE_PHOTO).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    const portrait = await buildLineCardAsync(400, 600);

    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await waitForSupportedFormatsCountAsync(page);
    await page.getByTestId('dropzone-input').setInputFiles([
      { name: 'skyline-720p.jpg', mimeType: 'image/jpeg', buffer: landscape },
      { name: 'poster.png', mimeType: 'image/png', buffer: portrait },
    ]);
    await assertFilesPresentInDropzoneAsync(page, [new ImageFileDto('skyline-720p.jpg'), new ImageFileDto('poster.png')]);
    await expect(page.getByTestId('upscale-size-preview')).toHaveCount(0);

    await setUpscaleAsync(page, '4k');
    await expect(page.getByTestId('upscale-model-option-general')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('upscale-model-option-general')).toContainText('Photos and mixed images');
    await expect(page.getByTestId('upscale-model-option-anime')).toContainText('Drawings, anime, logos');
    const row = (name: string) => page.getByTestId('dropzone-added-file-wrapper').filter({ hasText: name });
    await expect(row('skyline-720p.jpg').getByTestId('upscale-size-preview')).toHaveText('1280×720 → 3840×2160');
    // Portrait: 2160 / 400 is the tighter fit, so the short side fills the frame.
    await expect(row('poster.png').getByTestId('upscale-size-preview')).toHaveText('400×600 → 2160×3240');
    await expect(page.getByTestId('upscale-large-target-hint')).toHaveCount(0);

    await setUpscaleAsync(page, '8k');
    await expect(page.getByTestId('upscale-large-target-hint')).toHaveText('Very big results take longer.');
    await expect(row('skyline-720p.jpg').getByTestId('upscale-size-preview')).toHaveText('1280×720 → 7680×4320');

    // What the preview promised is what the server makes.
    await setUpscaleAsync(page, '4k');
    await clickConversionButtonAsync(page);
    const links = await assertDownloadLinksAsync(
      page, [new ImageFileDto('skyline-720p.jpg'), new ImageFileDto('poster.png')], UPSCALED_SUFFIX,
    );
    const sizes = await Promise.all(
      (await downloadFilesAsync(page, links)).map(async (file) => {
        const { width, height } = await sharp(file).metadata();
        return `${path.basename(file).split(UPSCALED_SUFFIX)[0]} ${width}×${height}`;
      }),
    );
    expect(sizes.sort()).toEqual(['poster 2160×3240', 'skyline-720p 3840×2160']);
  });

  test('says when an image stays as it is or is too large', async ({ page }) => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 90, g: 120, b: 150 } } })
      .png()
      .toBuffer();
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await uploadGeneratedImageToDropzoneAsync(page, 'large-flat.png', 'image/png', big);
    await setUpscaleAsync(page, '4k');
    const preview = page.getByTestId('upscale-size-preview');
    await expect(preview).toHaveText('4000×3000 · stays as is');
    await expect(preview).toHaveAttribute('data-kind', 'unchanged');
    await setUpscaleAsync(page, '4x');
    await expect(preview).toHaveText('16000×12000 is over the 144 MP limit');
    await expect(preview).toHaveAttribute('data-kind', 'tooLarge');
  });

  test('4x gives exact size and sharper edges than bicubic', async ({ page }) => {
    const card = new ImageFileDto('upscale-card.png');
    const source = await buildLineCardAsync(320, 180);

    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await uploadGeneratedImageToDropzoneAsync(page, card.fileName, 'image/png', source);
    await assertFilesPresentInDropzoneAsync(page, [card]);
    await setUpscaleAsync(page, '4x');

    const outputPath = await convertAndDownloadSingleAsync(page, card, '.png');

    const metadata = await sharp(outputPath).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 1280, height: 720 });

    const bicubic = await sharp(source).resize(1280, 720, { kernel: 'cubic' }).toBuffer();
    const aiEnergy = await laplacianEnergyAsync(outputPath);
    const bicubicEnergy = await laplacianEnergyAsync(bicubic);
    expect(aiEnergy).toBeGreaterThan(bicubicEnergy * 2);
  });

  test('720p photo to 4K on the CPU keeps the picture', async ({ page }) => {
    const photo = new ImageFileDto('skyline-720p.jpg');
    const source = await sharp(SKYLINE_PHOTO).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();

    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    await uploadGeneratedImageToDropzoneAsync(page, photo.fileName, 'image/jpeg', source);
    await assertFilesPresentInDropzoneAsync(page, [photo]);
    await setUpscaleAsync(page, '4k');

    // A few seconds on a CI runner; the global 2 minute expect timeout covers slow machines.
    const outputPath = await convertAndDownloadSingleAsync(page, photo, '.jpg');

    const metadata = await sharp(outputPath).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 3840, height: 2160 });

    // Shrunk back to 720p it has to match the source closely: the model adds
    // detail, it must not change colours or invent a different picture.
    const shrunk = await sharp(outputPath).resize(1280, 720, { kernel: 'lanczos3' }).toBuffer();
    expect(await psnrAsync(shrunk, source)).toBeGreaterThan(28);
  });

  const aspectRatioCases: { target: UpscaleTarget; source: [number, number]; expected: [number, number] }[] = [
    { target: '8x', source: [80, 60], expected: [640, 480] },
    { target: '1080p', source: [80, 120], expected: [1080, 1620] },
    { target: '4k', source: [80, 80], expected: [2160, 2160] },
    { target: '6k', source: [120, 80], expected: [4860, 3240] },
    { target: '8k', source: [120, 40], expected: [7680, 2560] },
    { target: '16k', source: [20, 120], expected: [2560, 15360] },
  ];

  for (const { target, source: [width, height], expected } of aspectRatioCases) {
    test(`${target} preserves the aspect ratio`, async ({ page }) => {
      const card = new ImageFileDto(`aspect-ratio-${target}.png`);
      const source = await buildLineCardAsync(width, height);

      await page.goto('/');
      await setOutputFormatAsync(page, 'JPEG');
      await uploadGeneratedImageToDropzoneAsync(page, card.fileName, 'image/png', source);
      await assertFilesPresentInDropzoneAsync(page, [card]);
      await setUpscaleAsync(page, target);

      const outputPath = await convertAndDownloadSingleAsync(page, card, '.jpg');
      const metadata = await sharp(outputPath).metadata();
      expect([metadata.width, metadata.height]).toEqual(expected);
    });
  }

  test('2x keeps transparency', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await uploadFilesToDropzoneAsync(page, [TRANSPARENT_PNG]);
    await assertFilesPresentInDropzoneAsync(page, [TRANSPARENT_PNG]);
    await setUpscaleAsync(page, '2x');

    const outputPath = await convertAndDownloadSingleAsync(page, TRANSPARENT_PNG, '.png');

    const metadata = await sharp(outputPath).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 1024, height: 1024 });
    expect(metadata.hasAlpha).toBeTruthy();
    await AssertImageHasTransparentPixels(outputPath);
  });

  test('refuses outputs above the size limit', async ({ page }) => {
    const large = new ImageFileDto('large-flat.png');
    const buffer = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 90, g: 120, b: 150 } },
    })
      .png()
      .toBuffer();

    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await uploadGeneratedImageToDropzoneAsync(page, large.fileName, 'image/png', buffer);
    await assertFilesPresentInDropzoneAsync(page, [large]);
    await setUpscaleAsync(page, '4x');
    await clickConversionButtonAsync(page);

    // 16000 x 12000 = 192 MP, above the default 144 MP limit. Refused before any inference.
    const message = page.getByTestId('error-message-holder');
    await expect(message).toContainText('16000x12000');
    await expect(message).toContainText('144 MP limit');
  });

  test('turns off resize width and is hidden for PDF', async ({ page }) => {
    await page.goto('/');
    await setOutputFormatAsync(page, 'JPEG');
    const upscaleSwitch = page.getByTestId('upscale-switch');
    const resizeSwitch = page.getByTestId('resize-width-switch');

    await resizeSwitch.click();
    await expect(page.getByTestId('resize-width-input')).toBeVisible();
    await upscaleSwitch.click();
    await expect(resizeSwitch).toBeDisabled();
    await expect(page.getByTestId('resize-width-input')).toBeHidden();
    await expect(page.getByTestId('resize-width-upscale-hint')).toBeVisible();
    await expect(page.getByTestId('upscale-hint')).toBeVisible();

    await setOutputFormatAsync(page, 'PDF');
    await expect(upscaleSwitch).toBeHidden();
    await expect(resizeSwitch).toBeEnabled();
  });

  test('is disabled when the server has no model', async ({ page }) => {
    await page.route('**/api/upscale_model', (route) =>
      route.fulfill({ json: { models: [
        { id: 'general', model_name: 'realesr-general-x4v3', available: false },
        { id: 'anime', model_name: 'realesr-animevideov3', available: false },
      ] } })
    );

    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');

    await expect(page.getByTestId('upscale-switch')).toBeDisabled();
    await expect(page.getByTestId('upscale-unavailable-hint')).toBeVisible();
  });

  test('chooses general or anime and switches back to the correct model', async ({ page }) => {
    const source = await buildLineCardAsync(160, 90);
    const pixels: Buffer[] = [];
    const models = ['general', 'anime', 'general'] as const;
    for (const [index, model] of models.entries()) {
      const card = new ImageFileDto(`model-${index}.png`);
      await page.goto('/');
      await setOutputFormatAsync(page, 'PNG');
      await uploadGeneratedImageToDropzoneAsync(page, card.fileName, 'image/png', source);
      await setUpscaleAsync(page, '4x');
      await expect(page.getByTestId('upscale-model-option-general')).toHaveAttribute('aria-checked', 'true');
      if (model === 'anime') {
        await page.getByTestId('upscale-model-option-anime').click();
        await expect(page.getByTestId('upscale-model-option-anime')).toHaveAttribute('aria-checked', 'true');
      }
      await page.getByTestId('upscale-info').focus();
      await expect(page.getByRole('tooltip')).toContainText('The built-in AI makes images bigger');
      await expect(page.getByRole('tooltip')).not.toContainText('realesr');
      await expect(page.getByRole('tooltip').locator('a')).toHaveCount(0);
      const output = await convertAndDownloadSingleAsync(page, card, '.png');
      const metadata = await sharp(output).metadata();
      expect([metadata.width, metadata.height]).toEqual([640, 360]);
      pixels.push(await sharp(output).raw().toBuffer());
    }
    expect(pixels[0].equals(pixels[1])).toBe(false);
    expect(pixels[0].equals(pixels[2])).toBe(true);
  });

  test('lets General keep more detail with less noise reduction', async ({ page }) => {
    // A noisy photo crop: the presets differ in how much of the grain they smooth away.
    const source = await sharp(SKYLINE_PHOTO).resize(160, 90, { fit: 'cover' }).jpeg({ quality: 40 }).toBuffer();
    const sent: string[] = [];
    await page.route('**/api/jobs', async (route) => {
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      const match = /name="upscale_model"\r\n\r\n([^\r]+)/.exec(body);
      if (match) sent.push(match[1]);
      await route.continue();
    });
    const outputs: Buffer[] = [];
    for (const [index, level] of (['strong', 'low'] as const).entries()) {
      const photo = new ImageFileDto(`grain-${index}.jpg`);
      await page.goto('/');
      await setOutputFormatAsync(page, 'PNG');
      await uploadGeneratedImageToDropzoneAsync(page, photo.fileName, 'image/jpeg', source);
      await setUpscaleAsync(page, '4x');
      const strong = page.getByTestId('upscale-denoise-option-strong');
      await expect(strong).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('upscale-denoise-hint')).toHaveText('Lower keeps more fine detail, and more noise.');
      if (level === 'low') {
        await page.getByTestId('upscale-denoise-option-low').click();
        await expect(page.getByTestId('upscale-denoise-option-low')).toHaveAttribute('aria-checked', 'true');
      }
      const output = await convertAndDownloadSingleAsync(page, photo, '.png');
      outputs.push(await sharp(output).raw().toBuffer());
    }
    expect(sent).toEqual(['general', 'general-denoise-low']);
    expect(outputs[0].equals(outputs[1])).toBe(false);

    // Anime has no noise setting.
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await setUpscaleAsync(page, '2x');
    await expect(page.getByTestId('upscale-denoise-group')).toBeVisible();
    await page.getByTestId('upscale-model-option-anime').click();
    await expect(page.getByTestId('upscale-denoise-group')).toHaveCount(0);
  });

  test('marks an uninstalled anime model unavailable', async ({ page }) => {
    await page.route('**/api/upscale_model', (route) => route.fulfill({ json: {
      models: [
        { id: 'general', model_name: 'realesr-general-x4v3', available: true },
        { id: 'anime', model_name: 'realesr-animevideov3', available: false },
      ],
    } }));
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    await setUpscaleAsync(page, '2x');
    await expect(page.getByTestId('upscale-model-option-anime')).toBeDisabled();
    await expect(page.getByTestId('upscale-model-option-general')).toHaveAttribute('aria-checked', 'true');
  });
});

async function convertAndDownloadSingleAsync(page: Page, image: ImageFileDto, extension: string): Promise<string> {
  await clickConversionButtonAsync(page);
  await assertZipButtonNotRenderedAsync(page);
  const links = await assertDownloadLinksAsync(page, [image], UPSCALED_SUFFIX);
  const [downloadedPath] = await downloadFilesAsync(page, links);
  expect(path.extname(downloadedPath).toLowerCase()).toBe(extension);
  expect(path.basename(downloadedPath)).toContain(UPSCALED_SUFFIX);
  return downloadedPath;
}

/** Thin dark lines, a filled block and a ring on a light background: easy to blur, easy to measure. */
async function buildLineCardAsync(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3, 242);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const offset = (y * width + x) * 3;
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
  };
  for (let y = 0; y < height / 2; y++) {
    for (let x = 4; x < width; x += 9) set(x, y, 30, 30, 30);
  }
  for (let y = Math.round(height * 0.62); y < Math.round(height * 0.88); y++) {
    for (let x = Math.round(width * 0.12); x < Math.round(width * 0.38); x++) set(x, y, 200, 40, 40);
  }
  const cx = width * 0.7;
  const cy = height * 0.72;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > 30 && distance < 33) set(x, y, 20, 60, 160);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Mean squared response of a 4-neighbour Laplacian on the grey image: higher means crisper edges. */
async function laplacianEnergyAsync(input: string | Buffer): Promise<number> {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => data[(y * info.width + x) * info.channels];
  let total = 0;
  let count = 0;
  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const lap = 4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      total += lap * lap;
      count++;
    }
  }
  return total / count;
}

/** Peak signal-to-noise ratio in dB between two images of the same size. */
async function psnrAsync(a: Buffer, b: Buffer): Promise<number> {
  const first = await sharp(a).removeAlpha().raw().toBuffer();
  const second = await sharp(b).removeAlpha().raw().toBuffer();
  expect(first.length).toBe(second.length);
  let squared = 0;
  for (let i = 0; i < first.length; i++) squared += (first[i] - second[i]) ** 2;
  return 10 * Math.log10((255 * 255) / Math.max(squared / first.length, 1e-9));
}
