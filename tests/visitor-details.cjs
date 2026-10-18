const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const { transformSync, build } = require('esbuild');
const { io: connect } = require('socket.io-client');

const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(fetcher) {
  let now = Date.now();
  const mod = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync('server/services/visitor-details.service.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module: mod, exports: mod.exports, require, fetch: fetcher, AbortSignal,
    Date: class extends Date { static now() { return now; } }
  });
  return { ...mod.exports, advance: ms => { now += ms; } };
}
async function main() {
  let requests = 0, fail = false;
  const details = fixture(async (url, options) => {
    requests++; assert(url.startsWith('https://ipwho.is/')); assert(options.signal); assert.equal(options.redirect, 'error');
    if (fail) throw Error('fixture offline');
    return { ok: true, status: 200, json: async () => ({ success: true, country: 'Libya', city: 'Tripoli' }) };
  });
  const reduced = details.describeVisitor(android);
  assert.equal(reduced.deviceModel, ''); assert(!reduced.os.includes('10')); assert.equal(reduced.deviceType, 'Mobile');
  assert(details.describeVisitor(android.replace('Android 10; K', 'Android 14; SM-S918B')).deviceName.includes('Samsung'));
  const iphone = details.describeVisitor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');
  assert(iphone.os.startsWith('iOS')); assert.equal(iphone.deviceName, 'Apple iPhone');
  assert(details.describeVisitor(android + ' OPR/90.0').browser.startsWith('Opera'));
  assert.equal(details.describeVisitor('').deviceType, 'Unknown');
  assert.equal(details.describeVisitor(android + ' Googlebot').deviceType, 'Bot');
  assert.equal(details.visitorIp('1.2.3.4, 8.8.8.8', '127.0.0.1'), '8.8.8.8');
  assert.equal(details.visitorIp(undefined, '::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(details.visitorIp('https://example.com'), '');
  for (const ip of ['', 'bad', '127.0.0.1', '10.1.2.3', '172.31.0.1', '192.168.1.1', '100.64.0.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '224.0.0.1']) await details.locateVisitor(ip);
  assert.equal(requests, 0, 'No private/reserved/invalid address leaves the server');
  const locations = await Promise.all([details.locateVisitor('8.8.8.8'), details.locateVisitor('8.8.8.8')]);
  assert.equal(requests, 1); assert.equal(locations[0].locationStatus, 'approximate');
  await details.locateVisitor('8.8.8.8'); assert.equal(requests, 1);
  fail = true; assert.equal((await details.locateVisitor('1.1.1.1')).locationStatus, 'unavailable');
  await details.locateVisitor('1.1.1.1'); assert.equal(requests, 2, 'Failures also cached');
  details.advance(16 * 60000); await details.locateVisitor('1.1.1.1'); assert.equal(requests, 3);
  let release;
  const blocked = fixture(() => new Promise(resolve => { release = () => resolve({ ok: false, status: 503 }); }));
  const first = blocked.locateVisitor('8.8.8.8'); const releaseFirst = release;
  const second = blocked.locateVisitor('1.1.1.1'); const releaseSecond = release;
  assert.equal((await blocked.locateVisitor('9.9.9.9')).locationStatus, 'limited');
  releaseFirst(); releaseSecond(); await Promise.all([first, second]);
  let count = 0;
  const budget = fixture(async () => { count++; return { ok: false, status: 503 }; });
  for (let i = 1; i <= 21; i++) await budget.locateVisitor('8.8.4.' + i);
  assert.equal(count, 20);
  budget.advance(60001); await budget.locateVisitor('8.8.4.22'); assert.equal(count, 21);
  const quota = fixture(async () => ({ ok: false, status: 429 }));
  await quota.locateVisitor('8.8.8.8');
  assert.equal((await quota.locateVisitor('1.1.1.1')).locationStatus, 'limited');
  console.log('PASS device parsing, reduced-UA honesty, proxy IP, private addresses, HTTPS, caching, concurrency and quota limits');

  const state = { config: { enableUserTracking: true, terms: [] }, logs: [], lookups: [], rates: { parallel: { USD: 10 }, official: { USD: 6 }, lastUpdated: new Date().toISOString() } };
  global.__visitorFixture = { ...state, describeVisitor: details.describeVisitor, visitorIp: details.visitorIp };
  const mocks = {
    config: 'export const appConfig = globalThis.__visitorFixture.config; export const getAdminSafeConfig = () => ({ ...appConfig });',
    'maintenance.service': 'export const userLogs = globalThis.__visitorFixture.logs;',
    state: 'export const rates = globalThis.__visitorFixture.rates;',
    version: "export const serverStartTime = new Date(); export const getAppBuildSignature = () => 'fixture';",
    helpers: 'export const obfuscateData = value => value;',
    auth: "export const isAdminTokenValid = token => token === 'fixture-admin';",
    'push.service': 'export const queueRatePush = () => {};',
    'visitor-details.service': `export const {describeVisitor,visitorIp} = globalThis.__visitorFixture;
      export async function locateVisitor(ip) { globalThis.__visitorFixture.lookups.push(ip); await new Promise(r=>setTimeout(r,5)); return {location:ip,locationStatus:'approximate'}; }`
  };
  const built = await build({ entryPoints: ['server/socket/socket.service.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'isolate', setup(p) {
      p.onResolve({ filter: /^\./ }, args => mocks[path.basename(args.path)] ? { path: path.basename(args.path), namespace: 'mock' } : undefined);
      p.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests/visitor-isolated.cjs'), module);
  mod.paths = module.paths; mod._compile(built.outputFiles[0].text, mod.id);
  const server = http.createServer(), io = mod.exports.initSocketIO(server), clients = [];
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  async function client(id, options = {}) {
    const socket = connect(url, { autoConnect: false, transports: ['websocket'], query: { deviceId: id },
      extraHeaders: { 'user-agent': android, 'x-forwarded-for': '1.2.3.4, 8.8.8.8', ...options.headers }, auth: options.auth || {} });
    clients.push(socket); socket.on('visitor_details_request', () => socket.emit('visitor_device', { model: options.model || 'SM-S918B' }));
    socket.receivedPrices = []; socket.on('rates_update', data => socket.receivedPrices.push(data));
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    await pause(30); return socket;
  }
  try {
    const admin = await client('admin-device', { auth: { token: 'fixture-admin' } });
    const privateLogs = [], publicLogs = [];
    admin.on('user_logs', data => privateLogs.push(data));
    const one = await client('device-one'); one.on('user_logs', data => publicLogs.push(data));
    await client('device-two');
    assert.equal(state.logs.length, 2, 'Separate devices sharing an IP/UA remain separate');
    assert.equal(state.logs[0].ip, '8.8.8.8'); assert.equal(state.logs[0].deviceModel, 'SM-S918B');
    await client('device-one'); assert.equal(state.logs.length, 2); assert.equal(state.logs.find(l => l.deviceId === 'device-one').visits, 2);
    one.disconnect(); await pause(30); assert.equal(state.logs.find(l => l.deviceId === 'device-one').isOnline, true, 'Other tab remains online');
    const lookups = state.lookups.length;
    for (const options of [{ auth: { tracking: false } }, { headers: { dnt: '1' } }, { headers: { 'sec-gpc': '1' } }]) {
      const privateClient = await client('private-device', options); assert(privateClient.receivedPrices.length);
    }
    assert.equal(state.logs.length, 2); assert.equal(state.lookups.length, lookups);
    state.config.enableUserTracking = false; await client('disabled-device'); assert.equal(state.logs.length, 2);
    state.config.enableUserTracking = true;
    await client('invalid-model', { model: '<img src=x onerror=alert(1)>' });
    assert.equal(state.logs[0].deviceModel, '');
    assert.equal(publicLogs.length, 0); assert(privateLogs.length > 0);
    console.log('PASS real Socket.IO: admin-only details, DNT/GPC/config opt-out, live rates, same-IP devices, multiple tabs, validated model');
  } finally { clients.forEach(s => s.disconnect()); await new Promise(resolve => io.close(resolve)); delete global.__visitorFixture; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
