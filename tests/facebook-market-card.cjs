const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const sharp = require('sharp');
const express = require('express');

async function load(db) {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: "export * from './server/services/facebook-market-card.service'; export {default as router} from './server/routes/facebook-card.routes';" }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated-db', setup(b) {
    b.onLoad({ filter: /server[\\/]db\.ts$/ }, () => ({ contents: 'export const supabase = globalThis.__facebookFixtureDb;', loader: 'js' }));
  } }] });
  globalThis.__facebookFixtureDb = db;
  const mod = new Module(path.join(process.cwd(), 'tests/facebook-card-isolated.cjs'), module); mod.paths = module.paths;
  mod._compile(bundle.outputFiles[0].text, mod.id); delete globalThis.__facebookFixtureDb;
  return mod.exports;
}
async function main() {
  const lib = await load(null), now = new Date('2026-11-04T16:00:00Z');
  const rows = Array.from({ length: 9 }, (_, i) => {
    const at = new Date(Date.parse('2026-11-04T06:00:00Z') + i * 3600000).toISOString();
    return { recorded_at: at, usd: 10.24 + Math.sin(i * .8) * .045, rates: { USD: 99, USD_CHECKS: 10.7 - i * .006, EUR: 11.35 + Math.sin(i * .7) * .04, GBP: 13, GOLD_SCRAP_18: 820, SILVER_CAST_1000: 12 },
      last_changed: { USD: at, USD_CHECKS: at, EUR: at, GBP: '2026-11-03T14:00:00Z', GOLD_SCRAP_18: at, SILVER_CAST_1000: '2026-11-03T14:00:00Z' } };
  });
  const history = Array.from({ length: 19 }, (_, i) => {
    const at = new Date(now.getTime() - (48 - i * 1.5) * 3600000).toISOString();
    return { recorded_at: at, usd: 10.25 + Math.sin(i) * .055, rates: { USD_CHECKS: 10.58 + Math.cos(i) * .035, EUR: 11.24 + Math.sin(i * .7) * .045 },
      last_changed: { USD: at, USD_CHECKS: at, EUR: at } };
  });
  const outside = new Date(now.getTime() - 48 * 3600000 - 1).toISOString();
  const old = { recorded_at: outside, usd: 999, last_changed: { USD: outside } };
  const card = lib.buildFacebookMarketCard([old, ...history, ...rows], now);
  assert.equal(card.end - card.start, 48 * 3600000);
  assert.equal(card.items[0].points[0].at, card.start);
  assert(!card.items[0].points.some(p => p.value === 999));
  assert.deepEqual(card.items.map(i => i.id), ['USD', 'USD_CHECKS', 'EUR', 'GOLD_SCRAP_18']);
  assert.equal(card.items[0].value, rows.at(-1).usd, 'USD column is authoritative');
  assert.equal(card.items[0].points.length, 9 + history.length);
  assert(!card.caption.includes('جنيه إسترليني')); assert(!card.caption.includes('فضة'));
  assert(!card.caption.includes('مقارنة بآخر نشرة')); assert(!/https?:|www\./.test(card.caption));
  assert.equal(card.items[1].previous, rows.at(-2).rates.USD_CHECKS);
  assert(card.items[1].change < 0);
  assert(card.items[0].change > 0);
  const withBoundary = lib.buildFacebookMarketCard([rows[0]], now, old).items[0];
  assert.equal(withBoundary.previous, 999);
  assert.equal(withBoundary.points.length, 1, 'Off-chart previous observation is not drawn');
  const carry = { ...rows.at(-1), recorded_at: '2026-11-04T15:00:00Z' };
  assert.equal(lib.buildFacebookMarketCard([...rows, carry], now).items[0].points.length, 9, 'Carried snapshots do not invent observations');
  assert.equal(lib.buildFacebookMarketCard([rows[0]], now).items[0].change, null);
  assert.equal(lib.buildFacebookMarketCard([{ ...carry, last_changed: {} }], now).items.length, 0);
  assert.equal(lib.buildFacebookMarketCard([{ ...carry, last_changed: { USD: '2026-11-05T00:00:00Z' } }], now).items.length, 0);
  assert.equal(lib.buildFacebookMarketCard(rows, new Date('2026-11-04T22:00:00Z')).items.length, 0, 'Tripoli midnight excludes yesterday');
  assert.equal(lib.buildFacebookMarketCard([rows[0], { ...rows[0], recorded_at: '2026-11-04T08:00:00Z', last_changed: { USD: '2026-11-04T08:00:00Z' } }], now).items[0].change, 0);
  const image = await lib.renderFacebookMarketCard(card), meta = await sharp(image).metadata();
  assert.equal(meta.width, 1600); assert(meta.height >= 1000 && meta.height <= 5000); assert(image.length < 5 * 1024 * 1024);
  const corner = await sharp(image).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.deepEqual([...corner], [255, 255, 255], 'Publication background is white');
  const series = card.items.slice(0, 3), values = series.flatMap(i => i.points.map(p => p.value));
  const low = Math.min(...values), high = Math.max(...values), pad = Math.max((high - low) * .12, low * .001);
  const first = card.start;
  const colors = [[8, 124, 89], [49, 95, 180], [174, 101, 22]];
  for (const [i, item] of series.entries()) {
    const x = 2 * (65 + (item.changedAt - first) / (card.end - first) * 600);
    const y = 2 * (626 - (item.value - (low - pad)) / (high - low + 2 * pad) * 244);
    const pixel = await sharp(image).extract({ left: Math.round(x), top: Math.round(y), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], colors[i], `${item.id} endpoint uses the common price/time axes and its fixed color`);
  }
  const dir = path.join(os.tmpdir(), 'Dollar-facebook-market'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'market-sample.png'), image);
  await sharp(image).resize({ width: 640 }).toFile(path.join(dir, 'market-preview.png'));
  await fs.writeFile(path.join(dir, 'sample-caption.txt'), card.caption);
  await lib.renderFacebookMarketCard(lib.buildFacebookMarketCard([rows[0]], now));
  await lib.renderFacebookMarketCard(lib.buildFacebookMarketCard([{ ...rows[0], last_changed: { GOLD_SCRAP_18: rows[0].recorded_at } }], now));

  let reads = 0;
  const query = { select() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, range() { return this; }, abortSignal() { reads++; return Promise.resolve({ data: [], error: null }); } };
  const service = await load({ from: () => query });
  const app = express(); app.use('/api', service.router);
  process.env.WORKER_INTERNAL_SECRET = 'isolated-test-only';
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/internal/facebook-market-card`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { 'X-Worker-Secret': 'wrong' } })).status, 403); assert.equal(reads, 0);
    const responses = await Promise.all([1, 2].map(() => fetch(url, { headers: { 'X-Worker-Secret': 'isolated-test-only' } })));
    for (const r of responses) { assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal((await r.json()).empty, true); }
    assert.equal(reads, 1, 'Concurrent preparations share bounded cache');
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); delete process.env.WORKER_INTERNAL_SECRET; }
  const failure = await load({ from: () => ({ ...query, abortSignal: async () => ({ data: [], error: { message: 'offline' } }) }) });
  await assert.rejects(failure.readFacebookMarketCard());
  const overflow = await load({ from: () => ({ ...query, abortSignal: async () => ({ data: Array(500).fill(rows[0]), error: null }) }) });
  await assert.rejects(overflow.readFacebookMarketCard(), /حد الصورة/);
  console.log(`PASS Facebook freshness, unchanged/invalid/missing samples, precision, midnight, PNG, private HTTP, coalescing, failed/truncated reads. Sample: ${dir}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
