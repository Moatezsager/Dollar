const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const express = require('express');
const { build } = require('esbuild');

async function main() {
  let databaseReads = 0;
  globalThis.__apiFixture = {
    config: { apiConfig: { enabled: true, rateLimitWindowMs: 60000, rateLimitMaxRequests: 120 } },
    rates: { parallel: { USD: 9.87, EUR: 10.91, GBP: 12.1 }, official: { USD: 6.4 }, lastUpdated: new Date().toISOString(), lastChanged: { parallel: { USD: new Date().toISOString() } } },
    updatedAt: new Date().toISOString(), persisted: true,
    read: () => { databaseReads++; },
  };
  const f = globalThis.__apiFixture;
  const mocks = {
    config: 'export const appConfig = globalThis.__apiFixture.config; export const getAdminSafeConfig = () => ({ ...appConfig }); export const updateAppConfig = c => Object.assign(appConfig,c); export const saveConfigToSupabase = async () => globalThis.__apiFixture.persisted;',
    state: 'export const rates = globalThis.__apiFixture.rates; export const history = []; export const serverStartTime = new Date();',
    db: 'export const supabase = null; export const supabaseAnonKey = "";',
    'db.service': 'export const getParallelUpdatedAt = () => globalThis.__apiFixture.updatedAt; export const initializeRatesFromDB = async () => globalThis.__apiFixture.read(); export const fetchHistoryFromSupabase = async () => []; export const recentChangesLog = [];',
    'social.service': 'export const facebookBroadcastStatus = {}; export const telegramBroadcastStatus = {};',
    helpers: 'export const obfuscateData = value => value;',
  };
  const result = await build({ stdin: { contents: `
    export {default as routes} from './server/routes/rates.routes';
    export * from './server/middleware/security';
    export * from './server/middleware/auth';
    export * from './server/routes/admin/config.routes';
  `, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'isolated-api', setup(plugin) {
      plugin.onResolve({ filter: /^\./ }, args => {
        const name = path.basename(args.path); if (mocks[name]) return { path: name, namespace: 'fixture' };
      });
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests/api-fixture.cjs'), module);
  mod.filename = mod.id; mod.paths = module.paths; mod._compile(result.outputFiles[0].text, mod.filename);
  const api = mod.exports;
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(['/api/public/rates', '/api/premium/rates'], api.developerApiHeaders);
  app.use(api.ipBanMiddleware, api.userAgentMiddleware);
  app.use('/api', api.apiLimiter);
  app.use('/api/admin', api.requireAdmin, api.createAdminConfigRouter({ apiStats: api.apiStats }));
  app.use('/api', api.routes);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { 'User-Agent': 'Dollar-API-Test/1.0', 'Content-Type': 'application/json' };
  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'fixture-cron-secret-1234';
  assert(api.isValidCronSecret('fixture-cron-secret-1234'));
  assert(!api.isValidCronSecret('fixture-cron-secret-1234x'), 'Cron secrets must match exactly');
  let isolatedIPs = true, address = 0;
  const get = (suffix = '', options = {}) => fetch(base + '/api/public/rates' + suffix, {
    headers: { ...headers, 'X-Forwarded-For': isolatedIPs ? '198.51.100.' + (++address) : '127.0.0.1' }, ...options });
  const originalPremium = process.env.PREMIUM_API_KEY;
  try {
    let response = await get();
    let data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('ratelimit-limit'), '5', 'Old high settings are capped by the new conservative policy');
    assert.deepEqual(data.data, { USD: 9.87, EUR: 10.91 });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(data.lastUpdated, f.updatedAt);
    assert.equal(data.lastChanged.EUR, null);
    f.rates.parallel.USD = 9.88;
    response = await get('?refresh=true&currency=GBP');
    assert.deepEqual((await response.json()).data, { USD: 9.88, EUR: 10.91 }, 'Fresh in-memory update, strict currency allowlist');
    assert.equal(databaseReads, 0, 'Public requests never trigger database/source work');
    f.updatedAt = new Date(Date.now() - 13 * 3600000).toISOString();
    response = await get(); data = await response.json();
    assert.equal(response.status, 503); assert.equal(data.stale, true);
    assert.equal(data.lastUpdated, f.updatedAt, 'A new official/global timestamp cannot hide stale parallel data');
    for (const timestamp of [null, 'invalid', new Date(Date.now() + 120000).toISOString()]) {
      f.updatedAt = timestamp; response = await get(); assert.equal(response.status, 503);
      assert.equal((await response.json()).data, null);
    }
    f.updatedAt = new Date().toISOString();
    for (const value of [undefined, 0, -1, NaN, Infinity]) {
      f.rates.parallel.EUR = value; response = await get();
      assert.equal(response.status, 503); assert.equal((await response.json()).data, null);
    }
    f.rates.parallel.EUR = 10.91;
    response = await get('', { method: 'POST', headers });
    assert.equal(response.status, 405); assert.match(response.headers.get('allow'), /GET/);
    response = await get('', { method: 'OPTIONS', headers });
    assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal((await get('', { headers: { 'User-Agent': 'node' } })).status, 403);
    f.config.apiConfig.enabled = false;
    assert.equal((await get()).status, 503);
    f.config.apiConfig.enabled = true;
    const admin = body => fetch(base + '/api/admin/api-config', { method: 'POST', headers: { ...headers, Authorization: 'Bearer ' + api.getAdminToken() }, body: JSON.stringify(body) });
    assert.equal((await fetch(base + '/api/admin/api-stats', { headers })).status, 401);
    for (const body of [{}, { enabled: 'true', rateLimitWindowMs: 60000, rateLimitMaxRequests: 20 },
      { enabled: true, rateLimitWindowMs: 0, rateLimitMaxRequests: 20 },
      { enabled: true, rateLimitWindowMs: 60000, rateLimitMaxRequests: 6 },
      { enabled: true, rateLimitWindowMs: 60000, rateLimitMaxRequests: 20, premiumApiKeys: ['injected'] }]) {
      assert.equal((await admin(body)).status, 400);
    }
    isolatedIPs = false;
    response = await admin({ enabled: true, rateLimitWindowMs: 120000, rateLimitMaxRequests: 2 });
    assert.equal(response.status, 200); assert.equal((await response.json()).persisted, true);
    assert.equal((await get()).status, 200); assert.equal((await get()).status, 200);
    response = await get('', { headers: { ...headers, 'X-Forwarded-For': '198.51.100.8, 127.0.0.1' } });
    assert.equal(response.status, 429, 'Spoofing a leftmost proxy address cannot evade the quota');
    assert(Number(response.headers.get('retry-after')) > 0);
    assert.equal(response.headers.get('access-control-allow-origin'), '*', 'Browser clients can read limit failures');
    assert.equal(api.bannedIPs.size, 0, 'API quota does not ban the entire site');
    assert.equal((await fetch(base + '/api/config', { headers })).status, 200);
    f.persisted = false;
    response = await admin({ enabled: true, rateLimitWindowMs: 120000, rateLimitMaxRequests: 4 });
    assert.equal((await response.json()).persisted, false);
    assert.equal((await get()).status, 200, 'Limit changes apply without restarting or resetting the window');
    assert.equal((await get()).status, 429, 'Existing request counts are preserved when the max changes');
    delete process.env.PREMIUM_API_KEY;
    response = await fetch(base + '/api/premium/rates', { headers: { ...headers, Authorization: 'Bearer premium-test-key-12345' } });
    assert.equal(response.status, 503, 'No built-in premium credential');
    process.env.PREMIUM_API_KEY = 'fixture-private-key';
    response = await fetch(base + '/api/premium/rates', { headers: { ...headers, Authorization: 'Bearer wrong' } });
    assert.equal(response.status, 403);
    response = await fetch(base + '/api/premium/rates', { headers: { ...headers, Authorization: 'Bearer fixture-private-key' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    for (let i = 0; i < 110; i++) await get();
    assert.equal(api.apiStats.public.recentRequests.length, 100);
    assert.equal(api.apiStats.public.totalRequests, api.apiStats.public.successfulRequests + api.apiStats.public.failedRequests);
    assert(api.apiStats.public.recentRequests.some(row => row.status === 429));
    for (let i = 0; i < 121; i++) await get();
    response = await get('', { headers: { ...headers, 'X-Forwarded-For': '198.51.100.99' } });
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error, 'API_BUSY', 'Aggregate ceiling protects against distributed requests');
    assert(Number(response.headers.get('retry-after')) > 0);
    assert.equal((await fetch(base + '/api/config', { headers })).status, 200, 'Aggregate API pressure does not block the website');
    console.log('PASS: USD/EUR-only live snapshot, no DB work, stale/missing/future data, methods/CORS, real dynamic quotas, trusted proxy IP, bounded logs, admin validation/auth and premium credentials.');
  } finally {
    if (originalPremium === undefined) delete process.env.PREMIUM_API_KEY; else process.env.PREMIUM_API_KEY = originalPremium;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCronSecret;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); delete globalThis.__apiFixture;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
