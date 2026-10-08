const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// All requests are fixtures: this test cannot send visitor messages or change live prices.
async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
  const output = process.env.UI_SCREENSHOT_DIR || path.join(require('node:os').tmpdir(), 'dollar-contact-pdf');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, height] of [[320, 740], [375, 820], [579, 590], [1440, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('hasSeenTour', 'true');
        localStorage.setItem('installPromptDismissed', 'true');
        localStorage.setItem('pushPromptDismissed_v4', String(Date.now()));
        localStorage.setItem('soundEnabled', 'false');
        window.print = () => { window.printCalls = (window.printCalls || 0) + 1; };
      });
      const terms = [
        { id: 'USD', name: 'دولار أمريكي (كاش موازي)', flag: 'us' },
        { id: 'USD_CHECKS', name: 'دولار أمريكي (صكوك)', flag: 'us' },
        { id: 'EUR', name: 'يورو', flag: 'eu' },
        { id: 'GOLD_SCRAP_18', name: 'ذهب كسر 18', flag: 'gold' },
        { id: 'GOLD_LIRA_8G', name: 'ليرة ذهب 8 جرام', flag: 'gold' },
        { id: 'MISSING', name: 'صنف بلا سعر', flag: 'xx' },
        ...Array.from({ length: 36 }, (_, i) => ({ id: 'FX_' + i, name: 'عملة اختبار ذات اسم طويل ' + (i + 1), flag: '' })),
      ];
      const parallel = Object.fromEntries(terms.filter(item => item.id !== 'MISSING').map((item, i) => [item.id, 9.76 + i]));
      let messageMode = 'html-error';
      let requests = [];
      let releaseMessage;
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/messages') {
          requests.push(route.request().postDataJSON());
          if (messageMode === 'html-error') return route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad gateway</h1>' });
          if (messageMode === 'limit') return route.fulfill({ status: 429, json: {} });
          if (messageMode === 'delayed-success') await new Promise(resolve => { releaseMessage = resolve; });
          return route.fulfill({ json: { success: true } });
        }
        let body = {};
        if (url.pathname === '/api/config') body = { terms };
        if (url.pathname === '/api/rates') body = { parallel, official: { USD: 6.3, EUR: 7.1 }, previousParallel: { EUR: 10.1 }, previousOfficial: { EUR: 7 }, lastUpdated: '2026-10-08T08:30:00Z' };
        if (url.pathname === '/api/history') body = [{ time: new Date().toISOString(), usdParallel: parallel.USD, usdOfficial: 6.3, ratesParallel: parallel }];
        if (url.pathname === '/api/status') body = { status: 'active' };
        return route.fulfill({ json: body });
      });
      await page.route('**/socket.io/**', route => route.fulfill({ status: 503, body: '' }));
      await page.route('https://flagcdn.com/**', route => route.abort());
      await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded' });
      await page.locator('.dollar-cards').waitFor();
      await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
      await page.locator('#header-more-panel').getByRole('button', { name: 'اتصل بنا وملاحظاتك', exact: true }).click();
      await page.getByRole('heading', { name: 'اتصل بنا', exact: true }).waitFor();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
        await page.waitForTimeout(400);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Contact has no horizontal overflow');
        await page.screenshot({ path: path.join(output, 'contact-' + theme + '-' + width + '.png'), fullPage: true });
      }
      const email = page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true });
      const phone = page.getByRole('textbox', { name: 'رقم الهاتف (واتساب)', exact: true });
      const message = page.getByRole('textbox', { name: 'الرسالة', exact: true });
      await email.fill('test@example.com');
      await phone.fill('+218910000000');
      await message.fill('   ');
      await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(requests.length, 0, 'Whitespace message is rejected before a request');
      assert.equal(await message.getAttribute('maxlength'), '1000');
      await message.fill('  رسالة اختبار محفوظة  ');
      await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'لم نتمكن من تأكيد إرسال الرسالة' }).waitFor();
      assert.equal(await message.inputValue(), '  رسالة اختبار محفوظة  ', 'HTTP/HTML failure retains the draft');
      assert.equal(requests[0].message, 'رسالة اختبار محفوظة');
      messageMode = 'limit';
      await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'أرسلت عدة رسائل' }).waitFor();
      messageMode = 'delayed-success';
      await page.getByRole('button', { name: 'إرسال الرسالة', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'true');
      assert(await page.getByRole('button', { name: 'جارٍ الإرسال…', exact: true }).isDisabled());
      await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      while (!releaseMessage) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(requests.length, 3, 'Duplicate submit while pending cannot create a second request');
      releaseMessage();
      await page.getByRole('heading', { name: 'تم الإرسال بنجاح!', exact: true }).waitFor();
      await page.getByRole('button', { name: 'إرسال رسالة أخرى', exact: true }).click();
      assert.equal(await message.inputValue(), '', 'Confirmed success clears the draft');
      await page.getByRole('button', { name: 'العودة', exact: true }).click();
      await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
      await page.locator('#export-pdf-btn').click();
      const dialog = page.getByRole('dialog', { name: 'نشرة الأسعار', exact: true });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('checkbox').count(), 43, 'Only available prices are selectable');
      assert.equal(await dialog.getByText('صنف بلا سعر', { exact: true }).count(), 0);
      await dialog.getByRole('button', { name: 'إلغاء التحديد', exact: true }).click();
      assert(await dialog.getByRole('button', { name: 'طباعة / PDF', exact: true }).isDisabled());
      await dialog.getByRole('button', { name: 'السوق الرسمي', exact: true }).click();
      await dialog.getByRole('checkbox').first().check();
      await dialog.getByRole('checkbox').nth(1).check();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'PDF selection has no horizontal overflow');
        const bounds = await dialog.boundingBox();
        assert(bounds.y >= 0 && bounds.y + bounds.height <= height + 1, 'Dialog and print action fit short screens');
        await page.screenshot({ path: path.join(output, 'pdf-selection-' + theme + '-' + width + '.png') });
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
      await page.locator('#export-pdf-btn').click();
      parallel.USD = 9.83;
      await dialog.getByRole('button', { name: 'طباعة / PDF', exact: true }).click();
      await page.waitForFunction(() => window.printCalls === 1);
      const report = page.locator('#pdf-report-container');
      assert.equal(await report.locator('tbody tr').count(), 2, 'Print preserves the selected official currencies');
      assert.equal(await report.locator('[data-code="USD"] td').nth(2).innerText(), '—', 'Unavailable previous price is not fabricated');
      assert((await report.innerText()).includes('10:30'), 'Data timestamp uses Tripoli, not the visitor timezone');
      assert(!(await report.innerText()).includes('معتمدة رسمياً'));
      if (width === 1440) {
        await page.evaluate(() => document.fonts.ready);
        await page.pdf({ path: path.join(output, 'bulletin-official.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: 'print' });
        await report.screenshot({ path: path.join(output, 'bulletin-official.png') });
        await page.emulateMedia({ media: null });
      }
      await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
      await page.locator('#export-pdf-btn').click();
      await dialog.getByRole('button', { name: 'تحديد الكل', exact: true }).click();
      await dialog.getByRole('button', { name: 'طباعة / PDF', exact: true }).click();
      await page.waitForFunction(() => window.printCalls === 2);
      assert.equal(await report.locator('tbody tr').count(), 43, 'Long bulletin includes every selected available item');
      assert.equal(await report.locator('[data-market="parallel"] [data-code="USD"] td').nth(1).innerText(), '9.83', 'Printing uses the refreshed rate');
      assert((await report.locator('[data-code="GOLD_LIRA_8G"]').innerText()).includes('قطعة'));
      if (width === 1440) {
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('#dashboard-main').isVisible(), false, 'Print hides the dashboard, not only its visibility');
        assert.equal(await report.evaluate(element => getComputedStyle(element).position), 'static', 'Report participates in page flow for pagination');
        assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), 'light', 'Dark site appearance never produces dark paper margins');
        await page.pdf({ path: path.join(output, 'bulletin-all.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: null });
      }
      assert.deepEqual(errors, [], 'No browser exceptions');
      await context.close();
      console.log('PASS ' + width + 'x' + height + ': contact validation/retry/duplicate protection, PDF selection/refresh/print');
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
