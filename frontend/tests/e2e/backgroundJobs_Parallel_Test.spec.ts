import AdmZip from 'adm-zip';
import { expect, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';
import { clearStorageManagerAsync } from './utls/helpers';

// Many conversions run as background jobs at the same time, from one user and
// from several. Every image has its own colour and size, so a job that hands
// back someone else's file is caught by its pixels, not just by its name.

type Rgb = { r: number; g: number; b: number };
type Picture = { name: string; colour: Rgb; width: number; height: number };
type Job = { id: string; token: string };
type JobState = { id: string; status: string; result?: { converted_files: string[] } };

const ACTIVE = ['queued', 'running'];

async function solidPng({ colour, width, height }: Picture): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
}

async function describeImage(data: Buffer): Promise<{ width: number; height: number; centre: Rgb }> {
  const { data: raw, info } = await sharp(data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  return { width: info.width, height: info.height, centre: { r: raw[offset], g: raw[offset + 1], b: raw[offset + 2] } };
}

function expectColour(actual: Rgb, expected: Rgb, who: string) {
  for (const channel of ['r', 'g', 'b'] as const) {
    expect(Math.abs(actual[channel] - expected[channel]), `${who}: ${channel} channel`).toBeLessThanOrEqual(12);
  }
}

async function startJobAsync(request: APIRequestContext, pictures: Picture[], extra: Record<string, string> = {}): Promise<Job> {
  const form = new FormData();
  form.append('format', 'png');
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  for (const picture of pictures) {
    form.append('files[]', new Blob([new Uint8Array(await solidPng(picture))], { type: 'image/png' }), picture.name);
  }
  const response = await request.post('/api/jobs', { multipart: form });
  expect(response.status(), await response.text()).toBe(202);
  const body = await response.json();
  return { id: body.id, token: body.token };
}

async function statusAsync(request: APIRequestContext, job: Job): Promise<JobState> {
  const response = await request.get(`/api/jobs/${job.id}`, { headers: { 'X-Job-Token': job.token } });
  expect(response.status()).toBe(200);
  return response.json();
}

async function waitDoneAsync(request: APIRequestContext, job: Job): Promise<JobState> {
  await expect.poll(async () => (await statusAsync(request, job)).status, { intervals: [250, 500, 1000] }).toBe('done');
  return statusAsync(request, job);
}

async function downloadAsync(request: APIRequestContext, job: Job, file: string): Promise<Buffer> {
  const response = await request.get(`/api/jobs/${job.id}/files/${encodeURIComponent(file)}`, { headers: { 'X-Job-Token': job.token } });
  expect(response.status()).toBe(200);
  return response.body();
}

async function zipAsync(request: APIRequestContext, job: Job): Promise<AdmZip> {
  const response = await request.get(`/api/jobs/${job.id}/zip`, { headers: { 'X-Job-Token': job.token } });
  expect(response.status()).toBe(200);
  return new AdmZip(await response.body());
}

async function expectJobIsHiddenAsync(request: APIRequestContext, job: Job, token: string | undefined, file: string) {
  const headers = token === undefined ? undefined : { 'X-Job-Token': token };
  for (const url of [`/api/jobs/${job.id}`, `/api/jobs/${job.id}/files/${file}`, `/api/jobs/${job.id}/zip`]) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(404);
    expect(await response.json()).toEqual({ error: 'Job not found. It may have expired.' });
  }
}

const PALETTE: Rgb[] = [
  { r: 220, g: 20, b: 20 },
  { r: 20, g: 180, b: 20 },
  { r: 20, g: 20, b: 220 },
  { r: 230, g: 200, b: 20 },
  { r: 200, g: 20, b: 200 },
  { r: 20, g: 200, b: 200 },
];

test.describe('Parallel background jobs', () => {
  test.beforeEach(async ({ request }) => {
    await clearStorageManagerAsync(request);
  });

  test('one user starting six conversions at once gets every result from its own job', async ({ page }) => {
    await page.goto('/');
    const batches = PALETTE.map((colour, i) => [
      { name: `photo-${i}.png`, colour, width: 60 + i * 10, height: 40 + i * 6 },
      // A second file with the same name in every job: only the colour tells them apart.
      { name: 'logo.png', colour, width: 30 + i, height: 30 + i },
    ]);
    const jobs = await Promise.all(batches.map((pictures) => startJobAsync(page.request, pictures)));
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
    expect(new Set(jobs.map((j) => j.token)).size).toBe(jobs.length);

    const states = await Promise.all(jobs.map((job) => waitDoneAsync(page.request, job)));
    for (const [i, state] of states.entries()) {
      const who = `job ${i}`;
      expect(state.id, who).toBe(jobs[i].id);
      expect([...state.result!.converted_files].sort(), who).toEqual(['logo.png', `photo-${i}.png`]);
      const zip = await zipAsync(page.request, jobs[i]);
      expect(zip.getEntries().map((e) => e.entryName).sort(), who).toEqual(['logo.png', `photo-${i}.png`]);
      for (const picture of batches[i]) {
        for (const [where, data] of [
          ['single file', await downloadAsync(page.request, jobs[i], picture.name)],
          ['zip', zip.getEntry(picture.name)!.getData()],
        ] as const) {
          const image = await describeImage(data);
          expect([image.width, image.height], `${who} ${picture.name} ${where}`).toEqual([picture.width, picture.height]);
          expectColour(image.centre, picture.colour, `${who} ${picture.name} ${where}`);
        }
      }
      // Another job's token never opens this job, even from the same browser.
      await expectJobIsHiddenAsync(page.request, jobs[i], jobs[(i + 1) % jobs.length].token, `photo-${i}.png`);
    }
  });

  test('upscales from three users overlap and each user only gets their own back', async ({ browser }) => {
    // AI upscales take turns on the CPU, so while the first one runs the others
    // are still waiting: all three jobs are active at the same moment.
    const users = await Promise.all(PALETTE.slice(0, 3).map(() => browser.newContext()));
    try {
      const pictures = PALETTE.slice(0, 3).map((colour) => ({ name: 'photo.png', colour, width: 480, height: 270 }));
      const jobs = await Promise.all(users.map((user, i) => startJobAsync(user.request, [pictures[i]], { upscale: '2x', upscale_model: 'general' })));

      const first = await Promise.all(users.map((user, i) => statusAsync(user.request, jobs[i])));
      expect(first.map((s) => s.status).every((s) => ACTIVE.includes(s)), JSON.stringify(first)).toBe(true);

      // While Alice's upscale is still active, Bob cannot reach it with his own token or none.
      const [alice, bob] = users;
      await expectJobIsHiddenAsync(bob.request, jobs[0], jobs[1].token, 'photo_ai-upscaled.png');
      await expectJobIsHiddenAsync(bob.request, jobs[0], undefined, 'photo_ai-upscaled.png');
      expect(ACTIVE).toContain((await statusAsync(alice.request, jobs[0])).status);

      const states = await Promise.all(users.map((user, i) => waitDoneAsync(user.request, jobs[i])));
      for (const [i, state] of states.entries()) {
        const who = `user ${i}`;
        expect(state.result!.converted_files, who).toEqual(['photo_ai-upscaled.png']);
        for (const [where, data] of [
          ['single file', await downloadAsync(users[i].request, jobs[i], 'photo_ai-upscaled.png')],
          ['zip', (await zipAsync(users[i].request, jobs[i])).getEntry('photo_ai-upscaled.png')!.getData()],
        ] as const) {
          const image = await describeImage(data);
          expect([image.width, image.height], `${who} ${where}`).toEqual([960, 540]);
          expectColour(image.centre, pictures[i].colour, `${who} ${where}`);
        }
      }
      // Finished jobs stay private too.
      await expectJobIsHiddenAsync(bob.request, jobs[0], jobs[1].token, 'photo_ai-upscaled.png');
    } finally {
      await Promise.all(users.map((user) => user.close()));
    }
  });
});
