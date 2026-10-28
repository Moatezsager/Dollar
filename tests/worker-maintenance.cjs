const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

async function main() {
  const mod = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync('server/services/worker-maintenance.service.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: mod, exports: mod.exports, process, fetch: (...args) => global.fetch(...args), AbortSignal });
  const originalFetch = global.fetch;
  try {
    process.env.WORKER_SERVER_URL = 'https://worker.example/';
    process.env.WORKER_INTERNAL_SECRET = 'fixture-secret';
    for (const status of [202, 409]) {
      let request;
      global.fetch = async (...args) => { request = args; return { status }; };
      await mod.exports.requestWorkerMaintenance();
      assert.equal(request[0], 'https://worker.example/internal/jobs/maintenance');
      assert.equal(request[1].method, 'POST');
      assert.equal(request[1].headers['X-Worker-Secret'], 'fixture-secret');
      assert.equal(request[1].headers['User-Agent'], 'Dollar-Price-Web/1.0');
    }
    global.fetch = async () => ({ status: 401 });
    await assert.rejects(mod.exports.requestWorkerMaintenance(), /HTTP 401/);
    delete process.env.WORKER_INTERNAL_SECRET;
    await assert.rejects(mod.exports.requestWorkerMaintenance(), /غير مضبوطين/);
    console.log('PASS: Worker maintenance dispatch validates configuration, authentication response and accepted/already-running states.');
  } finally {
    global.fetch = originalFetch;
    delete process.env.WORKER_SERVER_URL;
    delete process.env.WORKER_INTERNAL_SECRET;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
