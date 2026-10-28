const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const { build, transformSync } = require('esbuild');
const express = require('express');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function main() {
  let run;
  const fixture = globalThis.__httpLifecycle = {
    config: { terms: [{ id: 'USD', name: 'Dollar', flag: 'us' }], telegramBotToken: 'isolated-fixture',
      telegramPostChannel: 'fixture-channel', facebookPageId: 'fixture-page', facebookAccessToken: 'fixture-only' },
    rates: { parallel: { USD: 10, EUR: 11 }, previousParallel: { USD: 9.9 }, official: { USD: 6.4 }, lastUpdated: '2026-10-21T15:00:00Z' },
    work: async name => { run.work.push(name); run.ready.resolve(); await run.release.promise; if (run.fail) throw Error('isolated upstream failure'); },
  };
  const mocks = {
    config: 'export const appConfig = globalThis.__httpLifecycle.config;',
    state: 'export const rates = globalThis.__httpLifecycle.rates; export const history = []; export const serverStartTime = new Date();',
    db: `export const db = {}; export const supabaseAnonKey = 'fixture'; export const supabase = {from: () => {
      const q = {select:()=>q,order:()=>q,limit:()=>q,then:(resolve,reject)=>globalThis.__httpLifecycle.work('recent').then(()=>({data:[],error:null})).then(resolve,reject)}; return q;
    }};`,
    'db.service': `export const initializeRatesFromDB = async force => { globalThis.__httpLifecycle.force = force; await globalThis.__httpLifecycle.work('rates'); };
      export const fetchHistoryFromSupabase = async () => { await globalThis.__httpLifecycle.work('history'); return []; };
      export const logErrorArabic = async () => { try { await globalThis.__httpLifecycle.work('error-log'); } catch {} };
      export const recentChangesLog = []; export const getParallelUpdatedAt = () => '2026-10-21T15:00:00Z';
      export const logPriceChange = async () => {}; export const syncCheckRates = async () => {}; export const saveToSupabase = async () => {};`,
    'social.service': `const work = async () => { await globalThis.__httpLifecycle.work('telegram'); return true; };
      export const broadcastOfficialRates = work; export const broadcastRateChanges = work; export const forwardVisitorMessageToTelegram = work;
      export const getOrInitTelegramManager = () => ({ sendFile:work,sendMessage:work,isConnected:()=>true,fetchMessages:async()=>[] });`,
    'alert.service': 'export const sendCriticalErrorAlert = async () => { await globalThis.__httpLifecycle.work("alert"); return true; };',
    'socket.service': 'export const broadcastRatesUpdate = () => {}; export const getIO = () => null;',
    'weekly-harvest.service': 'export const readWeeklyHarvest = async () => { await globalThis.__httpLifecycle.work("harvest"); return {items:[]}; };',
    'analytics.service': 'export const readAnalytics = async () => ({});',
    'analytics-tracking': 'export const analyticsWriteHealth = {};',
    'scraper.service': 'export const extractRatesFromText = () => [];',
    version: "export const serverStartTime = new Date(); export const getAppBuildSignature = () => 'fixture';",
    helpers: 'export const obfuscateData = value => value; export const isSignificantChange = () => false;',
  };
  const result = await build({ stdin: { contents: `
    export * from './server/middleware/auth'; export {timeoutMiddleware} from './server/middleware/security';
    export {default as ratesRouter} from './server/routes/rates.routes';
    export {default as telegramRouter} from './server/routes/admin/telegram.routes';
    export {default as whatsappRouter} from './server/routes/admin/whatsapp.routes';
    export {default as systemRouter} from './server/routes/system.routes';
    export {createAdminSystemRouter} from './server/routes/admin/system.routes';
  `, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'no-production-http-fixture', setup(plugin) {
      plugin.onResolve({ filter: /^\./ }, args => mocks[path.basename(args.path)] ? { path: path.basename(args.path), namespace: 'fixture' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }] });
  const mod = new Module(path.join(process.cwd(), 'tests/http-isolated.cjs'), module);
  mod.filename = mod.id; mod.paths = module.paths; mod._compile(result.outputFiles[0].text, mod.filename);
  const web = mod.exports;
  const adminSystemRouter = web.createAdminSystemRouter({ getOnlineUsers: () => 0, apiStats: {}, getUserLogs: () => [] });
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => {
    const requestRun = run;
    res.setTimeout = (limit, callback) => { requestRun.limit = limit; requestRun.timeout = callback; return res; };
    const json = res.json.bind(res), setHeader = res.setHeader.bind(res);
    res.json = body => { if (res.headersSent || res.destroyed) requestRun.lateWrites++; return json(body); };
    res.setHeader = (...args) => { if (res.headersSent || res.destroyed) requestRun.lateWrites++; return setHeader(...args); };
    res.once('close', () => requestRun.closed.resolve());
    next();
  });
  // Observe the real handlers' rejected promises instead of allowing an unhandled process error in the fixture.
  for (const router of [web.ratesRouter, web.telegramRouter, web.whatsappRouter, web.systemRouter, adminSystemRouter]) {
    for (const layer of router.stack) for (const route of layer.route?.stack || []) {
      const handle = route.handle;
      route.handle = (req, res, next) => {
        const promise = handle(req, res, next);
        if (promise?.then) run.pending.push(promise.catch(error => {
          run.rejections.push(error);
          if (!res.headersSent && !res.destroyed) res.status(500).end();
        }));
      };
    }
  }
  app.use(web.timeoutMiddleware);
  app.use('/api/admin', web.requireAdmin, web.telegramRouter, web.whatsappRouter, adminSystemRouter);
  app.use('/api', web.ratesRouter, web.systemRouter);
  const server = http.createServer(app);
  const realFetch = global.fetch, realWarn = console.warn, realError = console.error;
  const oldEnv = Object.fromEntries(['WORKER_SERVER_URL', 'WORKER_INTERNAL_SECRET', 'PREMIUM_API_KEY'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { WORKER_SERVER_URL: 'https://worker.invalid', WORKER_INTERNAL_SECRET: 'fixture-only', PREMIUM_API_KEY: 'fixture-only' });
  const failures = [];
  console.warn = (...args) => run.warnings.push(args);
  console.error = (...args) => run.errors.push(args);
  global.fetch = async url => {
    assert(/^(https:\/\/api\.telegram\.org\/botisolated-fixture\/|https:\/\/worker\.invalid\/api\/whatsapp\/)/.test(String(url)), 'External request blocked');
    await fixture.work('fetch');
    return new Response(JSON.stringify({ ok: true, result: { id: 1 }, success: true }), { status: 200 });
  };
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(16)]).toString('base64');
  const endpoints = [
    ['GET', '/api/admin/weekly-harvest/data'],
    ['GET', '/api/rates?refresh=true'], ['GET', '/api/history'], ['GET', '/api/recent-changes'],
    ['GET', '/api/premium/rates'], ['POST', '/api/logs/error', { message: 'isolated fixture' }],
    ['GET', '/api/admin/telegram/bot-status?detectChatId=true'],
    ['POST', '/api/admin/telegram/test-contact'], ['POST', '/api/admin/telegram/test-error-alert'],
    ['POST', '/api/admin/telegram/official-broadcast'], ['POST', '/api/admin/telegram/test-broadcast'],
    ['POST', '/api/admin/facebook/test-broadcast'],
    ['POST', '/api/admin/weekly-harvest/send-telegram', { destination: 'me', caption: 'fixture', imageBase64: 'data:image/png;base64,' + png }],
    ['GET', '/api/admin/whatsapp/status'], ['GET', '/api/admin/whatsapp/qr'],
    ['POST', '/api/admin/whatsapp/init'], ['POST', '/api/admin/whatsapp/disconnect'],
    ['POST', '/api/admin/whatsapp/toggle-auto', { enabled: true }],
    ['POST', '/api/telegram/send-message', { channel: 'fixture', message: 'fixture' }],
  ];
  try {
    for (const [requestPath, query, expected] of [['/api/rates', {}, 5000], ['/api/history', {}, 15000],
      ['/api/push/subscribe', {}, 15000], ['/api/admin/cleanup', {}, 15000],
      ['/api/internal/notify-rates-updated', {wait:'true'}, 20000], ['/api/internal/notify-rates-updated', {}, 5000]]) {
      let limit;
      web.timeoutMiddleware({path:requestPath,query}, {setTimeout:value=>{limit=value;}}, ()=>{});
      assert.equal(limit, expected);
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    for (const [method, url, body] of endpoints) for (const mode of ['success', 'failure', 'timeout', 'timeout-failure', 'disconnect']) {
      run = { ready: deferred(), release: deferred(), closed: deferred(), pending: [], rejections: [], warnings: [], errors: [], work: [], lateWrites: 0, fail: mode.includes('failure') };
      const token = url.includes('/premium/') ? 'fixture-only' : web.getAdminToken();
      const request = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Dollar-HTTP-Fixture/1.0' } });
      request.setTimeout(2000, () => request.destroy(Error('Isolated HTTP fixture stalled')));
      const reply = new Promise((resolve, reject) => {
        request.on('response', response => { response.resume(); response.on('end', () => resolve(response)); });
        request.on('error', error => mode === 'disconnect' ? resolve(null) : reject(error));
      });
      request.end(body && JSON.stringify(body));
      await Promise.race([run.ready.promise, reply.then(() => { throw Error('Route returned before reaching its isolated dependency: ' + url); })]);
      assert.equal(run.limit, url.includes('/history') ? 15000 : 5000, 'Existing HTTP budgets remain unchanged');
      if (mode.startsWith('timeout')) { run.timeout(); await reply; }
      if (mode === 'disconnect') { request.destroy(); await run.closed.promise; }
      run.release.resolve();
      const response = await reply;
      await Promise.all(run.pending);
      try {
        assert.equal(run.lateWrites, 0, 'No response writes after timeout or disconnect');
        assert.equal(run.rejections.length, 0, 'No unhandled handler rejection');
        assert(!run.errors.some(args => args.some(value => value?.code === 'ERR_HTTP_HEADERS_SENT')), 'No header-error noise');
        if (mode.startsWith('timeout')) {
          assert.equal(response.statusCode, 408);
          assert.equal(response.headers['cache-control'], 'no-store', 'A timeout must never inherit public price caching');
          assert.equal(run.warnings.length, 1);
          const diagnostic = JSON.stringify(run.warnings[0]);
          assert(diagnostic.includes(url.split('?')[0]) && !diagnostic.includes('?'), 'Timeout records the path, not query values');
        } else if (mode === 'success') assert.equal(response.statusCode, 200);
        else if (mode === 'failure') assert(response.statusCode >= 500 || ['/api/recent-changes', '/api/logs/error'].includes(url));
        if (mode === 'failure' && url.startsWith('/api/rates?')) assert.equal(response.headers['cache-control'], 'no-store');
      } catch (error) { failures.push(`${mode} ${url}: ${error.message}`); }
    }
    // Exercise the real global rejection callback without importing startup, environment files or production services.
    const source = ts.createSourceFile('server.ts', fs.readFileSync('server.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const registration = source.statements.find(statement => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
      && statement.expression.expression.getText(source) === 'process.on' && statement.expression.arguments[0]?.text === 'unhandledRejection');
    assert(registration);
    const isolated = { exports: {} }, logs = [];
    const code = transformSync('module.exports = ' + registration.expression.arguments[1].getText(source), { loader: 'ts', format: 'cjs' }).code;
    vm.runInNewContext(code, { module: isolated, Error, console: { error() {} }, logErrorArabic: async (...args) => logs.push(args) });
    const error = Error('isolated rejection');
    await isolated.exports(error, Promise.resolve());
    await isolated.exports('non-error rejection', Promise.resolve());
    try { assert.equal(logs[0][2], error.stack); assert.equal(logs[1][2], 'non-error rejection'); }
    catch (error) { failures.push('Global rejection diagnostics: ' + error.message); }
    if (failures.length) throw Error(failures.join('\n'));
    realWarn(`PASS: ${endpoints.length} real HTTP routes; success/failure, timeout, late failure and disconnected clients; unchanged deadlines, no duplicate responses, no-store timeout diagnostics and complete rejection stacks. No production calls.`);
  } finally {
    global.fetch = realFetch; console.warn = realWarn; console.error = realError;
    for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    delete globalThis.__httpLifecycle;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
