const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');
const { build } = require('esbuild');

async function main() {
  let queries = 0, failed = false, sent = [];
  const config = { telegramPostChannel: 'fixture-channel' };
  global.__harvest = { config, manager: { sendFile: async (...args) => { sent.push(args); return true; } }, supabase: { from(table) {
    let offset = 0;
    const q = { select() { return q; }, gte() { return q; }, lt() { return q; }, order() { return q; },
      range(start) { offset = start; return q; }, abortSignal(signal) { assert(signal); return q; },
      then(resolve, reject) { queries++; return Promise.resolve({ error: failed ? { message: 'private database error' } : null,
        data: table === 'parallel_rates' && offset === 0 ? Array.from({ length: 500 }, () => ({ rates: { USD: 10 }, recorded_at: '2026-10-10T10:00:00Z' })) : [] }).then(resolve, reject); } }; return q;
  } } };
  const mocks = {
    db: 'export const supabase=global.__harvest.supabase;', config: 'export const appConfig=global.__harvest.config;', state: 'export const rates={};',
    'social.service': 'export const getOrInitTelegramManager=()=>global.__harvest.manager; export const broadcastOfficialRates=()=>{}; export const broadcastRateChanges=()=>{}; export const forwardVisitorMessageToTelegram=()=>{};',
    'alert.service': 'export const sendCriticalErrorAlert=()=>{};'
  };
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `export * from './shared/weeklyHarvest'; export * from './server/services/weekly-harvest.service'; export {default as telegram} from './server/routes/admin/telegram.routes';` }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'isolated', setup(p) {
      p.onResolve({ filter: /^\./ }, a => mocks[path.basename(a.path)] ? { path: path.basename(a.path), namespace: 'fixture' } : undefined);
      p.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path] }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests/harvest-isolated.cjs'), module); mod.paths = module.paths; mod._compile(bundle.outputFiles[0].text, mod.id);
  const api = mod.exports, now = new Date('2026-10-15T10:00:00Z');
  assert.deepEqual(api.harvestWindow(now), { start: '2026-10-07T22:00:00.000Z', end: '2026-10-14T22:00:00.000Z' });
  const row = (time, rates) => ({ recorded_at: time, rates });
  const report = api.buildWeeklyHarvest([
    row('2026-10-15T01:00:00Z', { USD: 90 }), row('2026-10-07T20:00:00Z', { USD: 1 }),
    row('2026-10-08T08:00:00Z', { USD: 10, USD_CHECKS: 12, EUR: 11, GOLD_SCRAP_18: 999 }),
    row('2026-10-14T12:00:00Z', { USD: 10.2, USD_CHECKS: 12.1, EUR: 10.9, EGP: 0.2 }), row('bad', { USD: 99 })
  ], [row('2026-10-08T08:00:00Z', { USD: 6.4404, EUR: 7.1001 }), row('2026-10-14T08:00:00Z', { USD: 6.4405, EUR: 7.1002 })],
  [row('2026-10-08T08:00:00Z', { GOLD_SCRAP_18: 800 }), row('2026-10-14T08:00:00Z', { GOLD_SCRAP_18: 810 })], now);
  const usd = report.items.find(i => i.id === 'USD'); assert.equal(usd.close, 10.2); assert.equal(usd.low, 10); assert.equal(usd.days, 2);
  assert.equal(report.items.find(i => i.id === 'EGP').change, null);
  assert.equal(report.items.find(i => i.id === 'OFFICIAL_USD'), undefined);
  assert.equal(report.items.find(i => i.id === 'OFFICIAL_EUR').change, 0.0001);
  assert(report.notes.some(note => note.includes('الصكوك أعلى من الكاش بـ 1.90')));
  assert(report.notes.some(note => note.includes('نطاق الرصد 10.00 إلى 10.20')));
  assert(report.notes.some(note => note.includes('رصد جزئي')));
  assert(report.notes.length <= 4);
  const checks = report.items.find(i => i.id === 'USD_CHECKS');
  const unaligned = api.harvestNotes([usd, { ...checks, lastAt: '2026-10-13T12:00:00Z' }]);
  assert(unaligned.some(note => note.includes('دولار صكوك ارتفع')));
  assert(!unaligned.some(note => note.includes('الكاش بـ')), 'Do not compare prices observed at different times');
  const equal = api.harvestNotes([usd, { ...checks, open: usd.open, close: usd.close }]);
  assert(equal.some(note => note.includes('تعادل سعر الصكوك والكاش')));
  const limited = api.harvestNotes([{ ...usd, days: 1, change: null, changePct: null }]);
  assert(limited.some(note => note.includes('لا يكفي الرصد')));
  assert(!limited.some(note => note.includes('دون تغير')));
  assert.deepEqual(api.harvestNotes([]), []);
  assert(!report.notes.some(note => note.includes('الدولار الرسمي')));
  assert.equal(api.harvestNumber(-0.12, 'USD'), '-0.12');
  assert.equal(api.harvestNumber(0.0001, 'OFFICIAL_EUR'), '0.0001');
  assert.equal(report.items.find(i => i.id === 'GOLD_SCRAP_18').close, 810);
  assert(!report.notes.join('').match(/الطلب|البورصة|المقاصة/));
  assert.equal(api.buildWeeklyHarvest([], [], [], now).items.length, 0);
  await api.readWeeklyHarvest(); assert.equal(queries, 4, 'All pages are read, not just the first Supabase page');
  failed = true; await assert.rejects(api.readWeeklyHarvest(), /تعذر قراءة/);
  const app = express(); app.use(express.json({ limit: '8mb' })); app.use(api.telegram);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const post = body => fetch(`http://127.0.0.1:${server.address().port}/weekly-harvest/send-telegram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const image = Buffer.alloc(140000); Buffer.from([137,80,78,71,13,10,26,10]).copy(image);
    const payload = { imageBase64: 'data:image/png;base64,' + image.toString('base64'), caption: 'حصاد الأسبوع [نص عادي]', destination: 'me' };
    assert.equal((await post(payload)).status, 200); assert.equal(sent[0][1].length, 140000); assert.equal(sent[0][2].parseMode, undefined);
    for (const body of [{ ...payload, destination: 'unknown' }, { ...payload, caption: 'x'.repeat(1025) }, { ...payload, imageBase64: 'data:image/png;base64,YmFk' }]) assert.equal((await post(body)).status, 400);
    config.telegramPostChannel = ''; assert.equal((await post({ ...payload, destination: 'channel' })).status, 400); assert.equal(sent.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); delete global.__harvest; }
  console.log('PASS: Tripoli period, missing data, four decimals, metal source, pagination/failure, PNG validation and plain-text delivery. No production access.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
