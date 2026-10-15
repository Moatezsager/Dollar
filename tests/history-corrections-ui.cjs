const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const vite = await createServer({ configFile: false, plugins: [react()],
    cacheDir: path.join(require('node:os').tmpdir(), 'dollar-correction-ui-cache'),
    resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'motion/react', 'lucide-react'] },
    server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  vite.middlewares.use('/__test', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__test', `<!doctype html><html><body><div id="root"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {AdminDatabase} from '/src/components/AdminDatabase.tsx';
      createRoot(document.getElementById('root')).render(React.createElement(AdminDatabase,{token:'fixture',config:{terms:[{id:'USD',name:'USD'}]}}));
    </script></body></html>`); res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await vite.listen(); let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
    const page = await browser.newPage(); let partial = false, deleted = false, saved = [];
    await page.route('**/api/**', route => {
      assert.equal(route.request().headers().authorization, 'Bearer fixture');
      const method = route.request().method();
      if (method === 'PUT') saved.push(route.request().postDataJSON());
      if (method === 'DELETE') deleted = true;
      return route.fulfill({ json: method === 'GET'
        ? { success: true, records: deleted ? [] : [{ id: 'one', recorded_at: new Date().toISOString(), value: 6.4004 }] }
        : { success: true, historyUpdated: !partial, message: partial ? 'تم الحفظ؛ تعذر تحديث الرسوم' : 'تم تصحيح السجل وتحديث الرسوم البيانية' } });
    });
    await page.goto('http://127.0.0.1:' + vite.httpServer.address().port + '/__test', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTitle('تعديل السعر').click();
    await page.getByLabel('السعر المصحح').fill('6.4005');
    await page.getByTitle('حفظ', { exact: true }).click();
    await page.getByText('تم تصحيح السجل وتحديث الرسوم البيانية', { exact: true }).waitFor();
    assert.equal(saved[0].value, '6.4005');
    partial = true;
    await page.getByTitle('تعديل السعر').click();
    await page.getByTitle('حفظ', { exact: true }).click();
    await page.getByText('تم الحفظ؛ تعذر تحديث الرسوم', { exact: true }).waitFor();
    page.on('dialog', dialog => dialog.accept());
    await page.getByTitle('حذف السجل').click();
    await page.getByText('لا توجد سجلات مسجلة حالياً لهذه العملة.').waitFor();
    await page.getByText('تم الحفظ؛ تعذر تحديث الرسوم', { exact: true }).waitFor();
    console.log('PASS: actual admin record editor preserves decimal input and shows correction/partial-failure messages after reload and deletion.');
  } finally { await browser?.close(); await vite.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
