const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

async function main() {
  let queries = 0;
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
    const query = { select: () => query, order: () => query, limit: () => query,
      then: resolve => Promise.resolve({ data: rows[table], error: null }).then(resolve) };
    return query;
  } };
  const mocks = {
    '../db': { db: {}, supabase, supabaseAnonKey: 'fixture-only' },
    '../state': state, '../config': { appConfig: {} },
    '../utils/helpers': { METAL_IDS: [], isSignificantChange: () => false },
    './reporting.service': { updateStats() {} }, './alert.service': { checkAndAlertIfCritical: async () => {} },
  };
  const filename = path.join(process.cwd(), 'server/services/db.service.ts');
  const source = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node20' }).code;
  const mod = { exports: {} };
  vm.runInNewContext(source, { module: mod, exports: mod.exports, console, Date, Map,
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
  assert.equal(await mod.exports.fetchHistoryFromSupabase(), history);
  assert.equal(queries, 3, 'Repeated history requests reuse the existing cache');
  mod.exports.clearDbCache();
  await mod.exports.fetchHistoryFromSupabase();
  assert.equal(queries, 6);
  console.log('PASS: real history loader, forward-only observations, malformed dates, merged timestamps and cache invalidation');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
