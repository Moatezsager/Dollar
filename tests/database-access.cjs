const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');
const { transformSync } = require('esbuild');

function load(file, mocks, env = {}) {
  const module = { exports: {} };
  const source = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(source, { module, exports: module.exports, process: { env }, Date, Buffer,
    console: { log() {}, warn() {}, error() {} }, require(name) {
      if (!Object.hasOwn(mocks, name)) throw new Error('Unexpected dependency: ' + name);
      return mocks[name];
    } }, { filename: file });
  return module.exports;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const db = { pragma() {}, exec() {}, prepare: () => ({ get() {}, run: () => ({ changes: 0 }) }) };
  let selectedKey, options;
  const mocks = { 'better-sqlite3': function () { return db; }, '@supabase/supabase-js': {
    createClient: (url, key, opts) => { selectedKey = key; options = opts; return {}; }
  } };
  const env = { VITE_SUPABASE_URL: 'https://fixture.invalid', VITE_SUPABASE_ANON_KEY: 'browser-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'server-fixture', NODE_ENV: 'production' };
  load(path.join(root, 'server/db.ts'), mocks, env);
  assert.equal(selectedKey, 'server-fixture'); assert.equal(options.auth.persistSession, false);
  assert.equal(options.auth.autoRefreshToken, false);
  assert.throws(() => load(path.join(root, 'server/db.ts'), mocks, { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }), /SERVICE_ROLE_KEY is required/);
  load(path.join(root, 'server/db.ts'), mocks, { ...env, SUPABASE_SERVICE_ROLE_KEY: '', NODE_ENV: 'development' });
  assert.equal(selectedKey, 'browser-fixture');
  assert(!fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'));
  console.log('PASS: server-only database credential, production fail-closed and separate browser key');

  let filter;
  const router = load(path.join(root, 'server/routes/admin/logs.routes.ts'), {
    express, '../../db': { supabaseAnonKey: 'fixture', supabase: { from: table => {
      assert.equal(table, 'error_logs');
      return { delete: () => ({ not: async (...args) => { filter = args; return { error: null }; } }) };
    } } }, '../../services/broadcastLog.service': {}, '../../services/social.service': {}
  }).default;
  const app = express(); app.use(router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/error-logs`, { method: 'DELETE' });
    assert.equal(response.status, 200); assert.deepEqual(Array.from(filter), ['id', 'is', null]);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: actual error-log route uses a filter compatible with integer primary keys');

  const roots = [root];
  if (process.env.WORKER_PROJECT_PATH) roots.push(path.resolve(process.env.WORKER_PROJECT_PATH));
  for (const project of roots) {
    let inserted, cutoff;
    const loggerFile = path.join(project, 'server/utils/logger.ts');
    const service = load(path.join(project, 'server/services/broadcastLog.service.ts'), {
      '../utils/logger': fs.existsSync(loggerFile) ? load(loggerFile, {}) : {},
      '../db': { db, supabaseAnonKey: 'fixture', supabaseKey: 'fixture', supabase: {
        from: () => ({ insert: value => { inserted = value; return Promise.resolve({ error: null }); },
          delete: () => ({ lt: async (column, value) => { cutoff = value; return { error: null }; } }) })
      } }
    });
    service.addBroadcastLog({ platform: 'telegram', currency_ids: ['USD'], status: 'success', attempts: 1 });
    await service.cleanupOldBroadcastLogs();
    assert.equal(typeof inserted.created_at, 'string'); assert(Number.isFinite(Date.parse(inserted.created_at)));
    assert.equal(typeof cutoff, 'string'); assert(Number.isFinite(Date.parse(cutoff)));
  }
  console.log('PASS: Web/Worker broadcast timestamps match the remote timestamptz schema');
  if (process.env.WORKER_PROJECT_PATH) {
    const sql = fs.readFileSync(path.join(process.env.WORKER_PROJECT_PATH, 'supabase_security_hardening.sql'), 'utf8');
    assert(/created_at timestamptz not null/.test(sql));
    assert(/enable row level security/.test(sql));
    assert(/from public, anon, authenticated/.test(sql));
    assert(/grant select, insert, update, delete/.test(sql));
    assert(/grant execute on function public.increment_telegram_visits/.test(sql));
    assert(!/drop table|disable row level security|insert into|update public\./i.test(sql));
    assert(sql.indexOf('begin;') < sql.indexOf('create table'));
    assert(sql.indexOf('grant execute') < sql.indexOf('commit;'));
    console.log('PASS: static migration safeguards and no application-data mutation (not PostgreSQL execution)');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
