const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Server } = require('socket.io');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function main() {
  const baseTime = Date.now() - 60000;
  const makeRates = (offset, usd, eur, official, checks) => ({
    parallel: { USD: usd, EUR: eur, USD_CHECKS: checks },
    official: { USD: official, EUR: 7.1 },
    previousParallel: { USD: 9.3, EUR: 10.1, USD_CHECKS: 9.5 },
    previousOfficial: { USD: 6.2 },
    lastUpdated: new Date(baseTime + offset).toISOString(),
  });
  const initial = makeRates(0, 9.4, 10.2, 6.3, 9.6);
  let snapshot = initial;
  let holdRates = true;
  let pendingResponse;
  let historyFailure = false;
  let rateRequests = 0;
  let connections = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/rates') {
      rateRequests++;
      const captured = JSON.stringify(snapshot);
      if (holdRates) {
        holdRates = false;
        pendingResponse = () => res.end(captured);
      } else {
        res.end(captured);
      }
    } else if (url.pathname === '/api/history') {
      if (historyFailure) {
        res.statusCode = 503;
        res.end('{}');
      } else {
        res.end(JSON.stringify([{
          time: new Date(baseTime - 3600000).toISOString(),
          usdParallel: 9.3, usdOfficial: 6.2,
          ratesParallel: { USD: 9.3, EUR: 10.1 }, ratesOfficial: { USD: 6.2 },
        }]));
      }
    } else if (url.pathname === '/api/config') {
      res.end(JSON.stringify({ terms: [{ id: 'EUR', name: 'يورو', flag: 'eu' }] }));
    } else {
      res.end(JSON.stringify({ status: 'active', count: 1 }));
    }
  });
  const io = new Server(server);
  io.on('connection', () => { connections++; });
  const fixturePort = await listen(server);
  const reservation = http.createServer();
  const vitePort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const vite = spawn(process.execPath, [
    path.join(process.cwd(), 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, APP_URL: `http://127.0.0.1:${fixturePort}` },
    stdio: 'ignore', windowsHide: true,
  });
  let browser;
  try {
    const baseURL = `http://127.0.0.1:${vitePort}`;
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      const probe = async () => {
        if (vite.exitCode !== null) return reject(new Error('Isolated Vite exited'));
        try {
          if ((await fetch(baseURL)).ok) return resolve();
        } catch {}
        if (Date.now() >= deadline) return reject(new Error('Isolated Vite startup timeout'));
        setTimeout(probe, 100);
      };
      probe();
    });
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    let navigations = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenTour', 'true');
      localStorage.setItem('installPromptDismissed', 'true');
      localStorage.setItem('pushPromptDismissed_v4', Date.now().toString());
      localStorage.setItem('soundEnabled', 'false');
    });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => e.name.includes('socket.io')));
    const waitFor = async condition => {
      for (let attempt = 0; attempt < 200; attempt++) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Fixture condition timeout');
    };
    await waitFor(() => connections > 0 && pendingResponse);
    const initialRequestCount = rateRequests;
    snapshot = makeRates(10000, 9.8, 10.5, 6.4, 9.9);
    io.emit('rates_update', { rates: snapshot });
    const cash = page.getByRole('button', { name: 'عرض تفاصيل الدولار النقدي في السوق الموازي' });
    await cash.getByText('9.80', { exact: true }).waitFor();
    await page.locator('.eur-feature').getByText('10.50', { exact: true }).waitFor();
    assert(await page.locator('.primary-rates').getByText('6.40', { exact: true }).isVisible());
    assert(await page.locator('.primary-rates').getByText('9.90', { exact: true }).isVisible());
    pendingResponse();
    await page.waitForTimeout(500);
    assert(await cash.getByText('9.80', { exact: true }).isVisible(), 'Delayed HTTP must not overwrite Socket.IO');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_rates')).parallel.USD), 9.8);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).usdParallel), 9.8);
    assert.equal(rateRequests, initialRequestCount, 'Socket event must not trigger a price query');

    holdRates = true;
    pendingResponse = null;
    await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
    await waitFor(() => pendingResponse);
    snapshot = makeRates(20000, 9.9, 10.6, 6.5, 10.0);
    io.emit('rates_update', { rates: JSON.stringify(snapshot) });
    await cash.getByText('9.90', { exact: true }).waitFor();
    snapshot = makeRates(20000, 9.95, 10.65, 6.5, 10.0);
    io.emit('rates_update', { rates: snapshot });
    await cash.getByText('9.95', { exact: true }).waitFor();
    pendingResponse();
    io.emit('rates_update', { rates: initial });
    io.emit('rates_update', { rates: { parallel: 'invalid', lastUpdated: 'invalid' } });
    await page.waitForTimeout(500);
    assert(await cash.getByText('9.95', { exact: true }).isVisible(), 'Old or malformed events must be ignored');
    assert.equal(io.sockets.sockets.size, 1, 'React rerenders must not create extra subscriptions');
    await page.getByRole('heading',{name:'ملخص تغيّرات الأسعار المهمة',exact:true}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('heading',{name:'ملخص تغيّرات الأسعار المهمة',exact:true}).count(),1,'One summary, not a toast per currency');
    assert((await page.locator('.app-toast').innerText()).includes('9.95'),'Same-timestamp accepted changes must appear in the latest digest');

    await context.setOffline(true);
    for (const socket of io.sockets.sockets.values()) socket.conn.close();
    await waitFor(() => io.sockets.sockets.size === 0);
    snapshot = makeRates(30000, 10.1, 10.8, 6.6, 10.2);
    historyFailure = true;
    io.emit('rates_update', { rates: snapshot });
    await context.setOffline(false);
    await cash.getByText('10.10', { exact: true }).waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_rates')).parallel.USD), 10.1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).usdParallel), 10.1, 'Chart receives latest snapshot even if history endpoint fails');
    assert.equal(rateRequests, initialRequestCount + 2, 'Manual refresh and reconnect each perform one query, without rate polling');
    assert.equal(navigations, 1, 'Live updates must not reload the document');
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.close();
    await waitFor(() => io.sockets.sockets.size === 0);
    console.log('PASS: real Socket.IO updates USD/EUR/official/checks, cache and history');
    console.log('PASS: delayed HTTP, stale/malformed events, reconnect with failed history, no reload or rate polling, cleanup');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => io.close(resolve));
    if (vite.exitCode === null) {
      const stopped = new Promise(resolve => vite.once('exit', resolve));
      vite.kill();
      await stopped;
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
