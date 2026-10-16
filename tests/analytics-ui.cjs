const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sampleLogs = [
  { id: 'one', ip: '2001:db8:1234:5678:1234:5678:1234:5678', visits: 2, browser: 'Edge', os: 'Windows 10 / 11', deviceType: 'Desktop', deviceName: 'كمبيوتر', location: 'Libya، Tripoli', locationStatus: 'approximate', isOnline: true, timestamp: 'invalid' },
  { id: 'two', ip: '8.8.8.8', visits: 3, browser: 'Chrome 130', os: 'Android (الإصدار غير متاح)', deviceType: 'Mobile', deviceName: 'SM-S918B', deviceModel: 'SM-S918B', modelSource: 'browser', location: 'غير متاح', locationStatus: 'unavailable', isOnline: false, timestamp: '2026-10-16T09:00:00Z' },
  { id: 'three', ip: '1.1.1.1', visits: 1, browser: 'Safari 18', os: 'iOS 18', deviceType: 'Mobile', deviceName: 'Apple iPhone', location: 'Libya، Benghazi', locationStatus: 'approximate', isOnline: true, timestamp: '2026-10-16T08:00:00Z' }
];
const sampleReport = (days, partial = false) => ({ success: true, source: partial ? 'local' : 'supabase', truncated: partial, generatedAt: new Date().toISOString(), trackingEnabled: true,
  summary: { totalPageviews: 1200, totalVisitors: 600, sessions: 800, returningVisitors: 100, pageviewGrowth: 25, visitorGrowth: null },
  trend: Array.from({ length: days }, (_, i) => ({ date: '2026-10-' + String(i+1).padStart(2, '0'), pageviews: 100+i, visitors: 60+i })),
  deviceTypes: { Mobile: 1000, Desktop: 200 }, browsers: { Chrome: 1200 }, os: { Android: 1200 }, pages: { '/': 1100, '/api': 100 }, sources: { 'example.com': 500, 'مباشر / غير معروف': 700 }
});

async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const vite = await createServer({ configFile: false, plugins: [react(), tailwind()],
    cacheDir: path.join(require('node:os').tmpdir(), 'dollar-analytics-vite-cache'),
    resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
    server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  const preview = process.argv.includes('--preview');
  if (preview) vite.middlewares.use('/api/admin', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const url = new URL(req.url, 'http://localhost');
    res.end(JSON.stringify(url.pathname.endsWith('/logs')
      ? { success: true, capturedAt: new Date().toISOString(), trackingEnabled: true, logs: sampleLogs }
      : sampleReport([1, 7, 30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7)));
  });
  vite.middlewares.use('/__analytics-test', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__analytics-test', `<!doctype html><html dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${preview ? '<p style="padding:12px;text-align:center">معاينة محلية ببيانات تجريبية، وليست زيارات فعلية</p>' : ''}<div id="root" class="app-shell" style="padding:16px"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {AdminTracking} from '/src/components/AdminTracking.tsx';
      import {useVisitorAnalytics} from '/src/hooks/useVisitorAnalytics.ts';
      import '/src/index.css';
      function Visitor(){const [page,setPage]=React.useState('dashboard'); const [tick,setTick]=React.useState(0); useVisitorAnalytics(page); return React.createElement('div',null,React.createElement('button',{onClick:()=>setPage('about')},'navigate'),React.createElement('button',{onClick:()=>setTick(tick+1)},'rerender'));}
      const visitor = new URLSearchParams(location.search).has('visitor');
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(visitor ? Visitor : AdminTracking,{token:'fixture'})));
    </script></body></html>`);
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await vite.listen();
  const base = 'http://127.0.0.1:' + vite.httpServer.address().port;
  if (preview) { console.log('Analytics fixture preview: ' + base + '/__analytics-test'); return; }
  const output = path.join(require('node:os').tmpdir(), 'Dollar-analytics-proof');
  await fs.mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let requests = 0, fail = false, partial = false;
      await page.route('**/api/**', route => {
        assert.equal(route.request().headers().authorization, 'Bearer fixture');
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/logs')) return route.fulfill({ json: { success: true, capturedAt: '2026-10-16T10:00:00Z', trackingEnabled: true, logs: sampleLogs } });
        requests++;
        if (fail) return route.fulfill({ status: 503, json: { success: false } });
        return route.fulfill({ json: sampleReport(Number(url.searchParams.get('days')), partial) });
      });
      await page.goto(base + '/__analytics-test');
      await page.getByText('آخر احتساب:', { exact: false }).waitFor();
      const initial = requests;
      await page.locator('.visitor-table tbody tr').first().waitFor();
      assert.equal(await page.locator('.visitor-table tbody tr').count(), 3);
      await page.getByLabel('بحث في الاتصالات').fill('Tripoli');
      assert.equal(await page.locator('.visitor-table tbody tr').count(), 1);
      await page.getByLabel('بحث في الاتصالات').fill('');
      await page.getByLabel('نوع الجهاز', { exact: true }).selectOption('Mobile');
      assert.equal(await page.locator('.visitor-table tbody tr').count(), 2);
      await page.getByLabel('حالة الاتصال').selectOption('offline');
      assert.equal(await page.locator('.visitor-table tbody tr').count(), 1);
      assert((await page.locator('.visitor-table').innerText()).includes('SM-S918B'));
      await page.getByLabel('نوع الجهاز', { exact: true }).selectOption('all');
      await page.getByLabel('حالة الاتصال').selectOption('all');
      assert.equal(await page.locator('.visitor-details').count(), 0, 'Secondary data stays collapsed');
      const beforeExpand = requests;
      await page.getByRole('button', { name: 'عرض تفاصيل الاتصال one', exact: true }).click();
      await page.locator('.visitor-details').waitFor();
      assert((await page.locator('.visitor-details').innerText()).includes(sampleLogs[0].ip));
      assert.equal(requests, beforeExpand, 'Opening details adds no API requests');
      await page.getByRole('button', { name: 'إخفاء تفاصيل الاتصال one', exact: true }).press('Enter');
      assert.equal(await page.locator('.visitor-details').count(), 0);
      await page.getByLabel('الفترة', { exact: true }).selectOption('30');
      await page.getByRole('button', { name: 'تحديث التقرير والاتصالات' }).waitFor();
      await page.waitForFunction(() => !document.querySelector('button').disabled);
      assert.equal(requests, initial + 1, 'One request per period change');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Analytics fits viewport');
        assert(await page.locator('.recharts-surface').count() > 0);
        await page.screenshot({ path: path.join(output, theme + '-' + width + '.png'), fullPage: true });
        await page.locator('.visitor-connections').screenshot({ path: path.join(output, 'visitors-' + theme + '-' + width + '.png') });
        await page.getByRole('button', { name: 'عرض تفاصيل الاتصال one', exact: true }).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Expanded details fit viewport');
        await page.locator('.visitor-connections').screenshot({ path: path.join(output, 'visitor-details-' + theme + '-' + width + '.png') });
        await page.getByRole('button', { name: 'إخفاء تفاصيل الاتصال one', exact: true }).click();
      }
      await page.getByLabel('بحث في الاتصالات').fill('unknown');
      await page.getByText('لا توجد اتصالات مطابقة.').waitFor();
      partial = true;
      await page.getByRole('button', { name: 'تحديث التقرير والاتصالات' }).click();
      await page.locator('.analytics-warning').waitFor();
      fail = true;
      await page.getByRole('button', { name: 'تحديث التقرير والاتصالات' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('.analytics-metrics').count(), 0, 'Old period never presented as fresh data on failure');
      assert.deepEqual(errors, []); await context.close();
    }
    const context = await browser.newContext();
    await context.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '0' }));
    const page = await context.newPage(); let events = [];
    await page.route('**/api/**', route => { events.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); });
    await page.goto(base + '/__analytics-test?visitor'); await page.getByText('rerender', { exact: true }).waitFor(); await page.waitForTimeout(900);
    assert.equal(events.length, 1, 'StrictMode does not duplicate pageview');
    await page.getByText('rerender', { exact: true }).click(); await page.waitForTimeout(700); assert.equal(events.length, 1);
    await page.getByText('navigate', { exact: true }).click(); await page.waitForTimeout(700);
    assert.equal(events.length, 2); assert.equal(events[1].pagePath, '/about'); assert.equal(events[0].visitorId, events[1].visitorId);
    await page.reload(); await page.waitForTimeout(700); assert.equal(events.length, 2, 'Quick reload deduplicated');
    await context.close();
    const privateContext = await browser.newContext();
    await privateContext.addInitScript(() => { Object.defineProperty(navigator, 'doNotTrack', { value: '0' }); Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }); });
    const privatePage = await privateContext.newPage();
    await privatePage.route('**/api/**', route => { throw new Error('Privacy opt-out made request: ' + route.request().url()); });
    await privatePage.goto(base + '/__analytics-test?visitor'); await privatePage.waitForTimeout(800);
    await privateContext.close();
    console.log('PASS: responsive light/dark analytics, period requests, failure/partial states, connection search, StrictMode/navigation/reload dedupe and GPC. Screenshots: ' + output);
  } finally { await browser?.close(); await vite.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
