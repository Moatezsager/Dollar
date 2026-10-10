const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const express = require('express');
const { io: connectSocket } = require('socket.io-client');

async function loadIsolatedWeb() {
  const mock = {
    config: "export const appConfig = globalThis.__adminTest.config;",
    db: "export const db = globalThis.__adminTest.db; export const supabase = globalThis.__adminTest.supabase; export const supabaseAnonKey = 'fixture-key';",
    state: "export const rates = globalThis.__adminTest.rates; export const serverStartTime = new Date();",
    'maintenance.service': "export const userLogs = [{id:'fixture-visitor'}];",
    'push.service': "export const queueRatePush = () => {};",
    'social.service': "export const getOrInitTelegramManager = () => ({});",
    version: "export const serverStartTime = new Date(); export const getAppBuildSignature = () => 'fixture';",
    helpers: "export const obfuscateData = data => data;",
  };
  const result = await build({
    stdin: { contents: `
      export * from './server/middleware/auth';
      export * from './server/socket/socket.service';
      export * from './server/services/alert.service';
      export * from './server/routes/admin/system.routes';
      export { default as authRouter } from './server/routes/admin/auth.routes';
      export { TelegramManager } from './telegramClient';
    `, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{
      name: 'isolated-admin-dependencies',
      setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, args => {
          if (!args.path.startsWith('.')) return;
          const name = path.basename(args.path);
          if (mock[name]) return { path: name, namespace: 'fixture' };
        });
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mock[args.path], loader: 'js' }));
      },
    }],
  });
  const isolated = new Module(path.join(process.cwd(), 'tests', 'admin-isolated.cjs'), module);
  isolated.filename = isolated.id;
  isolated.paths = module.paths;
  isolated._compile(result.outputFiles[0].text, isolated.filename);
  return isolated.exports;
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  let countQueries = 0;
  let databaseFailure = false;
  let sends = [];
  let deliveryOK = true;
  globalThis.__adminTest = {
    config: { channels: ['fixture'], terms: [{id:'USD', regex: '(1)'}], enableUserTracking: false,
      telegramBotToken: '123456789:fixture_token_for_testing_only_12345', telegramAdminChatId: '42' },
    db: { prepare: () => ({ get: () => ({ count: 5 }), all: () => [] }) },
    supabase: {
      from(table) {
        const query = {
          select(_fields, options) { if (options?.count) countQueries++; return query; },
          eq() { return query; }, maybeSingle() { return query; }, order() { return query; }, limit() { return query; },
          then(resolve, reject) {
            return Promise.resolve({ data: table === 'telegram_visits' ? { visits_count: 2 } : [],
              count: 5, error: databaseFailure ? { message: 'fixture database failure' } : null }).then(resolve, reject);
          },
        };
        return query;
      },
    },
    rates: { parallel: {USD:9.7}, official:{USD:6.4}, previousParallel:{}, previousOfficial:{}, lastChanged:{official:{},parallel:{}}, lastUpdated:new Date().toISOString() },
  };
  const realFetch = global.fetch;
  const realNow = Date.now;
  const oldChat = process.env.TELEGRAM_CHAT_ID;
  const oldAdminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const oldPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'fixture-password';
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  const web = await loadIsolatedWeb();
  let server, io, sockets = [];
  try {
    global.fetch = async (url, options) => {
      assert(String(url).startsWith('https://api.telegram.org/'), 'No external service may be accessed');
      assert(options.signal, 'Telegram requests must be bounded');
      sends.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: deliveryOK }), { status: deliveryOK ? 200 : 503 });
    };
    await web.checkAndAlertIfCritical('Failed to fetch', 'visitor network', {source:'client'});
    await web.checkAndAlertIfCritical('fatal database error', 'uncaughtException Security', {source:'client'});
    await web.checkAndAlertIfCritical('Supabase configured', 'configuration');
    assert.equal(sends.length, 0, 'Noise/client claims are not critical server alerts');
    await web.checkAndAlertIfCritical('Failed to fetch', 'uncaughtException');
    assert.equal(sends.length, 1, 'A fatal server error must not be hidden by the network-noise filter');
    await web.checkAndAlertIfCritical('Failed to fetch', 'uncaughtException');
    assert.equal(sends.length, 1, 'Duplicate fatal alerts are suppressed');
    await web.checkAndAlertIfCritical('Supabase database timeout', 'database');
    assert.equal(sends.length, 2, 'Critical database timeouts are reported');
    await web.checkAndAlertIfCritical('فشل حفظ البيانات في قاعدة البيانات', 'حفظ البيانات');
    assert.equal(sends.length, 3, 'Arabic database failures are recognized');
    await web.checkAndAlertIfCritical('render failed', 'ErrorBoundary', {source:'client'});
    await web.checkAndAlertIfCritical('render failed', 'ErrorBoundary', {source:'client'});
    assert.equal(sends.length, 3, 'Isolated visitor crashes do not flood the admin');
    await web.checkAndAlertIfCritical('render failed', 'ErrorBoundary', {source:'client'});
    assert.equal(sends.length, 4, 'Repeated render crashes produce a warning');
    deliveryOK = false;
    const retry = {context:'retry-case', description:'critical fixture'};
    assert.equal(await web.sendCriticalErrorAlert(retry), false);
    deliveryOK = true;
    assert.equal(await web.sendCriticalErrorAlert(retry), true, 'Failed delivery must not suppress a retry for 15 minutes');
    const token = __adminTest.config.telegramBotToken;
    await web.sendCriticalErrorAlert({ context:'redaction', description:token, url:'https://example.test/path?token=private' });
    assert(!sends.at(-1).text.includes(token));
    assert(!sends.at(-1).text.includes('token=private'));
    await web.sendCriticalErrorAlert({context:'truncated-secret',description:'fixture',technicalDetails:'x'.repeat(390)+token});
    assert(!sends.at(-1).text.includes(token.slice(0,10)), 'Redact secrets before truncating details');
    await web.checkAndAlertIfCritical('JavaScript heap out of memory', 'runtime');
    assert(sends.at(-1).text.includes('حرج (Critical)'), 'Memory exhaustion is critical');
    __adminTest.config.telegramAdminChatId = '';
    const beforeMissingChat = sends.length;
    assert.equal(await web.sendCriticalErrorAlert({context:'missing-chat',description:'fixture'}), false);
    assert.equal(sends.length, beforeMissingChat, 'No hard-coded recipient fallback is allowed');
    __adminTest.config.telegramAdminChatId = '42';
    const manager = new web.TelegramManager(0, '', '', token, '42');
    assert.equal(await manager.sendMessage('me', '<b>visitor</b>', {parseMode:'html',linkPreview:false}), true);
    assert.equal(sends.at(-1).chat_id, '42');
    assert.equal(sends.at(-1).parse_mode, 'HTML');
    const withoutChat = new web.TelegramManager(0, '', '', token, '');
    const beforeAutoDetect = sends.length;
    assert.equal(await withoutChat.sendViaBotApi('me', 'private visitor message'), false);
    assert.equal(sends.length, beforeAutoDetect, 'Never choose the last bot visitor as the admin');
    console.log('PASS: important alerts, cooldown, failed-send retry, redaction and private bot delivery');

    global.fetch = realFetch;
    const app = express();
    app.use(express.json());
    app.use('/api/admin', web.authRouter);
    const apiStats = {public:{totalRequests:0},premium:{totalRequests:0},bannedIPsCount:0};
    app.use('/api/admin', web.createAdminSystemRouter({getOnlineUsers:()=>2,getUserLogs:()=>[],apiStats}));
    server = http.createServer(app);
    io = web.initSocketIO(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stats = await (await fetch(base+'/api/admin/stats')).json();
    assert.equal(stats.scope, 'web');
    assert.equal(stats.dbConnected, true);
    assert.equal(stats.lastRateUpdate, __adminTest.rates.lastUpdated);
    const report = await (await fetch(base+'/api/admin/system-report')).json();
    assert.equal(report.scope, 'web');
    assert.equal(report.overall_health.score, null);
    assert.equal(report.whatsapp_status.status, 'unknown');
    assert.equal(report.telegram_status.is_authenticated, null);
    assert.equal(countQueries, 4, 'Dashboard and report reuse one expensive count snapshot');
    databaseFailure = true;
    Date.now = () => realNow() + 61000;
    const failedStats = await (await fetch(base+'/api/admin/stats')).json();
    assert.equal(failedStats.dbConnected, false);
    assert.equal(failedStats.dbStats.parallelRatesCount, null);
    Date.now = realNow;
    console.log('PASS: Web stats/report without Worker globals, honest unknowns and bounded count queries');

    web.setAdminToken('fixture-admin-token');
    const publicClient = connectSocket(base, {autoConnect:false,transports:['websocket'],query:{role:'admin'},auth:{isAdmin:true}});
    const adminClient = connectSocket(base, {autoConnect:false,transports:['websocket'],auth:{token:'fixture-admin-token'}});
    sockets.push(publicClient, adminClient);
    const publicConfig = [], adminConfig = [], publicLogs = [], adminLogs = [], prices = [];
    publicClient.on('config_update', data=>publicConfig.push(data));
    adminClient.on('config_update', data=>adminConfig.push(data));
    publicClient.on('user_logs', data=>publicLogs.push(data));
    adminClient.on('user_logs', data=>adminLogs.push(data));
    publicClient.on('rates_update', data=>prices.push(data));
    await Promise.all(sockets.map(socket=>new Promise((resolve,reject)=>{
      socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();
    })));
    publicClient.emit('join_admin');
    await pause(50);
    web.broadcastConfigUpdate();
    web.broadcastUserLogs();
    await pause(50);
    assert.deepEqual(Object.keys(publicConfig.at(-1).config), ['terms']);
    assert.equal(adminConfig.at(-1).config.telegramBotToken, token);
    assert.equal(publicLogs.length, 0, 'Client admin flags cannot expose visitor logs');
    assert.equal(adminLogs.length, 1);
    assert(prices.length > 0, 'Public live prices still receive a connection snapshot');
    web.broadcastRatesUpdate({...__adminTest.rates, parallel:{USD:9.8}});
    await pause(30);
    assert.equal(prices.at(-1).rates.parallel.USD, 9.8);
    Date.now = () => realNow() + 25*60*60*1000;
    const previousLogCount = adminLogs.length;
    web.broadcastUserLogs();
    await pause(30);
    assert.equal(adminLogs.length, previousLogCount, 'Expired admin connections cannot receive private events');
    const loginResponse = await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'fixture-password'})});
    assert.equal(loginResponse.status,200);
    const renewedLogin = await loginResponse.json();
    assert(renewedLogin.success && renewedLogin.token !== 'fixture-admin-token');
    assert(web.isAdminTokenValid(renewedLogin.token),'Login must renew an expired token');
    Date.now = realNow;
    const invalid = connectSocket(base,{autoConnect:false,transports:['websocket'],auth:{token:'wrong'},reconnection:false});
    sockets.push(invalid);
    assert.equal(await new Promise(resolve=>{invalid.once('connect_error',err=>resolve(err.message));invalid.connect();}), 'ADMIN_UNAUTHORIZED');
    console.log('PASS: Socket.IO authorization, expiry, public config filtering and unchanged live prices');
  } finally {
    Date.now = realNow;
    global.fetch = realFetch;
    if (oldChat === undefined) delete process.env.TELEGRAM_CHAT_ID; else process.env.TELEGRAM_CHAT_ID = oldChat;
    if (oldAdminChat === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_ID; else process.env.TELEGRAM_ADMIN_CHAT_ID = oldAdminChat;
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = oldPassword;
    sockets.forEach(socket=>socket.disconnect());
    if (io) await new Promise(resolve=>io.close(resolve));
    else if (server) await new Promise(resolve=>server.close(resolve));
    delete globalThis.__adminTest;
  }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
