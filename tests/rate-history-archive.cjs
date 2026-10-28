const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function run(saveFails = false, conflictingArchive = false) {
  const events = [], data = {
    parallel_rates: [
      { id: 1, recorded_at: '2026-09-25T08:00:00Z', usd: 10, rates: { USD: 10, EUR: 11 } },
      { id: 2, recorded_at: '2026-09-25T09:00:00Z', usd: 10.2, rates: { USD: 10.2, EUR: 10.8 } },
      { id: 3, recorded_at: '2026-09-29T10:00:00Z', usd: 10.3, rates: { USD: 10.3 } },
    ], official_rates: [{ id: 4, recorded_at: '2026-03-01T08:00:00Z', usd: 6, rates: { USD: 6 } }],
    metal_rates: [{ id: 5, recorded_at: '2026-09-24T08:00:00Z', rates: { GOLD_SCRAP_18: 800 } }], rate_history_daily: [],
  };
  const client = { from(table) {
    let offset = 0, size = 500, operation = 'select', payload, descending = false;
    const filters = [], matches = row => filters.every(test => test(row));
    const query = {
      select() { operation = 'select'; return query; },
      gte(key, value) { filters.push(row => key === 'recorded_at' ? Date.parse(row[key]) >= Date.parse(value) : row[key] >= value); return query; },
      lt(key, value) { filters.push(row => key === 'recorded_at' ? Date.parse(row[key]) < Date.parse(value) : row[key] < value); return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      order(key, options) { if (key === 'recorded_at') descending = options.ascending === false; return query; },
      limit(value) { size = value; return query; },
      range(start) { offset = start; return query; }, abortSignal() { return query; },
      upsert(rows, options) { assert.equal(options.ignoreDuplicates, true); operation = 'upsert'; payload = rows; return query; }, delete() { operation = 'delete'; return query; },
      then(resolve, reject) {
        let result;
        if (operation === 'select') {
          const rows = data[table].filter(matches).sort((a, b) => (Date.parse(a.recorded_at) - Date.parse(b.recorded_at)) * (descending ? -1 : 1));
          result = { data: rows.slice(offset, offset + size), error: null };
        } else if (operation === 'upsert') {
          events.push(['upsert', table, payload]);
          if (!saveFails) for (const row of payload) if (!data[table].some(old => old.source_table === row.source_table && old.local_date === row.local_date)) data[table].push({ ...row, mean_rates: conflictingArchive ? { USD: 99 } : row.mean_rates });
          result = { error: saveFails ? { message: 'fixture save error' } : null };
        } else {
          events.push(['delete', table]); const removed = data[table].filter(matches);
          data[table] = data[table].filter(row => !matches(row)); result = { count: removed.length, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  } };
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `export * from './server/services/rate-history-archive.service';` },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'helpers', setup(build) { build.onResolve({ filter: /utils\/helpers$/ }, () => ({ path: 'helpers', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `exports.getLibyaDateString=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tripoli',year:'numeric',month:'2-digit',day:'2-digit'}).format(d); exports.getPriceHistoryCutoff=(now=new Date(),days=30)=>{const [y,m,day]=exports.getLibyaDateString(now).split('-').map(Number); if(days==='six-months'){const d=new Date(Date.UTC(y,m-7,1)); const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),-2)).toISOString();} return new Date(Date.parse(exports.getLibyaDateString(now)+'T00:00:00+02:00')-days*86400000).toISOString();};` }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests/rate-history-archive.fixture.cjs'), module); mod.paths = module.paths; mod._compile(bundle.outputFiles[0].text, mod.id);
  return { result: await mod.exports.archiveOldRateHistory(client, new Date('2026-10-28T12:00:00Z')), events, data };
}

async function main() {
  const { result, events, data } = await run();
  const saved = events.find(event => event[0] === 'upsert')[2][0];
  assert.equal(saved.source_table, 'parallel_rates');
  assert.equal(saved.local_date, '2026-09-25');
  assert.equal(saved.mean_rates.USD, 10.1);
  assert.equal(saved.low_rates.USD, 10);
  assert.equal(saved.high_rates.USD, 10.2);
  assert.equal(saved.last_rates.USD, 10.2);
  assert.equal(saved.weekly_close_rates.USD, 10.2, 'Friday close is explicitly preserved');
  assert.equal(saved.observations, 2);
  assert.equal(result.removed.parallel_rates, 2);
  assert.equal(data.official_rates[0].usd, 6, 'Never delete the only/latest quote even when older than six months');
  assert.equal(data.metal_rates.length, 1, 'The latest source quote remains usable after daily archiving');
  assert.equal(data.rate_history_daily.find(row => row.source_table === 'metal_rates').last_rates.GOLD_SCRAP_18, 800, 'Daily closing prices also preserve a weekly close when Friday has no quote');
  assert(events.findIndex(event => event[0] === 'upsert') < events.findIndex(event => event[0] === 'delete'), 'Archive writes must finish before any raw deletion');
  await assert.rejects(run(true), /summary save failed/);
  await assert.rejects(run(false, true), /Archive differs/, 'Conflicting/partial archive data must stop deletion');
  console.log('PASS: daily means/ranges/count, weekly closing references, latest quote retention, verified archives and no deletion after failed/conflicting saves. Isolated fixtures only.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
