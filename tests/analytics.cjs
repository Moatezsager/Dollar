const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function main() {
  let reads = 0, writes = [], localWrites = [], rows = [], remoteFailure = false;
  globalThis.__analytics = {
    config: { enableUserTracking: true },
    db: { prepare: () => ({ all: () => rows, run: (...values) => localWrites.push(values) }) },
    supabase: { from() {
      let offset = 0, last = 999, event;
      const query = {
        select() { return query; }, gte() { return query; }, lte() { return query; }, order() { return query; },
        range(start, end) { offset = start; last = end; return query; }, abortSignal() { return query; },
        insert(value) { event = value; return query; },
        then(resolve, reject) {
          if (event) writes.push(...event); else reads++;
          return Promise.resolve({ data: rows.slice(offset, last + 1), error: remoteFailure ? { message: 'fixture' } : null }).then(resolve, reject);
        }
      }; return query;
    } }
  };
  const result = await build({ stdin: { contents: "export * from './server/services/analytics.service'; export * from './server/services/analytics-tracking';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'isolate', setup(plugin) {
      plugin.onResolve({ filter: /\/(db|config)$/ }, args => ({ path: path.basename(args.path), namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'db'
        ? 'export const db = globalThis.__analytics.db; export const supabase = globalThis.__analytics.supabase;'
        : 'export const appConfig = globalThis.__analytics.config;' }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests', 'analytics-isolated.cjs'), module); mod.filename = mod.id; mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { summarizeAnalytics, analyticsWindow, readAnalytics, recordPageview, analyticsWriteHealth } = mod.exports;
  const now = Date.parse('2026-10-14T10:00:00Z');
  const event = (created_at, visitor_id = 'one', session_id = 'first') => ({ created_at, visitor_id, session_id, page_path: '/?secret=hidden', referrer: 'https://example.com/path?secret=x', device_type: 'Mobile' });
  assert.equal(new Date(analyticsWindow(1, now).start).toISOString(), '2026-10-13T22:00:00.000Z');
  const summary = summarizeAnalytics([
    event('2026-10-13T22:00:00Z'), event('2026-10-14 01:00:00', 'one', 'second'),
    event('2026-10-14T02:00:00Z', 'two'), event('2026-10-13T03:00:00Z'),
    event('2026-10-15T01:00:00Z'), event('invalid'), { ...event('2026-10-14T01:00:00Z'), device_type: 'Bot' }
  ], 1, now, true);
  assert.equal(summary.summary.totalPageviews, 3);
  assert.equal(summary.summary.totalVisitors, 2);
  assert.equal(summary.summary.sessions, 3);
  assert.equal(summary.summary.returningVisitors, 1);
  assert.equal(summary.summary.pageviewGrowth, 200);
  assert.deepEqual(summary.trend, [{ date: '2026-10-14', pageviews: 3, visitors: 2 }]);
  assert.deepEqual(summary.pages, { '/': 3 });
  assert.deepEqual(summary.sources, { 'example.com': 3 });
  assert.equal(summarizeAnalytics([], 7, now, true).trend.length, 7);
  assert.equal(summarizeAnalytics([], 7, now, true).summary.pageviewGrowth, null);
  rows = Array.from({ length: 1501 }, (_, id) => ({ ...event(new Date().toISOString(), 'visitor' + id), id }));
  const reports = await Promise.all([readAnalytics(7), readAnalytics(7)]);
  assert.equal(reads, 2, 'Two pages, not two independent report queries');
  assert.equal(reports[0].summary.totalVisitors, 1501);
  await readAnalytics(7); assert.equal(reads, 2, 'Cached report makes no reads');
  rows = Array.from({ length: 11000 }, (_, id) => ({ ...event(new Date().toISOString(), 'visitor' + id), id }));
  const capped = await readAnalytics(30);
  assert.equal(capped.truncated, true); assert.equal(capped.summary.totalPageviews, 10000); assert.equal(capped.previous, null);
  remoteFailure = true; rows = [];
  const fallback = await readAnalytics(1); assert.equal(fallback.source, 'local'); assert.equal(fallback.previous, null);
  remoteFailure = false;
  const req = { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' },
    body: { visitorId: 'visitor-1234567890', sessionId: 'session-1234567890', pagePath: '/', referrer: 'https://example.com/private?token=hidden' } };
  const send = async request => {
    let status;
    const res = { setHeader() {}, sendStatus(code) { status = code; }, status(code) { status = code; return res; }, set() { return res; }, end() {} };
    await recordPageview(request, res); return status;
  };
  assert.equal(await send(req), 204); assert.equal(writes.length, 1); assert.equal(localWrites.length, 1);
  assert.equal(writes[0].referrer, 'https://example.com'); assert.equal(writes[0].os_name, 'iOS');
  assert.equal(await send(req), 204); assert.equal(writes.length, 1);
  assert.equal(await send({ ...req, body: { ...req.body, pagePath: '/admin' } }), 400);
  assert.equal(await send({ ...req, body: { ...req.body, visitorId: {} } }), 400);
  assert.equal(await send({ ...req, headers: { dnt: '1' } }), 204);
  assert.equal(await send({ ...req, headers: { 'sec-gpc': '1' } }), 204);
  assert.equal(await send({ ...req, headers: { 'user-agent': 'iPhone Googlebot' } }), 204);
  globalThis.__analytics.config.enableUserTracking = false;
  await send({ ...req, body: { ...req.body, pagePath: '/api' } }); assert.equal(writes.length, 1);
  globalThis.__analytics.config.enableUserTracking = true; remoteFailure = true;
  await send({ ...req, body: { ...req.body, pagePath: '/about' } });
  assert.equal(analyticsWriteHealth.localOnly, 1);
  assert.equal(localWrites.length, 2, 'Remote outage preserves local recording and exposes health warning');
  console.log('PASS: Tripoli dates, distinct visitors/sessions, growth, missing days, pagination, cap, coalesced cache, fallback, ingestion validation, privacy, bots and duplicate suppression.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
