const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { Server } = require('socket.io');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function main() {
  // Keep the intraday samples on two Tripoli dates, even when this test runs near midnight.
  const baseTime = new Date().setUTCHours(10, 0, 0, 0);
  const makeRates = (offset, usd, eur, official, checks) => ({
    parallel: { USD: usd, EUR: eur, USD_CHECKS: checks },
    official: { USD: official, EUR: 7.1 },
    previousParallel: { USD: 9.3, EUR: 10.1, USD_CHECKS: 9.5 },
    previousOfficial: { USD: Number((official - 0.0001).toFixed(4)), EUR: 7.0999 },
    lastUpdated: new Date(baseTime + offset).toISOString(),
    lastChanged: { parallel: {}, official: { USD: new Date(baseTime + offset - 5000).toISOString() } },
  });
  const initial = makeRates(0, 9.4, 10.2, 6.4003, 9.6);
  let snapshot = initial;
  let holdRates = true;
  let pendingResponse;
  const pendingResponses = [];
  let historyFailure = false;
  let rateRequests = 0;
  let connections = 0;
  const deviceReports = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/rates') {
      rateRequests++;
      const captured = JSON.stringify(snapshot);
      if (holdRates) {
        pendingResponses.push(() => res.end(captured));
        pendingResponse = () => { holdRates = false; pendingResponses.splice(0).forEach(send => send()); };
      } else {
        res.end(captured);
      }
    } else if (url.pathname === '/api/history') {
      if (historyFailure) {
        res.statusCode = 503;
        res.end('{}');
      } else {
        res.end(JSON.stringify([{
          time: new Date(baseTime - 25 * 3600000).toISOString(),
          usdParallel: 9.3, usdOfficial: 6.4003,
          ratesParallel: { USD: 9.3, EUR: 10.1 }, ratesOfficial: { USD: 6.4003 },
        }, {
          time: new Date(baseTime - 3600000).toISOString(),
          usdParallel: 9.3, usdOfficial: 6.4003,
          ratesParallel: { USD: 9.3, EUR: 10.1 }, ratesOfficial: { USD: 6.4003 },
        }]));
      }
    } else if (url.pathname === '/api/config') {
      res.end(JSON.stringify({ terms: [{ id: 'USD', name: 'دولار أمريكي', flag: 'us' }, { id: 'EUR', name: 'يورو', flag: 'eu' }] }));
    } else {
      res.end(JSON.stringify({ status: 'active', count: 1 }));
    }
  });
  const io = new Server(server);
  io.on('connection', socket => {
    connections++;
    socket.on('visitor_device', data => deviceReports.push(data));
    socket.emit('visitor_details_request');
  });
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
    const page = await context.newPage();
    const errors = [];
    let navigations = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'doNotTrack', { value: '0' });
      window.deviceHintReads = 0;
      Object.defineProperty(navigator, 'userAgentData', { value: { getHighEntropyValues: async keys => {
        if (JSON.stringify(keys) !== '["model"]') throw Error('Unexpected device data requested');
        window.deviceHintReads++; return { model: 'SM-S918B' };
      } } });
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
    await waitFor(() => deviceReports.length > 0);
    assert.equal(deviceReports[0].model, 'SM-S918B');
    const initialRequestCount = rateRequests;
    snapshot = makeRates(10000, 9.8, 10.5, 6.4004, 9.9);
    io.emit('rates_update', { rates: snapshot });
    const cash = page.getByRole('button', { name: 'عرض تفاصيل الدولار النقدي في السوق الموازي' });
    await cash.getByText('9.80', { exact: true }).waitFor();
    await page.locator('.eur-feature').getByText('10.50', { exact: true }).waitFor();
    const official = page.getByRole('button', { name: 'عرض تفاصيل الدولار الرسمي', exact: true });
    assert(await official.getByText('6.4004', { exact: true }).isVisible());
    assert(await official.getByText('6.4003', { exact: true }).isVisible());
    assert(await official.getByText('+0.0001', { exact: true }).isVisible());
    assert.equal(await official.getByText('مستقر', { exact: true }).count(), 0);
    assert(await page.locator('#official-rates-grid').getByText('6.4004', { exact: true }).isVisible());
    assert(await page.locator('#official-rates-grid').getByText('+0.0016%', { exact: true }).isVisible());
    assert(await page.locator('.primary-rates').getByText('9.90', { exact: true }).isVisible());
    pendingResponse();
    await page.waitForTimeout(500);
    assert(await cash.getByText('9.80', { exact: true }).isVisible(), 'Delayed HTTP must not overwrite Socket.IO');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_rates')).parallel.USD), 9.8);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).usdParallel), 9.8);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).length), 3, 'Delayed HTTP must still supply older chart history after a socket update');
    assert.equal(rateRequests, initialRequestCount, 'Socket event must not trigger a price query');

    const checkChart = async locator => {
      await locator.locator('.recharts-area-curve').waitFor({ state: 'attached' });
      assert(await locator.isVisible(), 'Chart container is visible');
      assert(await locator.locator('.recharts-area-curve').evaluate(path => path.getTotalLength() > 0), 'Horizontal and varying price lines both render');
      assert(!/NaN|Infinity/.test(await locator.locator('.recharts-area-curve').getAttribute('d')));
    };
    const saveChart = async (locator, name) => {
      if (!process.env.UI_ARTIFACT_DIR) return;
      await page.waitForTimeout(500);
      fs.mkdirSync(process.env.UI_ARTIFACT_DIR, { recursive: true });
      await locator.screenshot({ path: path.join(process.env.UI_ARTIFACT_DIR, name + '.png') });
    };
    await checkChart(page.locator('.usd-chart'));
    await saveChart(page.locator('.usd-chart'), 'chart-desktop');
    await page.getByRole('navigation', { name: 'أقسام لوحة الأسعار' }).getByRole('link', { name: 'التحليل', exact: true }).click();
    await checkChart(page.locator('.analysis-chart'));
    const checkOfficialDetail = async name => {
      await official.click();
      const dialog = page.getByRole('dialog');
      await checkChart(page.locator('.currency-detail-chart'));
      const yTicks = await dialog.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').allTextContents();
      assert.equal(new Set(yTicks).size, yTicks.length, 'Four-decimal official axis must not repeat rounded labels');
      assert(await dialog.locator('.currency-detail-price').getByText('6.4004', { exact: true }).isVisible());
      assert(await dialog.locator('.currency-detail-trend').getByText('+0.0001 د.ل', { exact: true }).isVisible());
      assert(await dialog.locator('.currency-detail-trend').getByText('+0.0016%', { exact: true }).isVisible());
      assert.equal(await dialog.getByText('التغير خلال 7 أيام', { exact: true }).count(), 0);
      const period = dialog.locator('.currency-detail-period time');
      assert.equal(await period.count(), 2);
      assert.equal(await period.first().getAttribute('datetime'), new Date(baseTime - 25 * 3600000).toISOString());
      assert.equal(await period.last().getAttribute('datetime'), snapshot.lastUpdated);
      const formatLibya = value => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli',
        day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
      assert.equal(await period.first().innerText(), formatLibya(baseTime - 25 * 3600000), 'Dates stay in Tripoli even on a foreign-timezone browser');
      const priceTime = dialog.locator('.currency-detail-price > div:first-child time');
      assert.equal(await priceTime.getAttribute('datetime'), snapshot.lastChanged.official.USD);
      assert.equal(await priceTime.innerText(), formatLibya(snapshot.lastChanged.official.USD));
      assert.equal(await dialog.getByRole('button', { name: '24 ساعة', exact: true }).count(), 0, 'Official views offer days, not intraday ranges');
      assert(await dialog.getByText('التغير بين الأيام المعروضة', { exact: true }).isVisible());
      const xTicks = await dialog.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents();
      assert(xTicks.every(tick => !tick.includes(':')), 'Official axis labels show dates only');
      await dialog.getByText('القراءات التاريخية', { exact: true }).click();
      const rows = dialog.locator('.currency-detail-records tbody tr');
      await rows.first().waitFor();
      assert.equal(await rows.count(), 2, 'Intraday official carries collapse to one row per day');
      const times = await rows.locator('time').allTextContents();
      assert(times.every(time => !time.includes(':')), 'Official historical rows show days, not hours');
      await dialog.getByText('القراءات التاريخية', { exact: true }).click();
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.__fixtureCopy = text; }
      } }));
      await dialog.getByRole('button', { name: 'نسخ السعر', exact: true }).click();
      assert((await page.evaluate(() => window.__fixtureCopy)).includes('6.4004'));
      await dialog.locator('.currency-detail-content').evaluate(element => { element.scrollTop = 0; });
      await saveChart(dialog, name);
      await dialog.locator('button[aria-label="إغلاق"]').click();
    };
    await checkOfficialDetail('official-details-desktop');
    await cash.click();
    await checkChart(page.locator('.currency-detail-chart'));
    await saveChart(page.locator('.currency-detail-dialog'), 'chart-details-desktop');
    await page.getByRole('dialog').locator('button[aria-label="إغلاق"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-bottom-nav').getByRole('button', { name: 'الرئيسية', exact: true }).click();
    await checkChart(page.locator('.usd-chart'));
    await saveChart(page.locator('.usd-chart'), 'chart-mobile');
    await page.locator('#mobile-bottom-nav').getByRole('button', { name: 'التحليل', exact: true }).click();
    await checkChart(page.locator('.analysis-chart'));
    await saveChart(page.locator('.analysis-section'), 'chart-analysis-mobile');
    await page.locator('#mobile-bottom-nav').getByRole('button', { name: 'الرئيسية', exact: true }).click();
    await checkOfficialDetail('official-details-mobile');
    for (const viewport of [{ width: 320, height: 568 }, { width: 639, height: 590 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      const priceFits = await official.evaluate(card => {
        const row = card.children[1].children[0], box = row.getBoundingClientRect();
        return [...row.children].every(el => { const rect = el.getBoundingClientRect(); return rect.left >= box.left - 1 && rect.right <= box.right + 1; });
      });
      assert(priceFits, 'Four-decimal primary quote and unit must fit at ' + viewport.width);
      await checkOfficialDetail('official-details-' + viewport.width + '-light');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await cash.click();
    await checkChart(page.locator('.currency-detail-chart'));
    await saveChart(page.locator('.currency-detail-dialog'), 'chart-details-mobile');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Charts must not overflow mobile');
    await page.getByRole('dialog').locator('button[aria-label="إغلاق"]').click();
    await page.setViewportSize({ width: 1440, height: 1000 });

    holdRates = true;
    pendingResponse = null;
    await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
    await waitFor(() => pendingResponse);
    snapshot = makeRates(20000, 9.9, 10.6, 6.4005, 10.0);
    io.emit('rates_update', { rates: JSON.stringify(snapshot) });
    await cash.getByText('9.90', { exact: true }).waitFor();
    snapshot = makeRates(20000, 9.95, 10.65, 6.4005, 10.0);
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
    await page.getByRole('button',{name:'إغلاق التنبيه',exact:true}).click();
    await page.evaluate(()=>localStorage.setItem('last_inapp_digest',String(Date.now()-31000)));
    snapshot=makeRates(25000,10.0,10.7,6.4005,10.1);
    io.emit('rates_update',{rates:snapshot});
    await cash.getByText('10.00',{exact:true}).waitFor();
    await page.waitForTimeout(11000);
    assert.equal(await page.locator('.app-toast').count(),0,'Price updates remain immediate without another notification after only 30 seconds');

    await context.setOffline(true);
    for (const socket of io.sockets.sockets.values()) socket.conn.close();
    await waitFor(() => io.sockets.sockets.size === 0);
    snapshot = makeRates(30000, 10.1, 10.8, 6.4006, 10.2);
    historyFailure = true;
    io.emit('rates_update', { rates: snapshot });
    await context.setOffline(false);
    await cash.getByText('10.10', { exact: true }).waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_rates')).parallel.USD), 10.1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).usdParallel), 10.1, 'Chart receives latest snapshot even if history endpoint fails');
    assert.equal(rateRequests, initialRequestCount + 2, 'Manual refresh and reconnect each perform one query, without rate polling');
    snapshot = makeRates(40000, 10.1, 10.8, 6.4005, 10.2);
    snapshot.previousOfficial.USD = 6.4006;
    io.emit('rates_update', { rates: snapshot });
    await official.getByText('-0.0001', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).observed.parallel), [],
      'An official-only socket update cannot add another cash-dollar sample to the monthly mean');
    snapshot = makeRates(50000, 10.1, 10.8, 6.4005, 10.2);
    snapshot.previousOfficial.USD = 6.4005;
    io.emit('rates_update', { rates: snapshot });
    await official.getByText('مستقر', { exact: true }).waitFor();
    assert.equal(await official.getByText('-0.0000', { exact: true }).count(), 0);
    assert.equal(rateRequests, initialRequestCount + 2, 'Tiny official changes remain socket-only updates');
    historyFailure = false;
    holdRates = true; pendingResponse = null;
    await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
    await waitFor(() => pendingResponse);
    const beforeCorrectionRequests = rateRequests;
    const correctedHistory = await page.evaluate(() => {
      const points = JSON.parse(localStorage.getItem('lyd_history'));
      return points.slice(1).map(point => ({ ...point, usdParallel: 9.77, ratesParallel: { ...point.ratesParallel, USD: 9.77 } }));
    });
    io.emit('history_update', { history: correctedHistory, readStartedAt: new Date().toISOString() });
    await page.waitForFunction(length => {
      const points = JSON.parse(localStorage.getItem('lyd_history'));
      return points.length === length && points.every(point => point.usdParallel === 9.77);
    }, correctedHistory.length);
    pendingResponse(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).every(point => point.usdParallel === 9.77)), true, 'Delayed HTTP cannot undo a historical correction');
    assert.equal(rateRequests, beforeCorrectionRequests, 'History correction is pushed without a visitor request burst');
    await checkChart(page.locator('.usd-chart'));
    io.emit('history_update', { history: [], readStartedAt: new Date().toISOString() });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lyd_history')).length === 0);
    const started = new Date().toISOString();
    snapshot = makeRates(Date.now() - baseTime + 1000, 10.2, 10.9, 6.4005, 10.2);
    io.emit('rates_update', { rates: snapshot });
    await cash.getByText('10.20', { exact: true }).waitFor();
    io.emit('history_update', { history: correctedHistory, readStartedAt: started });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lyd_history')).at(-1).usdParallel === 10.2);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lyd_history')).length), correctedHistory.length + 1, 'Live prices arriving after correction read began are retained');
    await page.waitForTimeout(1200);
    const month = Array.from({ length: 300 }, (_, i) => {
      const usd = i === 104 ? 12 : 10 + (i % 10) / 100;
      return { time: new Date(baseTime - 30 * 86400000 + Math.floor(i / 10) * 86400000 + (i % 10) * 1800000).toISOString(),
        usdParallel: usd, usdOfficial: 6.4005, ratesParallel: { USD: usd, EUR: 11 },
        ratesOfficial: { USD: 6.4005 }, observed: { parallel: ['USD', 'EUR'], official: [] } };
    });
    io.emit('history_update', { history: month, readStartedAt: new Date().toISOString() });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lyd_history')).length === 300);
    await page.getByRole('navigation', { name: 'أقسام لوحة الأسعار' }).getByRole('link', { name: 'التحليل', exact: true }).click();
    const analysis = page.locator('.analysis-section');
    await analysis.getByRole('button', { name: 'شهر', exact: true }).click();
    await analysis.getByText('متوسطات القراءات اليومية · 30 يوم رصد بتوقيت ليبيا', { exact: true }).waitFor();
    assert.equal(await analysis.locator('.analysis-latest strong').innerText(), '10.09', 'Latest remains the real closing observation, not its daily mean');
    assert.equal(await analysis.locator('.analysis-statistics > div').filter({ hasText: 'أعلى سعر' }).locator('strong').innerText(), '12.00', 'Monthly high survives daily chart grouping');
    await page.waitForTimeout(500);
    const desktopMonthlyCurve = await analysis.locator('.recharts-area-curve').getAttribute('d');
    assert.equal((desktopMonthlyCurve.match(/L/g) || []).length, 29, 'Ten readings per day become 30 plotted averages, not 300 markers');
    await checkChart(page.locator('.analysis-chart'));
    await saveChart(analysis, 'monthly-analysis-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-bottom-nav').getByRole('button', { name: 'التحليل', exact: true }).click();
    await checkChart(page.locator('.analysis-chart'));
    await saveChart(analysis, 'monthly-analysis-mobile');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobileMonthlyCurve = await analysis.locator('.recharts-area-curve').getAttribute('d');
    const revisedMonth = month.map((point, i) => i === 104 ? { ...point, usdParallel: 10.04, ratesParallel: { ...point.ratesParallel, USD: 10.04 } } : point);
    io.emit('history_update', { history: revisedMonth, readStartedAt: new Date().toISOString() });
    await analysis.locator('.analysis-statistics > div').filter({ hasText: 'أعلى سعر' }).getByText('10.09', { exact: true }).waitFor();
    await page.waitForTimeout(500);
    assert.notEqual(await analysis.locator('.recharts-area-curve').getAttribute('d'), mobileMonthlyCurve, 'Correction updates the aggregated monthly curve without a reload');
    assert.equal(rateRequests, beforeCorrectionRequests, 'Monthly grouping/corrections add no price polling');
    assert.equal(navigations, 1, 'Live updates must not reload the document');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(await page.evaluate(() => window.deviceHintReads), 1, 'Device hints are read once, including reconnects');
    await page.close();
    await waitFor(() => io.sockets.sockets.size === 0);
    const privateContext = await browser.newContext({ serviceWorkers: 'block' });
    await privateContext.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
      Object.defineProperty(navigator, 'userAgentData', { value: { getHighEntropyValues: () => { throw Error('Privacy opt-out must not request a model'); } } });
      localStorage.setItem('hasSeenTour', 'true');
    });
    const beforePrivate = deviceReports.length;
    const privatePage = await privateContext.newPage();
    await privatePage.goto(baseURL);
    await waitFor(() => io.sockets.sockets.size === 1);
    assert.equal([...io.sockets.sockets.values()][0].handshake.auth.tracking, false);
    assert.equal([...io.sockets.sockets.values()][0].handshake.query.deviceId, undefined);
    await privatePage.waitForTimeout(300);
    assert.equal(deviceReports.length, beforePrivate);
    assert.equal(await privatePage.evaluate(() => localStorage.getItem('__deviceId')), null);
    await privateContext.close();
    console.log('PASS: on-demand browser model, one read across reconnects, GPC suppresses model and tracking identifier');
    console.log('PASS: real Socket.IO updates USD/EUR/official/checks, cache and history');
    console.log('PASS: official 0.0001 changes, previous price, nonzero percent, copy and one daily official reading/Tripoli date on desktop/mobile');
    console.log('PASS: delayed HTTP preserves older chart history, desktop/mobile main/analysis/detail charts render real data');
    console.log('PASS: delayed HTTP, stale/malformed events, reconnect with failed history, no reload or rate polling, cleanup');
    console.log('PASS: pushed historical corrections/deletions, empty authoritative history, stale HTTP rejection and concurrent live price preservation');
    console.log('PASS: full 300-observation month becomes 30 Tripoli daily averages on desktop/mobile, preserving raw high/close and live corrections');
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
