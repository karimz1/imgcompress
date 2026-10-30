// The browser preview has to show the size the backend really creates, so these
// cases mirror tests/unit/test_ai_upscaling.py (backend plan_upscale).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MAX_OUTPUT_MEGAPIXELS,
  isLargeUpscaleTarget,
  planUpscale,
} from '../../frontend/src/lib/upscalePlan.ts';

const LIMIT = DEFAULT_MAX_OUTPUT_MEGAPIXELS * 1_000_000;
const size = (width, height) => ({ width, height });

test('the default limit matches the backend app.json', () => {
  assert.equal(DEFAULT_MAX_OUTPUT_MEGAPIXELS, 144);
});

test('multipliers and frame targets give the backend output size', () => {
  const cases = [
    [[640, 360], '2x', [1280, 720]],
    [[640, 360], '4x', [2560, 1440]],
    [[640, 360], '8x', [5120, 2880]],
    [[1280, 720], '4k', [3840, 2160]],
    [[1280, 720], '1080p', [1920, 1080]],
    [[720, 1280], '4k', [2160, 3840]],
    [[1000, 1000], '4k', [2160, 2160]],
    [[800, 200], '1080p', [1920, 480]],
    [[1280, 720], '6k', [5760, 3240]],
    [[1280, 720], '8k', [7680, 4320]],
    [[3840, 2160], '16k', [15360, 8640]],
    [[3840, 2160], '4x', [15360, 8640]],
    [[1920, 1080], '8x', [15360, 8640]],
    [[2160, 3840], '16k', [8640, 15360]],
    // The E2E aspect-ratio cases.
    [[80, 60], '8x', [640, 480]],
    [[80, 120], '1080p', [1080, 1620]],
    [[80, 80], '4k', [2160, 2160]],
    [[120, 80], '6k', [4860, 3240]],
    [[120, 40], '8k', [7680, 2560]],
    [[20, 120], '16k', [2560, 15360]],
  ];
  for (const [[w, h], target, [ow, oh]] of cases) {
    assert.deepEqual(planUpscale(w, h, target, LIMIT), { kind: 'resize', from: size(w, h), to: size(ow, oh) }, `${w}x${h} ${target}`);
  }
});

test('half pixels round like Python round(), to the even number', () => {
  // 19 * (1080 / 16) = 1282.5, Python gives 1282 where Math.round gives 1283.
  assert.deepEqual(planUpscale(16, 19, '1080p', LIMIT).to, size(1080, 1282));
  // 3 * (1920 / 256) = 22.5 -> 22.
  assert.deepEqual(planUpscale(3, 256, '1080p', LIMIT).to, size(22, 1920));
});

test('images that already meet a frame stay as they are, never shrunk', () => {
  const cases = [
    [[3840, 2160], '4k'],
    [[2000, 1200], '1080p'],
    [[5760, 3240], '6k'],
    [[4320, 7680], '8k'],
    [[15360, 8640], '16k'],
    [[16000, 9000], '16k'],
  ];
  for (const [[w, h], target] of cases) {
    assert.deepEqual(planUpscale(w, h, target, 36_000_000), { kind: 'unchanged', from: size(w, h) }, `${w}x${h} ${target}`);
  }
});

test('frame targets keep the aspect ratio inside the frame', () => {
  const frames = { '1080p': [1920, 1080], '4k': [3840, 2160], '6k': [5760, 3240], '8k': [7680, 4320], '16k': [15360, 8640] };
  for (const [target, [long, short]] of Object.entries(frames)) {
    for (const [w, h] of [[640, 480], [480, 640], [100, 100], [800, 200], [200, 800], [321, 227]]) {
      const { to } = planUpscale(w, h, target, LIMIT);
      assert.ok(Math.max(to.width, to.height) <= long && Math.min(to.width, to.height) <= short);
      assert.ok(Math.max(to.width, to.height) === long || Math.min(to.width, to.height) === short);
      assert.ok(Math.abs(to.width * h - to.height * w) <= Math.max(w, h) / 2);
    }
  }
});

test('outputs above the limit are flagged with the size they would have', () => {
  assert.deepEqual(planUpscale(4000, 3000, '4x', 36_000_000), { kind: 'tooLarge', from: size(4000, 3000), to: size(16000, 12000) });
  // Exactly at the limit is still allowed, like the backend's ">".
  assert.equal(planUpscale(3000, 2000, '2x', 24_000_000).kind, 'resize');
  assert.equal(planUpscale(3000, 2001, '2x', 24_000_000).kind, 'tooLarge');
});

test('no pixels means no plan', () => {
  assert.equal(planUpscale(0, 100, '2x', LIMIT), null);
  assert.equal(planUpscale(100, -1, '4k', LIMIT), null);
});

test('8x, 6K, 8K and 16K count as large targets', () => {
  assert.deepEqual(['2x', '4x', '8x', '1080p', '4k', '6k', '8k', '16k'].filter(isLargeUpscaleTarget), ['8x', '6k', '8k', '16k']);
});
