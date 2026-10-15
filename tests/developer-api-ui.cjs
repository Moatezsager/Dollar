const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const vite = await createServer({ configFile: false, plugins: [react(), tailwind()],
    cacheDir: path.join(require('node:os').tmpdir(), 'dollar-api-vite-cache'),
    resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
    server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  vite.middlewares.use('/__api-test', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__api-test', `<!doctype html><html dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root" class="app-shell"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {Developers} from '/src/Developers.tsx';
      import {AdminAPI} from '/src/components/AdminAPI.tsx';
      import '/src/index.css';
      const admin = new URLSearchParams(location.search).has('admin');
      createRoot(document.getElementById('root')).render(React.createElement(admin ? AdminAPI : Developers, admin ? {token:'fixture', config:{}, setConfig:value=>window.savedConfig=value} : {onBack:()=>{},onContact:()=>window.contactOpened=true}));
    </script></body></html>`);
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await vite.listen();
  const base = 'http://127.0.0.1:' + vite.httpServer.address().port;
  const output = path.join(require('node:os').tmpdir(), 'Dollar-developer-api-proof');
  await fs.mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      let publicRequests = 0, saveRequests = [], saveFailure = false;
      let settings = { enabled: true, rateLimitWindowMs: 60000, rateLimitMaxRequests: 5 };
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/public/rates') {
          publicRequests++;
          return route.fulfill({ json: { success: true, stale: false, data: {USD:9.88,EUR:10.91}, lastUpdated:new Date().toISOString() } });
        }
        assert.equal(route.request().headers().authorization, 'Bearer fixture');
        if (url.pathname === '/api/admin/api-config') {
          saveRequests.push(route.request().postDataJSON());
          if (saveFailure) return route.fulfill({ status: 503, json: { error: 'تعذر الحفظ التجريبي' } });
          settings = saveRequests.at(-1);
          return route.fulfill({ json: { success: true, persisted: true, config: settings } });
        }
        return route.fulfill({ json: { config: settings, since: new Date().toISOString(), premiumConfigured: false,
          public: { totalRequests: 2, successfulRequests: 1, failedRequests: 1, recentRequests: [
            { timestamp: new Date().toISOString(), status:200, responseTime:2, ip:'2001:db8:1234:5678:1234:5678:1234:5678' },
            { timestamp: new Date().toISOString(), status:429, responseTime:1, ip:'127.0.0.1' }
          ] } } });
      });
      await page.goto(base + '/__api-test');
      await page.getByRole('heading', { name: 'بوابة المطورين', exact: true }).waitFor();
      assert.equal(publicRequests, 0, 'Opening docs never polls prices');
      assert.equal(await page.getByRole('link', {name:'فتح رابط API'}).getAttribute('href'), 'https://dollar-price-qp14.onrender.com/api/public/rates');
      await page.getByRole('button', {name:'اتصل بنا لطلب الاشتراك'}).click();
      assert.equal(await page.evaluate(() => window.contactOpened), true);
      await page.getByRole('button', { name: 'Python', exact: true }).click();
      assert.match(await page.locator('pre').first().innerText(), /timeout=8/);
      await page.getByRole('button', { name: 'cURL', exact: true }).click();
      assert.match(await page.locator('pre').first().innerText(), /MyRatesApp\/1.0/);
      await page.getByRole('button', { name: 'إرسال طلب', exact: true }).click();
      await page.getByText('HTTP 200', { exact: true }).waitFor();
      assert.equal(publicRequests, 1);
      assert.match(await page.getByLabel('استجابة API').innerText(), /9.88/);
      await page.getByRole('button', { name: 'إرسال طلب', exact: true }).click();
      assert.equal(publicRequests, 1, 'Rapid manual retries are bounded');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Public docs fit viewport');
        await page.screenshot({ path: path.join(output, 'developers-' + theme + '-' + width + '.png'), fullPage: true });
      }
      await page.goto(base + '/__api-test?admin');
      await page.getByRole('button', { name: 'حفظ الإعدادات' }).waitFor();
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      await page.getByLabel('مدة الحصة بالدقائق').fill('2');
      assert.equal(await page.getByLabel('عدد الطلبات لكل عنوان IP').getAttribute('max'), '5');
      await page.getByLabel('عدد الطلبات لكل عنوان IP').fill('4');
      await page.getByRole('button', { name: 'تحديث الإحصاءات' }).click();
      assert.equal(await page.getByLabel('عدد الطلبات لكل عنوان IP').inputValue(), '4', 'Refreshing metrics preserves unsaved drafts');
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
      await page.getByRole('status').getByText('تم حفظ الإعدادات وتطبيقها.', { exact: true }).waitFor();
      assert.deepEqual(saveRequests[0], { enabled: true, rateLimitWindowMs: 120000, rateLimitMaxRequests: 4 });
      assert.equal(await page.evaluate(() => window.savedConfig.apiConfig.rateLimitMaxRequests), 4);
      saveFailure = true;
      await page.getByLabel('عدد الطلبات لكل عنوان IP').fill('3');
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('عدد الطلبات لكل عنوان IP').inputValue(), '3', 'Failed save preserves draft');
      await page.getByRole('combobox').selectOption('errors');
      assert.equal(await page.locator('tbody tr').count(), 1);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Admin API fits viewport');
        await page.screenshot({ path: path.join(output, 'admin-api-' + theme + '-' + width + '.png'), fullPage: true });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: developer examples, one-request preview, retry cooldown, admin real payloads, draft/error states, light/dark and 320/390/1440 layouts. Screenshots: ' + output);
  } finally { await browser?.close(); await vite.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
