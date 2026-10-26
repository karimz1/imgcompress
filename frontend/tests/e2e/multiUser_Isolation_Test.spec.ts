import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import AdmZip from 'adm-zip';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import {
    setOutputFormatAsync,
    uploadBuffersToDropzoneAsync,
    clickConversionButtonAsync,
    clickDownloadZipButtonAndGetUrlAsync,
} from './utls/helpers';

/**
 * E2E: several people use one container at the same time.
 *
 * Every user uploads a file with the SAME name ("photo.png") but a different
 * colour and size, converts at the same moment and downloads the result.
 * Each user must get back exactly their own pixels, as a single file and as
 * the ZIP. The colour makes a mix-up visible even when names and sizes match.
 */

const FILE_NAME = 'photo.png';
const USERS = [
    { colour: { r: 220, g: 20, b: 20 }, width: 120, height: 80 },
    { colour: { r: 20, g: 180, b: 20 }, width: 96, height: 64 },
    { colour: { r: 20, g: 20, b: 220 }, width: 80, height: 120 },
    { colour: { r: 230, g: 200, b: 20 }, width: 64, height: 64 },
];

type Rgb = { r: number; g: number; b: number };

async function solidPng(user: (typeof USERS)[number]): Promise<Buffer> {
    return sharp({
        create: { width: user.width, height: user.height, channels: 3, background: user.colour },
    }).png().toBuffer();
}

async function describeImage(data: Buffer): Promise<{ width: number; height: number; centre: Rgb }> {
    const image = sharp(data).removeAlpha();
    const { width = 0, height = 0 } = await image.metadata();
    const { data: raw, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    return { width, height, centre: { r: raw[offset], g: raw[offset + 1], b: raw[offset + 2] } };
}

function expectColour(actual: Rgb, expected: Rgb, who: string) {
    for (const channel of ['r', 'g', 'b'] as const) {
        expect(Math.abs(actual[channel] - expected[channel]), `${who}: ${channel} channel`).toBeLessThanOrEqual(12);
    }
}

// The "Download all" button only appears for two or more files, so ZIP tests add a second one.
const SECOND_FILE_NAME = 'logo.png';
const ZIP_ROUNDS = 10;

async function convertAsUser(browser: Browser, index: number, withSecondFile = false) {
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();
    await page.goto('/');
    await setOutputFormatAsync(page, 'PNG');
    const png = await solidPng(USERS[index]);
    const names = withSecondFile ? [FILE_NAME, SECOND_FILE_NAME] : [FILE_NAME];
    await uploadBuffersToDropzoneAsync(page, names.map((name) => ({ name, mimeType: 'image/png', buffer: png })));
    return { context, page };
}

async function clickConvertTogether(sessions: { page: Page }[]) {
    const responses = sessions.map(({ page }) =>
        page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/api/compress'))
    );
    await Promise.all(sessions.map(({ page }) => clickConversionButtonAsync(page)));
    const bodies = await Promise.all(
        responses.map(async (promise, index) => {
            const response = await promise;
            expect(response.ok(), `user ${index}: /api/compress failed`).toBeTruthy();
            return response.json();
        })
    );
    await Promise.all(
        sessions.map(({ page }) => expect(page.getByTestId('compressed-files-drawer-close-btn')).toBeVisible())
    );
    return bodies as { dest_folder: string; converted_files: string[] }[];
}

test('users converting files with the same name at the same time only get their own image back', async ({ browser }) => {
    const sessions = await Promise.all(USERS.map((_, index) => convertAsUser(browser, index)));
    try {
        const bodies = await clickConvertTogether(sessions);
        expect(new Set(bodies.map((b) => b.dest_folder)).size, 'two users shared one output folder').toBe(USERS.length);

        await Promise.all(
            sessions.map(async ({ page }, index) => {
                const link = page.getByTestId('drawer-uploaded-file-item-link');
                await expect(link).toHaveCount(1);
                const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
                const image = await describeImage(await fs.readFile((await download.path())!));
                expect([image.width, image.height], `user ${index}: wrong size`).toEqual([USERS[index].width, USERS[index].height]);
                expectColour(image.centre, USERS[index].colour, `user ${index} single download`);
            })
        );
    } finally {
        await Promise.all(sessions.map(({ context }) => context.close()));
    }
});

// Regression: the ZIP used to be written to the shared temp dir as
// converted_<unix-seconds>.zip, so users who clicked "Download all" in the same
// second shared one file and could receive another user's images.
test('users clicking "Download all" at the same time only get their own ZIP', async ({ browser }) => {
    const sessions = await Promise.all(USERS.map((_, index) => convertAsUser(browser, index, true)));
    try {
        await clickConvertTogether(sessions);
        // The overlap window is short, so click together a few times.
        const problems: string[] = [];
        for (let round = 0; round < ZIP_ROUNDS; round++) {
            const zipPaths = await Promise.all(sessions.map(({ page }) => clickDownloadZipButtonAndGetUrlAsync(page)));
            for (const [index, zipPath] of zipPaths.entries()) {
                const who = `round ${round}, user ${index}`;
                try {
                    const entry = new AdmZip(zipPath).getEntry(FILE_NAME);
                    if (!entry) {
                        problems.push(`${who}: ${FILE_NAME} missing from ZIP`);
                        continue;
                    }
                    const image = await describeImage(entry.getData());
                    const expected = USERS[index].colour;
                    const same = (['r', 'g', 'b'] as const).every((c) => Math.abs(image.centre[c] - expected[c]) <= 12);
                    if (!same) problems.push(`${who}: got colour ${JSON.stringify(image.centre)}`);
                } catch (error) {
                    problems.push(`${who}: broken ZIP (${error})`);
                }
            }
        }
        expect(problems, 'users received another user\'s ZIP').toEqual([]);
    } finally {
        await Promise.all(sessions.map(({ context }) => context.close()));
    }
});

// Regression: /api/download used to accept the temp root as "folder", so anyone
// could fetch another user's ZIP by trying converted_<unix-seconds>.zip.
test('a second user cannot download the first user\'s ZIP by guessing its name', async ({ browser, request }) => {
    const owner = await convertAsUser(browser, 0, true);
    try {
        await clickConvertTogether([owner]);
        const before = Math.floor(Date.now() / 1000);
        const zipResponse = owner.page.waitForResponse((r) => r.url().includes('/api/download_all'));
        await clickDownloadZipButtonAndGetUrlAsync(owner.page);
        expect((await zipResponse).ok()).toBeTruthy();

        // The other user knows nothing but the server's temp dir (default /tmp) and the clock.
        const tempDir = process.env.IMGCOMPRESS_TEMP_DIR ?? '/tmp';
        const hits: string[] = [];
        for (let ts = before - 2; ts <= Math.floor(Date.now() / 1000) + 1; ts++) {
            const name = `converted_${ts}.zip`;
            const res = await request.get(`/api/download?folder=${encodeURIComponent(tempDir)}&file=${name}`);
            if (res.ok()) hits.push(name);
        }
        expect(hits, 'another user\'s ZIP was downloadable by guessing').toEqual([]);
    } finally {
        await owner.context.close();
    }
});

// Editor pictures live in a per-session folder behind an unguessable token,
// so users with the same file names never see each other's.
test('users placing images on their own background picture at the same time only get their own', async ({ browser }) => {
    const backgroundOf = (index: number) => USERS[(index + 1) % USERS.length].colour;
    const sessions = await Promise.all(
        USERS.map(async (_, index) => {
            const session = await convertAsUser(browser, index);
            const { page } = session;
            await page.getByTestId('dropzone-crop-file-btn').click();
            await page.getByTestId('crop-tab-fit').click();
            await page.getByTestId('fit-preset-custom').click();
            await page.getByTestId('fit-width-input').fill('200');
            await page.getByTestId('fit-height-input').fill('200');
            const background = await sharp({
                create: { width: 60, height: 40, channels: 3, background: backgroundOf(index) },
            }).png().toBuffer();
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                page.getByTestId('fit-mode-image-btn').click(),
            ]);
            // Same name for everyone.
            await chooser.setFiles({ name: 'background.png', mimeType: 'image/png', buffer: background });
            await expect(page.getByTestId('crop-save-btn')).toBeEnabled();
            // Picking the picture opens the background tab; the scale is in the size tab.
            await page.getByTestId('crop-tab-fit').click();
            await page.getByTestId('fit-scale-input').fill('40');
            await expect(page.getByTestId('crop-blur-canvas')).toHaveAttribute('data-current', 'true');
            await expect(page.getByTestId('crop-save-btn')).toBeEnabled();
            await page.getByTestId('crop-save-btn').click();
            return session;
        })
    );
    try {
        // Exports are rendered by /api/crop/fit right before /api/compress.
        await clickConvertTogether(sessions);
        await Promise.all(
            sessions.map(async ({ page }, index) => {
                const link = page.getByTestId('drawer-uploaded-file-item-link');
                await expect(link).toHaveCount(1);
                const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
                const data = await fs.readFile((await download.path())!);
                const image = await describeImage(data);
                expect([image.width, image.height], `user ${index}: wrong size`).toEqual([200, 200]);
                expectColour(image.centre, USERS[index].colour, `user ${index} image`);
                const { data: raw, info } = await sharp(data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
                const corner = { r: raw[(5 * info.width + 5) * 3], g: raw[(5 * info.width + 5) * 3 + 1], b: raw[(5 * info.width + 5) * 3 + 2] };
                expectColour(corner, backgroundOf(index), `user ${index} background`);
            })
        );
    } finally {
        await Promise.all(sessions.map(({ context }) => context.close()));
    }
});

// Same for pictures placed on top: everyone uploads "sticker.png" in their own
// colour at once, and each export carries only that user's sticker.
test('users adding picture layers at the same time only get their own', async ({ browser }) => {
    const stickerOf = (index: number) => USERS[(index + 2) % USERS.length].colour;
    const sessions = await Promise.all(
        USERS.map(async (_, index) => {
            const session = await convertAsUser(browser, index);
            const { page } = session;
            await page.getByTestId('dropzone-crop-file-btn').click();
            await page.getByTestId('crop-tab-fit').click();
            await page.getByTestId('fit-preset-custom').click();
            await page.getByTestId('fit-width-input').fill('200');
            await page.getByTestId('fit-height-input').fill('200');
            await page.getByTestId('fit-mode-transparent-btn').click();
            await page.getByTestId('crop-tab-layers').click();
            const sticker = await sharp({
                create: { width: 50, height: 50, channels: 3, background: stickerOf(index) },
            }).png().toBuffer();
            const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/editor/assets'));
            await page.getByTestId('fit-picture-input').setInputFiles({ name: 'sticker.png', mimeType: 'image/png', buffer: sticker });
            expect((await uploaded).ok(), `user ${index}: upload failed`).toBeTruthy();
            await expect(page.getByTestId('fit-layer-row')).toHaveCount(1);
            await expect(page.getByTestId('crop-blur-canvas')).toHaveAttribute('data-current', 'true');
            await expect(page.getByTestId('crop-save-btn')).toBeEnabled();
            await page.getByTestId('crop-save-btn').click();
            return session;
        })
    );
    try {
        await clickConvertTogether(sessions);
        await Promise.all(
            sessions.map(async ({ page }, index) => {
                const link = page.getByTestId('drawer-uploaded-file-item-link');
                await expect(link).toHaveCount(1);
                const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
                const image = await describeImage(await fs.readFile((await download.path())!));
                expect([image.width, image.height], `user ${index}: wrong size`).toEqual([200, 200]);
                // New pictures start in the middle of the canvas.
                expectColour(image.centre, stickerOf(index), `user ${index} sticker`);
            })
        );
    } finally {
        await Promise.all(sessions.map(({ context }) => context.close()));
    }
});

test("a picture id from someone else's session cannot be used", async ({ browser }) => {
    const owner = await browser.newContext();
    const stranger = await browser.newContext();
    try {
        const picture = (colour: Rgb) =>
            sharp({ create: { width: 20, height: 20, channels: 3, background: colour } }).png().toBuffer();
        const upload = async (context: BrowserContext, colour: Rgb) => {
            const response = await context.request.post('/api/editor/assets', {
                multipart: { file: { name: 'secret.png', mimeType: 'image/png', buffer: await picture(colour) } },
            });
            expect(response.status()).toBe(200);
            expect(response.headers()['cache-control']).toContain('no-store');
            return (await response.json()) as { session: string; asset: string };
        };
        const mine = await upload(owner, USERS[0].colour);
        const theirs = await upload(stranger, USERS[1].colour);
        expect(theirs.session).not.toBe(mine.session);

        const photo = await picture(USERS[2].colour);
        const fitWith = (session: string, asset: string) =>
            stranger.request.post('/api/crop/fit', {
                multipart: {
                    file: { name: 'photo.png', mimeType: 'image/png', buffer: photo },
                    fit_width: '40',
                    fit_height: '40',
                    fit_mode: 'transparent',
                    fit_session: session,
                    fit_layers: JSON.stringify([
                        { type: 'image', asset, x: 0.5, y: 0.5, width: 0.5, height: 0.5, rotation: 0, opacity: 1 },
                    ]),
                },
            });
        // Their own picture works, so the request itself is fine.
        expect((await fitWith(theirs.session, theirs.asset)).status()).toBe(200);
        // The owner's picture id in the stranger's own session is unknown there.
        const wrongSession = await fitWith(theirs.session, mine.asset);
        expect(wrongSession.ok()).toBeFalsy();
        // A made-up session token finds nothing either.
        const guessed = await fitWith('A'.repeat(32), mine.asset);
        expect(guessed.ok()).toBeFalsy();
        // Pictures are never listed or served: these paths only get the app page back.
        for (const url of ['/api/editor/assets', `/api/editor/assets/${mine.asset}`, `/api/editor/assets/${mine.session}`]) {
            const response = await stranger.request.get(url);
            expect(response.headers()['content-type'] ?? '').not.toMatch(/^image\//);
            const body = await response.body();
            expect(body.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47])), `${url} returned a PNG`).toBe(false);
            expect(body.toString('utf8')).not.toContain(mine.asset);
        }
    } finally {
        await owner.close();
        await stranger.close();
    }
});
