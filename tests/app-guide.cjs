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
  const rates = { parallel: { USD: 9.4, EUR: 10.2 }, official: { USD: 6.3, EUR: 7.1 }, lastUpdated: new Date().toISOString() };
  let priceRequests = 0;
  const fixture = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/rates') { priceRequests++; res.end(JSON.stringify(rates)); }
    else if (url.pathname === '/api/history') res.end('[]');
    else if (url.pathname === '/api/config') res.end(JSON.stringify({ terms: [{ id: 'USD', name: 'دولار أمريكي', flag: 'us' }, { id: 'EUR', name: 'يورو', flag: 'eu' }] }));
    else res.end(JSON.stringify({ status: 'active', count: 1 }));
  });
  const io = new Server(fixture);
  const fixturePort = await listen(fixture);
  const reservation = http.createServer();
  const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const vite = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(), env: { ...process.env, APP_URL: `http://127.0.0.1:${fixturePort}` }, stdio: 'ignore', windowsHide: true,
  });
  let browser, page;
  const errors = [];
  try {
    const baseURL = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 30000;
    while (true) {
      try { if ((await fetch(baseURL)).ok) break; } catch {}
      if (Date.now() > deadline || vite.exitCode !== null) throw new Error('Isolated Vite startup failed');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('hasSeenTour', 'true');
      localStorage.setItem('installPromptDismissed', 'true');
      localStorage.setItem('pushPromptDismissed_v4', Date.now().toString());
      localStorage.setItem('soundEnabled', 'false');
    });
    page = await context.newPage();
    const videoRequests = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('request', request => { if (request.url().endsWith('.mp4')) videoRequests.push(request.url()); });
    await page.goto(baseURL);
    await Promise.race([
      page.waitForFunction(() => JSON.parse(localStorage.getItem('lyd_rates') || '{}').parallel?.USD === 9.4),
      new Promise((_, reject) => page.once('pageerror', reject)),
    ]);
    await page.waitForTimeout(200);
    assert.equal(videoRequests.length, 0, 'Home must not download guide video');
    const open = async () => {
      await page.locator('#more-menu-btn').click();
      await page.getByRole('button', { name: 'الدليل الشامل للتطبيق', exact: true }).click();
      await page.getByRole('dialog', { name: 'الدليل الشامل للتطبيق' }).waitFor();
      await page.waitForTimeout(200);
    };
    const dialog = page.getByRole('dialog', { name: 'الدليل الشامل للتطبيق' });
    await open();
    assert.equal(videoRequests.length, 0, 'Opening guide must not preload MP4');
    assert.equal(await page.locator('video').getAttribute('preload'), 'none');
    assert(await page.locator('video').evaluate(video => video.paused));
    assert.equal(await dialog.locator('ol li').count(), 4);
    await page.getByRole('button', { name: 'تشغيل درس المحوّل' }).click();
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.25);
    assert(videoRequests.every(url => url.includes('converter-desktop.mp4')));
    assert.equal(await page.locator('video').evaluate(video => video.duration), 20);
    assert(await page.locator('video').evaluate(video => video.controls), 'Native controls must be available during playback');
    await page.locator('video').evaluate(video => { video.textTracks[0].mode = 'hidden'; });
    await page.waitForFunction(() => document.querySelector('video').textTracks[0].cues?.length === 4);
    const framePixels = async seconds => {
      await page.locator('video').evaluate((video, seconds) => { video.pause(); video.currentTime = seconds; }, seconds);
      await page.waitForFunction(seconds => { const video = document.querySelector('video'); return !video.seeking && Math.abs(video.currentTime - seconds) < 0.1; }, seconds);
      return page.locator('video').evaluate(video => {
        const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
        const context = canvas.getContext('2d'); context.drawImage(video, 0, 0, 80, 60);
        return [...context.getImageData(0, 0, 80, 60).data];
      });
    };
    const firstFrame = await framePixels(2);
    const comparisonFrame = await framePixels(12);
    assert(new Set(firstFrame).size > 30, 'Video frame must not be blank');
    assert.notDeepEqual(firstFrame, comparisonFrame, 'Lesson must visibly change between steps');
    const originalPrices = await page.evaluate(() => localStorage.getItem('lyd_rates'));
    const requestsBeforeGuideActions = priceRequests;
    await page.evaluate(() => { window.guideTestVideo = document.querySelector('video'); Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert(await page.locator('video').evaluate(video => video.paused), 'Hidden document must pause playback');
    await page.evaluate(() => { delete document.hidden; });
    await page.locator('video').evaluate(video => { video.currentTime = 17; return video.play(); });
    await page.waitForFunction(() => document.querySelector('video').currentTime >= 17);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert(await page.evaluate(() => window.guideTestVideo.paused), 'Closing guide must pause detached video');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await page.evaluate(() => localStorage.getItem('lyd_rates')), originalPrices, 'Training values must not alter real prices');
    assert.equal(priceRequests, requestsBeforeGuideActions, 'Guide actions must not refetch prices');

    const artifactDir = process.env.UI_ARTIFACT_DIR;
    if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });
    for (const [width, height] of [[1440, 1000], [768, 1024], [844, 390], [390, 844], [360, 640], [320, 568]]) {
      await page.setViewportSize({ width, height });
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await open();
        const video = page.locator('video');
        assert((await video.locator('source').getAttribute('src')).includes(width < 768 ? 'mobile' : 'desktop'));
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), `No horizontal dialog overflow at ${width}`);
        assert(await dialog.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth && rect.left >= 0; }), `Dialog fits ${width}x${height}`);
        for (const button of await dialog.locator('button').all()) {
          const box = await button.boundingBox();
          assert(box.height >= 44, 'Touch controls must be at least 44px');
        }
        if (width < 768 || height < 640) {
          const mediaBox = await video.boundingBox();
          const footerBox = await dialog.locator('footer').boundingBox();
          assert(mediaBox.y + mediaBox.height <= footerBox.y, 'Video controls must not be hidden behind footer');
        }
        await page.getByRole('button', { name: 'إغلاق الدليل' }).focus();
        await page.keyboard.press('Shift+Tab');
        assert(await page.getByRole('button', { name: 'الجولة التفاعلية', exact: true }).evaluate(button => button === document.activeElement), 'Focus must wrap within dialog');
        await page.keyboard.press('Tab');
        assert(await page.getByRole('button', { name: 'إغلاق الدليل' }).evaluate(button => button === document.activeElement));
        if (artifactDir) await dialog.screenshot({ path: path.join(artifactDir, `guide-${width}-${theme}.png`) });
        await page.getByRole('button', { name: 'جرّب المحوّل', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        await page.waitForFunction(() => document.activeElement?.id === 'converter-foreign');
        assert.equal(await page.locator('#converter-foreign').inputValue(), '100');
        assert.equal(await page.locator('#converter-parallel').inputValue(), '940');
      }
    }
    await open();
    await page.getByRole('button', { name: 'تشغيل درس المحوّل' }).click();
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1);
    assert((await page.locator('video source').getAttribute('src')).includes('mobile'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(() => document.querySelector('video source')?.getAttribute('src').includes('desktop'));
    assert(await page.locator('video').evaluate(video => video.paused), 'Resizing must not autoplay replacement video');
    await page.getByRole('button', { name: 'إغلاق الدليل' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-bottom-nav').getByRole('button', { name: 'المزيد', exact: true }).click();
    await page.locator('#more-section').getByRole('button', { name: /الدليل الشامل للتطبيق/ }).click();
    await dialog.waitFor();
    await page.getByRole('button', { name: 'إغلاق الدليل' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/guide/*.mp4', route => route.abort());
    await open();
    await page.getByRole('button', { name: 'تشغيل درس المحوّل' }).click();
    await dialog.getByRole('status').waitFor();
    assert(await page.getByRole('button', { name: 'إعادة محاولة تشغيل الدرس' }).isVisible());
    assert.equal(await dialog.locator('ol li').count(), 4, 'Transcript survives video failure');
    await page.unroute('**/guide/*.mp4');
    await page.getByRole('button', { name: 'إعادة محاولة تشغيل الدرس' }).click();
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1);
    await page.getByRole('button', { name: 'الجولة التفاعلية', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    assert.equal(await dialog.count(), 0, 'Existing tour must replace guide');
    assert.deepEqual(errors, []);
    console.log('App guide: playback, captions, responsive themes, focus, retry, converter handoff, existing tour and price isolation passed.');
  } catch (error) {
    console.error('Browser errors:', errors);
    if (page) {
      console.error('Visible page:', (await page.locator('body').innerText()).slice(0, 1200));
      if (process.env.UI_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.UI_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.UI_ARTIFACT_DIR, 'guide-failure.png') });
      }
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    vite.kill();
    io.close();
    await new Promise(resolve => fixture.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
