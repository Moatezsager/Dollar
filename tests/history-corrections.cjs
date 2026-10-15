const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const { transformSync } = require('esbuild');

async function main() {
  let rows = [{ id: 'old', usd: 10.62, rates: { USD: 10.62, EUR: 11 }, recorded_at: '2026-10-14T10:00:00Z' },
    { id: 'new', usd: 10.1, rates: { USD: 10.1, EUR: 11.1 }, recorded_at: '2026-10-14T11:00:00Z' }];
  const state = { rates: { parallel: { USD: 10.1, EUR: 11.1 }, official: { USD: 6.4 }, lastChanged: { parallel: {}, official: {} }, lastUpdated: '2026-10-14T11:00:00Z' } };
  let writes = [], events = [], publishes = 0, broadcasts = 0, invalidations = 0, failure = false, historyFailure = false;
  const supabase = { from() {
    let id, patch, remove = false, last = false;
    const query = { select() { return query; }, eq(_column, value) { id = value; return query; }, single() { return query; },
      order() { last = true; return query; }, limit() { return query; }, update(value) { patch = value; return query; }, delete() { remove = true; return query; },
      then(resolve, reject) {
        let data = id ? rows.find(row => row.id === id) : last ? rows.at(-1) : rows;
        if (!failure && patch) { writes.push(patch); Object.assign(data, patch); }
        if (!failure && remove) rows = rows.filter(row => row.id !== id);
        return Promise.resolve({ data, error: failure ? new Error('fixture write failed') : null }).then(resolve, reject);
      }
    }; return query;
  } };
  const mock = {
    express, '../../state': state, '../../config': { appConfig: { terms: [{ id: 'USD', name: 'Dollar', flag: 'us' }] } },
    '../../db': { supabase, supabaseAnonKey: 'fixture' },
    '../../services/db.service': { clearDbCache() { invalidations++; }, syncCheckRates: async () => {}, recentChangesLog: [], cleanupOldData: async () => {},
      fetchHistoryFromSupabase: async strict => { assert.equal(strict, true); if (historyFailure) throw Error('fixture unavailable'); return rows.map(row => ({ time: row.recorded_at, usdParallel: row.rates.USD, ratesParallel: row.rates })); } },
    '../../services/social.service': { broadcastRateChanges: async () => { publishes++; } },
    '../../socket/socket.service': { getIO: () => ({ emit: (event, data) => events.push({ event, data }) }) },
    '../../utils/helpers': { obfuscateData: value => value }
  };
  const mod = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync('server/routes/admin/database.routes.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: mod, exports: mod.exports, console, Date, require: name => { if (name in mock) return mock[name]; throw Error(name); } });
  const app = express(); app.use(express.json());
  // Parent authorization is tested independently by admin-regression.cjs.
  app.use(mod.exports.createAdminDatabaseRouter({ broadcastRatesUpdate() { broadcasts++; }, clearUserLogs() {} }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const send = async (method, id, body, market = 'parallel') => {
    const response = await fetch(`${url}/records/${market}/${id}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const corrected = await send('PUT', 'old', { currency: 'USD', value: 10.02 });
    assert.equal(corrected.data.historyUpdated, true);
    assert.equal(writes[0].usd, 10.02); assert.equal(writes[0].rates.USD, 10.02); assert.equal(writes[0].rates.EUR, 11);
    assert.equal(state.rates.parallel.USD, 10.1, 'Historical edit does not change latest price');
    assert.equal(publishes, 0, 'Historical correction is not a new social price'); assert.equal(broadcasts, 0);
    assert.equal(events[0].event, 'history_update'); assert.equal(events[0].data.history[0].usdParallel, 10.02);
    assert(Number.isFinite(Date.parse(events[0].data.readStartedAt)));
    await send('PUT', 'old', { currency: 'EUR', value: 11.05 }); assert.equal(writes[1].usd, undefined);
    assert.equal((await send('PUT', 'old', { currency: 'USD', value: '10wrong' })).status, 400);
    assert.equal((await send('PUT', 'old', { currency: '__proto__', value: 10 })).status, 400);
    assert.equal((await send('DELETE', 'old', null, 'invalid')).status, 400);
    const before = events.length; failure = true;
    assert.equal((await send('PUT', 'old', { currency: 'USD', value: 10 })).status, 500);
    assert.equal(events.length, before, 'Failed persistence emits no correction'); failure = false;
    await send('DELETE', 'old'); assert.equal(events.at(-1).data.history.length, 1);
    assert.equal(events.at(-1).data.history[0].time, rows[0].recorded_at);
    historyFailure = true;
    const partial = await send('PUT', 'new', { currency: 'USD', value: 10.11 });
    assert.equal(partial.data.success, true); assert.equal(partial.data.historyUpdated, false);
    assert.equal(events.length, before + 1, 'Unavailable history must not clear client charts');
    assert.equal(invalidations, 4);
    console.log('PASS: actual admin correction/delete routes, USD fields, untouched currencies, historical publishing guard, validation and honest partial failures.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
