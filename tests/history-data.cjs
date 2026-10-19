const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

async function main() {
  let queries = 0;
  let readFailure = false;
  const rows = {
    metal_rates: [
      { recorded_at: '2026-10-10T10:00:00Z', rates: { GOLD_SCRAP_18: 100 } },
      { recorded_at: '2026-10-10T12:00:00+00:00', rates: { GOLD_SCRAP_18: 110 } },
    ],
    parallel_rates: [
      { recorded_at: 'invalid', usd: 123, rates: { USD: 123 } },
      { recorded_at: '2026-10-10T11:00:00Z', usd: 9, rates: { USD: 9, EUR: 10 } },
      { recorded_at: '2026-10-10T12:00:00Z', usd: 9.2, rates: { USD: 9.2 } },
    ],
    official_rates: [{ recorded_at: '2026-10-10T11:30:00Z', usd: 6, rates: { USD: 6, EUR: 7 } }],
  };
  const state = {
    rates: { parallel: { USD: 99, EUR: 88, GOLD_SCRAP_18: 999 }, official: { USD: 77, EUR: 66 } },
    history: [],
  };
  const supabase = { from(table) {
    queries++;
    let start = 0, end = Infinity;
    const query = { select: () => query, order: () => query, limit: () => query,
      gte: () => query, lte: () => query, abortSignal: () => query,
      range(a, b) { start = a; end = b; return query; },
      then: resolve => Promise.resolve({ data: rows[table].slice(start, end + 1), error: readFailure ? { message: 'Fixture page failed' } : null }).then(resolve) };
    return query;
  } };
  const helpers = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(path.join(process.cwd(), 'server/utils/helpers.ts'), 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'node20'
  }).code, { module: helpers, exports: helpers.exports, Date, Buffer, process: { env: {} },
    require: name => { if (name === 'crypto') return require('node:crypto'); throw Error('Unexpected helper dependency: ' + name); }
  });
  const mocks = {
    '../db': { db: {}, supabase, supabaseAnonKey: 'fixture-only' },
    '../state': state, '../config': { appConfig: {} },
    '../utils/helpers': helpers.exports,
    './reporting.service': { updateStats() {} }, './alert.service': { checkAndAlertIfCritical: async () => {} },
  };
  const filename = path.join(process.cwd(), 'server/services/db.service.ts');
  const source = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node20' }).code;
  const mod = { exports: {} };
  vm.runInNewContext(source, { module: mod, exports: mod.exports, console, Date, Map, AbortSignal,
    require(name) { if (Object.hasOwn(mocks, name)) return mocks[name]; throw Error('Unexpected dependency: ' + name); },
  }, { filename });
  const history = await mod.exports.fetchHistoryFromSupabase();
  assert.equal(history.length, 4, 'Invalid dates must not discard the valid timeline');
  assert.equal(history[0].usdParallel, 0, 'No current USD price inserted before its first observation');
  assert.equal(history[0].ratesParallel.EUR, undefined);
  assert.equal(history[0].usdOfficial, 0);
  assert.equal(history[1].ratesOfficial.EUR, undefined, 'No later official price carried backward');
  assert.equal(history[1].ratesParallel.USD, 9);
  assert.equal(history[2].ratesOfficial.USD, 6);
  assert.equal(history[3].usdParallel, 9.2);
  assert.equal(history[3].ratesParallel.EUR, 10, 'Known earlier observations still carry forward');
  assert.equal(history[3].ratesParallel.GOLD_SCRAP_18, 110, 'Equivalent timestamps merge markets and metals');
  assert.deepEqual([...history[0].observed.parallel], ['GOLD_SCRAP_18']);
  assert.deepEqual([...history[2].observed.parallel], [], 'Carried USD is not another USD observation');
  assert.equal(await mod.exports.fetchHistoryFromSupabase(), history);
  assert.equal(queries, 3, 'Repeated history requests reuse the existing cache');
  mod.exports.clearDbCache();
  await mod.exports.fetchHistoryFromSupabase();
  assert.equal(queries, 6);
  rows.parallel_rates[2].usd = 99;
  mod.exports.clearDbCache();
  const corrected = await mod.exports.fetchHistoryFromSupabase(true);
  assert.equal(corrected.at(-1).usdParallel, 9.2, 'Historical corrected rates.USD wins over a stale legacy usd column');
  mod.exports.clearDbCache();
  const staleRead = mod.exports.fetchHistoryFromSupabase(true);
  mod.exports.clearDbCache();
  await assert.rejects(staleRead, /History changed during read/);
  assert.equal(mod.exports.cachedHistory, null, 'Read begun before an edit cannot repopulate the cache');
  console.log('PASS: real history loader, forward-only observations, malformed dates, merged timestamps and cache invalidation');

  state.rates = { parallel: {}, official: {}, previousParallel: {}, previousOfficial: {},
    lastChanged: { parallel: {}, official: {} }, lastUpdated: '' };
  rows.parallel_rates = [{ usd: 9.8, rates: { USD: 9.8 }, recorded_at: '2026-10-14T08:00:00Z' }];
  rows.official_rates = [
    { usd: 6.4404, rates: { USD: 6.4404 }, recorded_at: '2026-10-14T08:00:00Z' },
    { usd: 6.4403, rates: { USD: 6.4403 }, recorded_at: '2026-10-13T08:00:00Z' },
  ];
  await mod.exports.initializeRatesFromDB(true);
  assert.equal(mod.exports.getParallelUpdatedAt(), '2026-10-14T08:00:00.000Z');
  assert.equal(state.rates.previousOfficial.USD, 6.4403, 'Restart must recognize a 0.0001 official change');
  assert.equal(state.rates.lastChanged.official.USD, rows.official_rates[0].recorded_at);
  rows.official_rates = [{ usd: 6.4405, rates: { USD: 6.4405 }, recorded_at: '2026-10-14T09:00:00Z' }];
  await mod.exports.loadLatestRatesFromSupabase();
  assert.equal(state.rates.previousOfficial.USD, 6.4404, 'Live sync preserves the actual prior four-decimal price');
  assert.equal(state.rates.lastChanged.official.USD, '2026-10-14T09:00:00Z');
  assert.equal(mod.exports.getParallelUpdatedAt(), '2026-10-14T08:00:00.000Z', 'Official changes must not refresh the public parallel timestamp');
  await mod.exports.loadLatestRatesFromSupabase();
  assert.equal(state.rates.previousOfficial.USD, 6.4404, 'Repeated notifications never erase the change');
  rows.official_rates = [{ usd: 6.4405 + 1e-14, rates: { USD: 6.4405 + 1e-14 }, recorded_at: '2026-10-14T09:01:00Z' }];
  await mod.exports.loadLatestRatesFromSupabase();
  assert.equal(state.rates.lastChanged.official.USD, '2026-10-14T09:00:00Z', 'Floating-point noise is not a fresh change');
  rows.official_rates = [{ usd: 6.4404, rates: { USD: 6.4404 }, recorded_at: '2026-10-14T09:02:00Z' }];
  await mod.exports.loadLatestRatesFromSupabase();
  assert.equal(Number(state.rates.previousOfficial.USD.toFixed(4)), 6.4405, 'Downward 0.0001 changes also update the prior price');
  assert.equal(state.rates.lastChanged.official.USD, '2026-10-14T09:02:00Z');
  rows.official_rates = [{ usd: 6.5, rates: { USD: 6.5 }, recorded_at: '2026-10-14T09:01:00Z' }];
  await mod.exports.loadLatestRatesFromSupabase();
  assert.equal(state.rates.official.USD, 6.4404, 'Precision support must not admit older snapshots');
  console.log('PASS: four-decimal official changes on restart/live sync, previous price, timestamps, duplicate/noise suppression and stale rejection');

  const dailyModule = { exports: {} };
  class Clock extends Date { constructor(value = Clock.now()) { super(value); } static now() { return Date.parse('2026-10-14T10:00:00Z'); } }
  vm.runInNewContext(transformSync(fs.readFileSync(path.join(process.cwd(), 'src/utils/rateHistory.ts'), 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'node20'
  }).code, { module: dailyModule, exports: dailyModule.exports, Date: Clock, Intl, Map });
  const daily = dailyModule.exports;
  assert.equal(daily.getRateHistory(history, { code: 'USD', market: 'parallel' }).length, 2, 'Metal/official rows must not bias parallel averages');
  const observations = [
    { time: '2026-10-10T22:05:00Z', usdOfficial: 6.4004, usdParallel: 9.8 },
    { time: '2026-10-10T21:59:00Z', usdOfficial: 6.4003, usdParallel: 9.7 },
    { time: '2026-10-10T22:01:00Z', usdOfficial: 6.4003, usdParallel: 9.75 },
    { time: 'invalid', usdOfficial: 6.4 },
    { time: '2100-01-01T00:00:00Z', usdOfficial: 10 },
  ];
  const before = JSON.stringify(observations);
  const officialDays = daily.getRateHistory(observations, { code: 'USD', market: 'official' });
  assert.equal(officialDays.length, 2, 'Tripoli midnight starts a new official calendar day');
  assert.equal(officialDays[0].value, 6.4003); assert.equal(officialDays[1].value, 6.4004);
  assert.equal(officialDays[1].time, '2026-10-10T22:05:00Z', 'Last valid quote of the day is retained, without synthesizing timestamps');
  assert.equal(daily.formatLibyaDate(officialDays[1].time), '11/10/2026');
  assert.equal(daily.libyaDayKey(officialDays[1].time), '2026-10-11');
  assert.equal(daily.getRateHistory(observations, { code: 'USD', market: 'parallel' }).length, 3, 'Parallel intraday history remains intact');
  assert.equal(daily.getRateHistory(observations, { code: 'EUR', market: 'official' }).length, 0, 'Missing currencies are not invented');
  assert.equal(daily.libyaDayKey('invalid'), ''); assert.equal(daily.formatLibyaDate('invalid'), 'غير متاح');
  assert.equal(JSON.stringify(observations), before, 'Display grouping never changes the shared history');
  const averages = daily.getDailyRateAverages([
    { time: '2026-10-10T22:01:00Z', value: 10 }, { time: '2026-10-11T12:00:00Z', value: 12 },
    { time: '2026-10-11T21:59:00Z', value: 11 }, { time: '2026-10-11T22:00:00Z', value: 14 },
    { time: 'invalid', value: 18 }, { time: '2026-10-11T23:00:00Z', value: NaN },
  ]);
  assert.equal(averages.length, 2); assert.equal(averages[0].value, 11); assert.equal(averages[0].count, 3);
  assert.equal(averages[1].value, 14); assert.equal(averages[0].time, '2026-10-11T21:59:00Z');
  console.log('PASS: one official quote per Tripoli calendar day, midnight boundary, no fabricated dates, and unchanged parallel intraday data');

  const hook = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(path.join(process.cwd(), 'src/hooks/useRatesCalculations.ts'), 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'node20'
  }).code, { module: hook, exports: hook.exports, Date: Clock, Map, Set, require: name => ({
    react: { useMemo: run => run(), useState: value => [value, () => {}] },
    '../types/rates': { CURRENCIES: [], METAL_IDS: [] }, './usePriceFlash': { usePriceFlash: () => null },
    'lucide-react': {}, '../utils/rateHistory': daily,
  }[name]) });
  const calculated = hook.exports.useRatesCalculations({ rates: state.rates, history: observations, configTerms: [],
    selectedRate: { code: 'USD', name: 'Official USD', market: 'official' } });
  assert.equal(calculated.chartData.length, 2);
  assert.equal(calculated.chartStats.avg.toFixed(6), '6.400350', 'Period average is daily, not weighted by parallel updates');
  assert.equal(calculated.advancedStats.ma30.toFixed(6), '6.400350', 'The 30-day summary also uses one price per day');
  console.log('PASS: actual React calculations use daily official prices for period and 30-day statistics');

  rows.parallel_rates = Array.from({ length: 2501 }, (_, i) => ({
    recorded_at: new Date(Date.parse('2026-10-01T00:00:00Z') + i * 300000).toISOString(),
    usd: i === 3 ? 12 : 10 + i / 100000, rates: { USD: i === 3 ? 12 : 10 + i / 100000, EUR: 11.1234 }
  }));
  rows.official_rates = []; rows.metal_rates = [];
  mod.exports.clearDbCache(); queries = 0;
  const [month, sameMonth] = await Promise.all([mod.exports.fetchHistoryFromSupabase(true), mod.exports.fetchHistoryFromSupabase(true)]);
  assert.equal(month, sameMonth); assert.equal(queries, 8, 'Six 500-row parallel pages plus two empty market reads, shared by concurrent visitors');
  assert.equal(month.length, 2501, 'A month is not silently capped at 120/1000/3000 latest points');
  const values = daily.getRateHistory(month, { code: 'USD', market: 'parallel' });
  assert.equal(Math.max(...values.map(p => p.value)), 12, 'Daily display compression must not erase the actual monthly high');
  const dailyMonth = daily.getDailyRateAverages(values);
  assert(dailyMonth.length > 7 && dailyMonth.length < month.length);
  assert.equal(month.at(-1).ratesParallel.EUR, 11.1234, 'No early rounding during reads/aggregation');
  rows.parallel_rates[3] = { ...rows.parallel_rates[3], usd: 10.0001, rates: { USD: 10.0001, EUR: 11.1234 } };
  mod.exports.clearDbCache();
  const revised = await mod.exports.fetchHistoryFromSupabase(true);
  assert(daily.getDailyRateAverages(daily.getRateHistory(revised, { code: 'USD', market: 'parallel' }))[0].value < dailyMonth[0].value,
    'Manual corrections rebuild the daily mean from the preserved observations');
  mod.exports.clearDbCache(); readFailure = true;
  await assert.rejects(mod.exports.fetchHistoryFromSupabase(true), /Incomplete history read/);
  assert.equal(mod.exports.cachedHistory, null, 'Failed pages must not become a partial successful month');
  readFailure = false; rows.parallel_rates = Array.from({ length: 10001 }, (_, i) => ({
    usd: 10, recorded_at: new Date(Date.parse('2026-10-01T00:00:00Z') + i * 60000).toISOString(), rates: { USD: 10 }
  }));
  await assert.rejects(mod.exports.fetchHistoryFromSupabase(true), /safe read limit/);
  console.log('PASS: complete paginated month, shared reads, daily means, raw highs, manual corrections, precision and fail-closed limits');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
