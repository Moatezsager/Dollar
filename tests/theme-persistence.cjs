const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const dist = path.resolve(__dirname, '../dist');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dollar-theme-'));
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(dist, '.' + (pathname === '/' || pathname === '/admin-panel-secure' ? '/index.html' : pathname));
      if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
      const body = await fs.readFile(file);
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      // Production forbids inline scripts. Never start the real server or its schedulers here.
      response.setHeader('Content-Security-Policy', "script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https://flagcdn.com data:");
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  let context;
  async function openBrowser() {
    context = await chromium.launchPersistentContext(profile, { headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      return route.fulfill({ json: pathname === '/api/history' ? [] : pathname === '/api/rates' ?
        { parallel: { USD: 9.4 }, official: { USD: 6.3 }, lastUpdated: new Date().toISOString() } : {} });
    });
    await context.route('**/socket.io/**', route => route.fulfill({ status: 503, body: '' }));
    return context.newPage();
  }
  try {
    let page = await openBrowser();
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.setItem('colorTheme', 'light');
      localStorage.setItem('hasSeenTour', 'true');
      localStorage.setItem('installPromptDismissed', 'true');
      localStorage.setItem('pushPromptDismissed_v4', String(Date.now()));
    });
    await page.reload();
    await page.locator('.theme-toggle:visible').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Saved light appearance survives reload under production CSP');
    for (const theme of ['dark', 'light']) {
      await page.locator('.theme-toggle:visible').first().click();
      assert.equal(await page.evaluate(() => localStorage.getItem('colorTheme')), theme, 'Toggle persists the selected appearance');
      await page.reload();
      await page.locator('.theme-toggle:visible').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      await page.close();
      page = await context.newPage();
      await page.goto(url);
      await page.locator('.theme-toggle:visible').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme, 'Closing a tab preserves the choice');
    }
    await context.close();
    context = null;
    page = await openBrowser();
    await page.goto(url);
    await page.locator('.theme-toggle:visible').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Closing the entire browser preserves the choice');
    await page.setViewportSize({ width: 375, height: 820 });
    await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
    await page.locator('.theme-toggle:visible').click();
    await page.reload();
    await page.locator('.dollar-cards').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'Mobile menu uses the same persistent choice');
    await context.route('**/theme.js', route => route.abort());
    await page.evaluate(() => localStorage.setItem('colorTheme', 'light'));
    await page.reload();
    await page.locator('.dollar-cards').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Application startup restores the preference even without the bootstrap');
    await page.goto(url + '/admin-panel-secure');
    await page.locator('.theme-toggle:visible').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Admin entry uses the same saved appearance');
    console.log('PASS production CSP: light/dark reload, tab close, full browser restart, mobile toggle, missing bootstrap, admin entry');
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()));
    assert(path.basename(profile).startsWith('dollar-theme-'));
    await fs.rm(profile, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
