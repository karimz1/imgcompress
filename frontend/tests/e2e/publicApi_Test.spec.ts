import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// One spec for every API mode: it reads the mode from the running container, then
// checks that mode in a real browser.
//   - default (off): docs answer 404, other websites are refused, the web UI works
//   - on: Swagger UI loads offline, other websites may call the API (CORS)
//   - on + PUBLIC_API_KEY: other callers need the key (E2E_API_KEY); the web UI still works
//   - API_ONLY + key: no web UI, spoofed same-origin headers still need the key, health stays open

type Mode = { publicApi: boolean; keyRequired: boolean; apiOnly: boolean };

async function readModeAsync(request: APIRequestContext): Promise<Mode> {
  const docs = await request.get('/api/v1/docs');
  const info = await request.get('/api/v1/info');
  const root = await request.get('/');
  const type = root.headers()['content-type'] ?? '';
  let apiOnly = false;
  if (type.includes('application/json')) {
    try {
      const body = await root.json();
      apiOnly = typeof body?.message === 'string' && body.message.includes('API only');
    } catch {
      apiOnly = false;
    }
  }
  return { publicApi: docs.status() === 200, keyRequired: info.status() === 401, apiOnly };
}

// localhost and 127.0.0.1 are different sites to the browser, so a page on one
// calling the other is exactly "another website" without any extra server.
function otherSiteOrigin(baseURL: string): string | null {
  const url = new URL(baseURL);
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  else if (url.hostname === '127.0.0.1') url.hostname = 'localhost';
  else return null;
  return url.origin;
}

// Cross-origin, JavaScript can only read safelisted headers, so `cors` is only
// meaningful same-origin; a readable status is what proves CORS let it through.
async function fetchFromPageAsync(page: Page, url: string, headers: Record<string, string> = {}) {
  return page.evaluate(async ({ url, headers }) => {
    try {
      const response = await fetch(url, { headers });
      return { status: response.status, cors: response.headers.get('access-control-allow-origin') };
    } catch {
      return { status: 0, cors: null }; // the browser hid the answer (no CORS)
    }
  }, { url, headers });
}

test('the API mode of this container behaves as documented', async ({ page, request, baseURL }) => {
  const mode = await readModeAsync(request);
  const key = process.env.E2E_API_KEY ?? '';
  test.info().annotations.push({ type: 'api-mode', description: JSON.stringify(mode) });
  if (mode.keyRequired) expect(key, 'set E2E_API_KEY to the container PUBLIC_API_KEY').not.toBe('');

  // Health checks never need the key, including the deprecated /api/health/backend alias.
  expect((await request.get('/api/v1/health')).status()).toBe(200);
  expect((await request.get('/api/health/backend')).status()).toBe(200);

  if (mode.apiOnly) {
    expect(mode.publicApi).toBe(true);
    expect(mode.keyRequired).toBe(true);
    const root = await request.get('/');
    expect(root.status()).toBe(200);
    expect(root.headers()['content-type'] || '').toContain('application/json');
    expect((await root.json()).message).toContain('/api/v1/docs');
    // Flask also serves the UI at /static; that path must stay hidden too.
    for (const path of ['/static/index.html', '/index.html', '/config/runtime.json']) {
      const hidden = await request.get(path);
      expect(hidden.status(), path).toBe(404);
      expect(hidden.headers()['content-type'] || '').toContain('application/json');
      expect((await hidden.json()).message).toContain('/api/v1/docs');
    }
    const spoofed = await request.get('/api/v1/info', { headers: { 'Sec-Fetch-Site': 'same-origin' } });
    expect(spoofed.status()).toBe(401);
  } else {
    // The web UI itself: same origin, never needs the key.
    await page.goto('/');
    const own = await fetchFromPageAsync(page, '/api/v1/info');
    expect(own.status).toBe(200);
    // CORS headers only exist once other websites are allowed.
    expect(own.cors).toBe(mode.publicApi ? '*' : null);
  }

  const other = otherSiteOrigin(baseURL!);
  test.skip(other === null, 'needs a localhost base URL to act as another website');
  await page.goto(`${other}/`);
  const apiUrl = `${new URL(baseURL!).origin}/api/v1/formats`;
  const crossSite = await fetchFromPageAsync(page, apiUrl);

  if (!mode.publicApi) {
    expect(crossSite.status).toBe(0);
    const refused = await request.get('/api/v1/formats', { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(refused.status()).toBe(403);
    return;
  }

  if (mode.keyRequired) {
    // A readable status at all means the browser accepted the CORS answer.
    expect(crossSite.status).toBe(401);
    const withKey = await fetchFromPageAsync(page, apiUrl, { Authorization: `Bearer ${key}` });
    expect(withKey.status).toBe(200);
    const header = await fetchFromPageAsync(page, apiUrl, { 'X-API-Key': key });
    expect(header.status).toBe(200);
  } else {
    expect(crossSite.status).toBe(200);
  }
});

test('Swagger UI loads from the container and lists the API', async ({ page, request, baseURL }) => {
  const mode = await readModeAsync(request);
  if (!mode.publicApi) {
    expect((await request.get('/api/v1/docs')).status()).toBe(404);
    expect((await request.get('/api/v1/openapi.json')).status()).toBe(404);
    return;
  }

  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) outside.push(r.url());
  });

  await page.goto('/api/v1/docs');
  await expect(page.locator('.swagger-ui .info .title')).toContainText('imgcompress', { timeout: 30_000 });
  const operation = (path: string) => page.locator(`.opblock-summary-path[data-path="${path}"]`).first();
  await expect(operation('/convert')).toBeVisible();
  await expect(operation('/jobs')).toBeVisible();
  await expect(page.getByRole('button', { name: /Authorize/ })).toBeVisible();

  // Open one operation: its description and parameters are documented.
  await operation('/convert').click();
  await expect(page.locator('.opblock-description-wrapper').first()).toContainText('curl');
  expect(outside, 'Swagger UI must work offline').toEqual([]);

  const spec = await (await request.get('/api/v1/openapi.json')).json();
  expect(spec.openapi).toBe('3.1.0');
  await page.screenshot({ path: test.info().outputPath('swagger-ui.png'), fullPage: false });
});
