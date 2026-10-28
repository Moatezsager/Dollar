const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');
const { build } = require('esbuild');

async function main() {
  let queries = 0, failed = false, sent = [], bounds = [];
  const config = { telegramPostChannel: 'fixture-channel' };
  global.__harvest = { config, manager: { sendFile: async (...args) => { sent.push(args); return true; } }, supabase: { from(table) {
    let offset = 0;
    const q = { select() { return q; }, gte(_key, value) { bounds.push(['gte', value]); return q; }, lt(_key, value) { bounds.push(['lt', value]); return q; }, order() { return q; },
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
  const api = mod.exports, now = new Date('2026-10-17T12:00:00Z');
  assert.deepEqual(api.harvestWindow(now), { start: '2026-10-09T22:00:00.000Z', end: '2026-10-16T22:00:00.000Z' });
  const row = (time, rates) => ({ recorded_at: time, rates });
  const report = api.buildWeeklyHarvest([
    row('2026-10-17T01:00:00Z', { USD: 90 }), row('2026-10-09T20:00:00Z', { USD: 1 }),
    row('2026-10-10T08:00:00Z', { USD: 10, USD_CHECKS: 12, EUR: 11, GOLD_SCRAP_18: 800 }),
    row('2026-10-16T12:00:00Z', { USD: 10.2, USD_CHECKS: 12.1, EUR: 10.9, EGP: 0.2, GOLD_SCRAP_18: 810 }), row('bad', { USD: 99 })
  ], [row('2026-10-10T08:00:00Z', { USD: 6.4404, EUR: 7.1001 }), row('2026-10-16T08:00:00Z', { USD: 6.4405, EUR: 7.1002 })],
  [row('2026-10-10T08:00:00Z', { GOLD_SCRAP_18: 999 }), row('2026-10-16T18:00:00Z', { GOLD_SCRAP_18: 999 })], now);
  const usd = report.items.find(i => i.id === 'USD'); assert.equal(usd.close, 10.2); assert.equal(usd.low, 10); assert.equal(usd.days, 2);
  assert.equal(report.items.find(i => i.id === 'EGP').change, null);
  assert.equal(report.items.find(i => i.id === 'OFFICIAL_USD'), undefined);
  assert(!report.items.some(i => i.id.startsWith('OFFICIAL_')), 'Official markets are excluded from the entire weekly report');
  assert(report.notes.some(note => note.includes('فارق الصكوك عن الكاش تقلّص من 2.00 إلى 1.90')));
  assert(report.notes.some(note => note.includes('نطاق الفترة 10.00 إلى 10.20')));
  assert.equal(report.notes.length, 3, 'Three useful insights avoid repeating the cards and biggest-mover strip');
  assert.equal(report.daysObserved, 2, 'Coverage uses actually observed calendar days');
  assert.equal(report.observationCount, 2, 'Compatibility copies and duplicate timestamps do not inflate coverage');
  assert(Math.abs(usd.changePct - (usd.close - usd.open) / usd.open * 100) < 1e-9, 'Percent uses (last - first) / first');
  assert.equal(report.overallDirection, 'up');
  const withPrevious = api.buildWeeklyHarvest([
    row('2026-10-10T08:00:00Z', { USD: 10 }), row('2026-10-16T08:00:00Z', { USD: 10.2 })
  ], [], [], now, [row('2026-10-09T12:00:00Z', { USD: 9.9 })]);
  assert.equal(withPrevious.items.find(item => item.id === 'USD').previousClose, 9.9);
  assert.equal(withPrevious.items.find(item => item.id === 'USD').open, 9.9, 'Next week starts from the previous weekly close');
  const metalsPrior = api.buildWeeklyHarvest([], [], [row('2026-10-10T08:00:00Z', { GOLD_SCRAP_18: 810 })], now, [], [row('2026-10-08T08:00:00Z', { GOLD_SCRAP_18: 800 })]);
  assert.equal(metalsPrior.items[0].open, 800, 'A missing Friday observation uses the last available weekly metal quote');
  const checks = report.items.find(i => i.id === 'USD_CHECKS');
  const unaligned = api.harvestNotes([usd, { ...checks, lastAt: '2026-10-15T12:00:00Z' }]);
  assert(unaligned.some(note => note.includes('دولار صكوك ارتفع')));
  assert(!unaligned.some(note => note.includes('الكاش بـ')), 'Do not compare prices observed at different times');
  const equal = api.harvestNotes([usd, { ...checks, open: usd.open, close: usd.close }]);
  assert(equal.some(note => note.includes('بقي دون تغير من')));
  const limited = api.harvestNotes([{ ...usd, days: 1, change: null, changePct: null }]);
  assert(limited.some(note => note.includes('لا يكفي الرصد')));
  assert(!limited.some(note => note.includes('دون تغير')));
  assert.deepEqual(api.harvestNotes([]), []);
  const stable = api.buildWeeklyHarvest([row('2026-10-10T08:00:00Z', { USD: 10 }), row('2026-10-16T08:00:00Z', { USD: 10 })], [], [], now);
  assert.equal(stable.overallDirection, 'stable');
  const down = api.buildWeeklyHarvest([row('2026-10-10T08:00:00Z', { USD: 10, EUR: 11 }), row('2026-10-16T08:00:00Z', { USD: 9, EUR: 10 })], [], [], now);
  assert.equal(down.overallDirection, 'down');
  assert.equal(api.harvestDirection([{ changePct: 1 }, { changePct: 0 }, { changePct: 0 }]), 'stable', 'The overall direction includes unchanged items in the majority');
  assert.equal(api.buildWeeklyHarvest([row('2026-10-11T08:00:00Z', {}), row('2026-10-12T08:00:00Z', { USD: NaN })], [], [], now).daysObserved, 0);
  assert(stable.notes.some(note => note.includes('دون تغير')));
  const sparse = api.buildWeeklyHarvest([row('2026-10-10T08:00:00Z', { USD: 10 })], [], [], now);
  assert.equal(sparse.items[0].change, null);
  assert.equal(sparse.daysObserved, 1);
  assert(!report.notes.some(note => note.includes('الدولار الرسمي')));
  assert.equal(api.harvestNumber(-0.12, 'USD'), '-0.12');
  assert.equal(api.harvestNumber(0.0001, 'OFFICIAL_EUR'), '0.0001');
  assert.equal(report.items.find(i => i.id === 'GOLD_SCRAP_18').close, 810);
  const noMetalFallback = api.buildWeeklyHarvest([row('2026-10-10T08:00:00Z', { GOLD_SCRAP_18: 999, USD: 10 })], [], [], now);
  assert.equal(noMetalFallback.items.find(item => item.id === 'GOLD_SCRAP_18').close, 999, 'Full parallel snapshots are authoritative for metals as well');
  const corrected = api.buildWeeklyHarvest([
    row('2026-10-10T08:00:00Z', { USD: 10 }), row('2026-10-10T08:00:00Z', { USD: 10.1 }), row('2026-10-16T08:00:00Z', { USD: 10.2 })
  ], [], [], now);
  assert.equal(corrected.items.find(item => item.id === 'USD').observations, 2, 'Corrected readings at one timestamp count once');
  assert(!report.notes.join('').match(/الطلب|البورصة|المقاصة/));
  assert.equal(api.buildWeeklyHarvest([], [], [], now).items.length, 0);
  const currentTime = new Date('2026-10-28T12:34:56Z');
  const currentRows = [
    { ...row('2026-10-24T10:00:00Z', { USD: 99, EUR: 11.1, GOLD_SCRAP_18: 820 }), usd: 10.3 },
    row(currentTime.toISOString(), { USD: 10.4, EUR: 11.2, GOLD_SCRAP_18: 830 }),
    row('2026-10-28T12:34:56.001Z', { USD: 99, EUR: 99, GOLD_SCRAP_18: 999 })
  ];
  const priorRows = [row('2026-10-23T19:00:00Z', { USD: 10.2, EUR: 11, GOLD_SCRAP_18: 810, GBP: 12 })];
  const current = api.buildWeeklyHarvest(currentRows, [], [row('2026-10-28T12:00:00Z', { GOLD_SCRAP_18: 700 })], currentTime, priorRows, [], 'current');
  assert.equal(current.start, '2026-10-23T22:00:00.000Z');
  assert.equal(current.end, '2026-10-28T12:34:56.001Z');
  assert.equal(current.generatedAt, currentTime.toISOString());
  assert.equal(current.inProgress, true);
  assert(current.title.includes('حتى الآن'));
  assert.equal(current.daysObserved, 2);
  const currentUsd = current.items.find(item => item.id === 'USD');
  assert.equal(currentUsd.open, 10.2);
  assert.equal(currentUsd.close, 10.4, 'Latest quote at preparation time is included; future quotes are excluded');
  assert.equal(currentUsd.high, 10.4, 'Dedicated usd column has the same precedence as the live Web price loader');
  assert.equal(current.items.find(item => item.id === 'GOLD_SCRAP_18').close, 830, 'Stale compatibility metals cannot replace newer authoritative values');
  assert.equal(current.items.find(item => item.id === 'GBP').observations, 0);
  assert.equal(current.items.find(item => item.id === 'GBP').changePct, null, 'No observations this week is not evidence of zero movement');
  const lastWeek = api.buildWeeklyHarvest(priorRows, [], [], new Date(current.start));
  for (const item of lastWeek.items) assert.equal(current.items.find(next => next.id === item.id).open, item.close, 'Opening equals the last closed weekly report');
  assert.equal(api.harvestReportUrl(current), 'https://dollar-price-qp14.onrender.com/');
  assert(api.harvestSocialCaption(current).includes('حتى الآن'));
  assert.equal(api.harvestReportUrl(lastWeek), 'https://dollar-price-qp14.onrender.com/weekly-report/2026-10-23');
  assert.deepEqual(api.harvestWindow(new Date('2026-10-30T10:00:00Z')), api.harvestWindow(currentTime), 'Friday before midnight still uses last completed week for automated publishing');
  assert.equal(api.harvestWindow(new Date('2026-10-30T22:00:00Z'), 'current').start, '2026-10-30T22:00:00.000Z');
  const equivalent = api.buildWeeklyHarvest([row('2026-10-10T08:00:00Z', { USD: 10 }), row('2026-10-10T10:00:00+02:00', { USD: 10.1 })], [], [], now);
  assert.equal(equivalent.observationCount, 1);
  assert.equal(equivalent.items[0].close, 10.1);
  await api.readWeeklyHarvest(currentTime); assert.equal(queries, 3, 'All parallel pages and metals are read without querying official rates');
  assert(bounds.some(([op, value]) => op === 'lt' && value === current.end), 'Database read uses the same captured cutoff as the report');
  assert(bounds.some(([op, value]) => op === 'gte' && value === '2026-10-16T22:00:00.000Z'));
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
