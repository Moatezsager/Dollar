const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { build } = require('esbuild');

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'currency-report-'));
  try {
    const outfile = path.join(temporary, 'model.cjs');
    await build({ entryPoints: ['src/utils/currencyReport.ts'], outfile, bundle: true, platform: 'node', format: 'cjs' });
    const { buildCurrencyReport: report } = require(outfile);
    const now = Date.parse('2026-10-23T12:00:00Z');
    const point = (time, value) => ({ time, value });
    const input = { code: 'USD', name: 'دولار', market: 'official', price: 6.4405, lastChanged: '2026-10-23T08:00:00Z',
      lastUpdated: '2026-10-23T09:00:00Z', range: '7d', amount: 100,
      advanced: { ma30: 6.4404, support: 6.4403, resistance: 6.4405 },
      points: [point('2026-10-23T08:00:00Z', 6.4405), point('invalid', 1), point('2026-10-22T08:00:00Z', 6.4403),
        point('2026-10-22T12:00:00Z', 6.4404), point('2026-10-24T00:00:00Z', 9), point('2026-10-21T08:00:00Z', 0)] };
    const official = report(input, now);
    assert.equal(official.decimals, 4);
    assert.equal(official.points.length, 2, 'One final reading per actual Tripoli day');
    assert.equal(official.change, 0.0001, 'Official changes preserve four decimal places');
    assert.equal(official.first.value, 6.4404);
    assert.equal(official.conversion.total, 644.05);
    assert.equal(official.days.length, 2);
    assert.equal(official.days[0].count, 1);
    const parallel = report({ ...input, market: 'parallel', price: 10.3, points: [
      point('2026-10-21T22:30:00Z', 10), point('2026-10-21T23:00:00Z', 10.2), point('2026-10-21T23:00:00Z', 10.4),
      point('2026-10-23T00:00:00Z', 10.1), point('2026-10-23T03:00:00Z', NaN)] }, now);
    assert.deepEqual(parallel.days.map(day => day.day), ['2026-10-22', '2026-10-23']);
    assert.deepEqual(parallel.days[0], { day: '2026-10-22', first: 10, last: 10.4, low: 10, high: 10.4, avg: 10.2, count: 2 });
    assert.equal(parallel.points.length, 3, 'Duplicate timestamps are replaced, not double counted');
    assert.equal(parallel.last.value, 10.1, 'Current price is not appended as a fake history observation');
    assert.notEqual(parallel.last.value, parallel.price);
    assert.equal(report({ ...input, points: [] }, now).avg, null);
    assert.equal(report({ ...input, points: [input.points[0]] }, now).change, null);
    assert.equal(report({ ...input, lastChanged: '2027-01-01', lastUpdated: 'bad', amount: Infinity }, now).lastChanged, null);
    assert.equal(report({ ...input, amount: -1 }, now).conversion, null);
    assert.equal(report({ ...input, advanced: { ma30: 50, support: 1, resistance: 2 } }, now).advanced, null);
    for (const price of [NaN, Infinity, 0, -1]) assert.throws(() => report({ ...input, price }, now));
    assert.equal(report({ ...input, code: 'EGP', market: 'parallel' }, now).decimals, 3);
    assert.equal(report({ ...input, code: 'GOLD_LIRA_8G', market: 'parallel' }, now).unit, 'للقطعة');
    assert.equal(report({ ...input, code: 'SILVER_CAST_1000', market: 'parallel' }, now).unit, 'لكل غرام');
    const snapshot = report(input, now);
    input.points[0].value = 100; input.advanced.ma30 = 100;
    assert.equal(snapshot.last.value, 6.4405);
    assert.equal(snapshot.advanced.ma30, 6.4404);
    console.log('Currency report data: precision, dates, daily aggregation, missing data and snapshot isolation passed.');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
