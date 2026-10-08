const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Browser fixtures isolate this check from the database, worker, and live prices.
async function toggleTheme(page) {
  const inMenu = await page.locator('.theme-toggle:visible').count() === 0;
  if (inMenu) await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
  await page.locator('.theme-toggle:visible').click();
  if (inMenu) await page.keyboard.press('Escape');
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL });
  const output = process.env.UI_SCREENSHOT_DIR || path.join(require('node:os').tmpdir(), 'dollar-ui-check');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, height] of [[320, 740], [375, 820], [430, 932], [768, 1024], [1024, 900], [1440, 1000], [1920, 1080]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('hasSeenTour', 'true');
        localStorage.setItem('soundEnabled', 'false');
        localStorage.setItem('hapticEnabled', 'false');
        localStorage.setItem('installPromptDismissed', 'true');
        localStorage.setItem('pushPromptDismissed_v4', Date.now().toString());
      });
      const now = new Date().toISOString();
      let empty = false;
      let contactFailure = true;
      let usd = 9.4;
      let ratesFailure = false;
      let firstRates = true;
      let releaseInitialRates;
      const initialRatesReady = new Promise(resolve => { releaseInitialRates = resolve; });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/rates' && firstRates) {
          await initialRatesReady;
        }
        if (url.pathname === '/api/rates' && ratesFailure) return route.fulfill({ status: 503, json: {} });
        if (url.pathname === '/api/messages') return route.fulfill({ status: contactFailure ? 503 : 200, json: { error: 'تعذر الإرسال مؤقتاً' } });
        let body = {};
        if (url.pathname === '/api/config') body = { terms: [{ id: 'EUR', name: 'يورو', flag: 'eu' }, { id: 'GBP', name: 'جنيه إسترليني', flag: 'gb' }] };
        if (url.pathname === '/api/rates') body = { parallel: empty ? {} : { USD: usd, USD_CHECKS: 9.6, EUR: 10.2, GBP: 12.1 }, official: empty ? {} : { USD: 6.3, EUR: 7.1 }, previousParallel: { USD: 9.3, EUR: 10.1 }, previousOfficial: { USD: 6.2 }, lastUpdated: now };
        if (url.pathname === '/api/history') body = empty ? [] : Array.from({ length: 12 }, (_, i) => ({ time: new Date(Date.now() - (12 - i) * 3600000).toISOString(), usdParallel: 9.3 + i * 0.01, usdOfficial: 6.3, ratesParallel: { EUR: 10 + i * 0.02, USD_CHECKS: 9.6 } }));
        if (url.pathname === '/api/status') body = { status: 'active', minutesSinceLastScrape: 0 };
        return route.fulfill({ json: body });
      });
      await page.route('**/socket.io/**', route => route.fulfill({ status: 503, body: '' }));
      if (width === 320) {
        await page.route('https://flagcdn.com/w160/us.png', route => route.abort());
      }
      await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded' });
      await page.locator('.skeleton-pulse').first().waitFor();
      firstRates = false;
      releaseInitialRates();
      await page.locator('.dollar-cards').waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: /^يورو،/ }).first().waitFor();
      await page.waitForTimeout(700);
      await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).every(image => image.complete), undefined, { timeout: 5000 }).catch(() => {});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
      assert(await page.locator('.header-brand-title').evaluate(title => title.scrollWidth <= title.clientWidth), `Brand title must not be clipped at ${width}`);
      for (const name of ['البحث الذكي', 'تحديث البيانات', 'المزيد من الخيارات']) {
        assert(await page.getByRole('button', { name, exact: true }).isVisible(), `Header tool visible at ${width}: ${name}`);
      }
      if (width === 320) {
        assert(await page.locator('.primary-rates .flag-fallback').count() >= 3, 'Unavailable flag images display accessible fallback icons');
      }
      if (width === 320) {
        await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
        await page.locator('.dollar-cards').getByText('9.40', { exact: true }).waitFor();
      }
      assert.equal(await page.locator('.primary-rates > *').count(), 4, 'The primary dashboard contains USD cash, checks, official USD, and EUR');
      for (const card of await page.locator('.primary-rates > *').all()) {
        const rect = await card.boundingBox();
        assert(rect && rect.width > 0 && rect.height > 0, `Every primary rate card must be visible at ${width}`);
      }
      if (width <= 380) {
        const [ratesGrid, primaryCard, euroCard, euroPrice, mobileNav] = await Promise.all([
          page.locator('.primary-rates').boundingBox(),
          page.locator('.primary-rates > :first-child').boundingBox(),
          page.locator('.eur-feature').boundingBox(),
          page.locator('.eur-feature .rate-card .text-2xl').boundingBox(),
          page.getByRole('navigation', { name: 'التنقل الرئيسي' }).boundingBox()
        ]);
        assert(ratesGrid && primaryCard && euroCard && Math.abs(primaryCard.width - euroCard.width) < 2 && ratesGrid.width > primaryCard.width * 1.8, `Primary cards use equal columns at ${width}`);
        assert(euroPrice && mobileNav && euroPrice.y + euroPrice.height <= mobileNav.y, `EUR price is not obscured by mobile navigation at ${width}: ${JSON.stringify({ euroPrice, mobileNav })}`);
      }
      if (width >= 1024) {
        const [prices, chart] = await Promise.all([
          page.locator('.primary-rates').boundingBox(),
          page.locator('.usd-chart').boundingBox()
        ]);
        assert(prices && chart && Math.abs(prices.y - chart.y) < 12, `Desktop chart aligns beside the rates at ${width}`);
        assert(Math.abs(prices.height - chart.height) < 2, `Desktop chart and rates share a balanced height at ${width}`);
        assert(prices.x + prices.width <= chart.x || chart.x + chart.width <= prices.x, `Desktop chart does not overlap rate cards at ${width}`);
      }
      if (width >= 1280) {
        const [euroName, euroBadge] = await Promise.all([
          page.locator('.eur-feature .rate-card > div:first-child > div:first-child > div:nth-child(2) > span:first-child').boundingBox(),
          page.locator('.eur-feature .rate-value > div:last-child > span').boundingBox()
        ]);
        assert(euroName && euroBadge && (euroName.x + euroName.width <= euroBadge.x || euroBadge.x + euroBadge.width <= euroName.x || euroName.y + euroName.height <= euroBadge.y || euroBadge.y + euroBadge.height <= euroName.y), `EUR name and trend badge do not overlap at ${width}`);
      }
      if (width < 768) {
        const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
        assert.equal(await nav.getByRole('button').count(), 5);
        assert.equal(await nav.locator('button span').count(), 5);
        assert.equal(await nav.locator('[aria-current="page"]').count(), 1, 'Exactly one mobile tab is selected');
        await nav.getByRole('button', { name: 'التحليل', exact: true }).click();
        const charts = page.locator('#charts-section');
        await charts.getByRole('button', { name: 'يورو', exact: true }).click();
        assert.equal(await charts.getByRole('button', { name: 'يورو', exact: true }).getAttribute('aria-pressed'), 'true');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Chart filter overflow at ${width}`);
        await page.screenshot({ path: path.join(output, `charts-${width}.png`) });
        await nav.getByRole('button', { name: 'الرئيسية', exact: true }).click();
      } else {
        for (const link of await page.getByRole('navigation', { name: 'أقسام لوحة الأسعار' }).locator('a').all()) {
          assert.equal(await page.locator(await link.getAttribute('href')).count(), 1);
        }
      }
      await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `viewport-${width}.png`) });
      const priceText = await page.locator('.dollar-cards').innerText();
      const storageBeforeTheme = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
      await toggleTheme(page);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      assert.equal(await page.locator('.dollar-cards').innerText(), priceText, 'Theme does not change prices');
      assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), storageBeforeTheme, 'Theme does not change storage');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Light layout at ${width}`);
      await page.screenshot({ path: path.join(output, `light-${width}.png`) });
      const card = page.getByRole('button', { name: 'عرض تفاصيل الدولار النقدي في السوق الموازي' });
      await card.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.waitForTimeout(250);
      assert(await dialog.evaluate(element => element.contains(document.activeElement)), 'Dialog must receive focus');
      await dialog.getByText('القراءات التاريخية', { exact: true }).click();
      await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Test clipboard failure'); }; });
      await dialog.getByRole('button', { name: 'نسخ السعر', exact: true }).click();
      await dialog.getByText('تعذر النسخ', { exact: true }).waitFor();
      await page.evaluate(() => { navigator.clipboard.writeText = async () => {}; });
      await dialog.getByRole('button', { name: 'نسخ السعر', exact: true }).click();
      await dialog.getByText('تم النسخ!', { exact: true }).waitFor();
      await dialog.getByRole('table').waitFor();
      assert(await dialog.getByRole('table').isVisible(), 'Accessible price history table');
      await dialog.getByText('القراءات التاريخية', { exact: true }).click();
      const last = dialog.getByRole('button', { name: 'إغلاق', exact: true }).last();
      await last.focus();
      await page.keyboard.press('Tab');
      assert(await dialog.evaluate(element => element.contains(document.activeElement)), 'Tab must stay inside dialog');
      await page.screenshot({ path: path.join(output, `dialog-${width}.png`) });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert(await card.evaluate(element => element === document.activeElement), 'Focus must return to the price card');
      await page.getByRole('button', { name: 'البحث الذكي', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('textbox', { name: 'البحث عن عملة أو ذهب أو صكوك' }).fill('يورو');
      await page.getByRole('dialog', { name: 'البحث', exact: true }).getByRole('button', { name: /^يورو،/ }).first().click();
      await page.getByRole('dialog', { name: 'يورو', exact: true }).waitFor();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert(await page.getByRole('button', { name: 'البحث الذكي', exact: true }).evaluate(element => element === document.activeElement), 'Search details must return focus to search trigger');
      await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
      await page.getByRole('button', { name: 'الإعدادات والتنبيهات', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'الإعدادات' });
      await settings.waitFor();
      await page.waitForTimeout(300);
      assert.equal(await settings.getByRole('switch').count(), 4);
      const haptic = settings.getByRole('switch', { name: 'الاهتزاز', exact: true });
      await haptic.focus();
      await page.keyboard.press('Space');
      assert.equal(await haptic.getAttribute('aria-checked'), 'true');
      const bounds = await settings.boundingBox();
      assert(bounds.y >= -1 && bounds.y + bounds.height <= height + 1, `Settings must fit ${width}x${height}`);
      await page.screenshot({ path: path.join(output, `settings-${width}.png`) });
      await settings.getByRole('button', { name: 'المظهر', exact: true }).click();
      await settings.getByRole('combobox', { name: 'حجم الخط', exact: true }).selectOption('large');
      await page.keyboard.press('Escape');
      await settings.waitFor({ state: 'hidden' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Large text overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `large-text-${width}.png`) });
      for (const [label, title] of [['بوابة المطورين (API)', 'بوابة المطورين'], ['عن المنصة', 'عن المنصة'], ['اتصل بنا وملاحظاتك', 'اتصل بنا']]) {
        await page.getByRole('button', { name: 'المزيد من الخيارات', exact: true }).click();
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${title} overflow at ${width}`);
        if (title === 'اتصل بنا') {
          await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('test@example.com');
          await page.getByRole('textbox', { name: 'رقم الهاتف (واتساب)', exact: true }).fill('+218910000000');
          await page.getByRole('textbox', { name: 'الرسالة', exact: true }).fill('UI fixture only');
          await page.locator('form button[type="submit"]').evaluate(button => button.scrollIntoView({ block: 'center' }));
          await page.locator('form button[type="submit"]').click();
          await page.getByRole('alert').filter({ hasText: 'تعذر الإرسال مؤقتاً' }).waitFor();
          contactFailure = false;
          await page.locator('form button[type="submit"]').evaluate(button => button.scrollIntoView({ block: 'center' }));
          await page.locator('form button[type="submit"]').click();
          await page.getByText('تم الإرسال بنجاح!', { exact: true }).waitFor();
        }
        await page.screenshot({ path: path.join(output, `page-${label.slice(0, 4)}-${width}.png`) });
      }
      if (width < 768) {
        await page.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('button', { name: 'الرئيسية', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'العودة', exact: true }).click();
      }
      await page.locator('.dollar-cards').waitFor();
      if (width < 768) {
        const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
        await nav.getByRole('button', { name: 'المحول', exact: true }).click();
      } else {
        await page.locator('#currency-converter-section').scrollIntoViewIfNeeded();
      }
      await page.getByRole('combobox', { name: 'عملة التحويل', exact: true }).selectOption('EUR');
      await page.getByRole('textbox', { name: 'المبلغ بالعملة الأجنبية', exact: true }).fill('2');
      assert.equal(await page.getByRole('spinbutton', { name: 'المبلغ بالدينار في السوق الموازي', exact: true }).inputValue(), '20.40');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Converter overflow');
      const directionButton = await page.getByRole('button', { name: 'إدخال القيمة بالدينار', exact: true }).boundingBox();
      const currencyInput = await page.getByRole('textbox', { name: 'المبلغ بالعملة الأجنبية', exact: true }).boundingBox();
      const parallelInput = await page.getByRole('spinbutton', { name: 'المبلغ بالدينار في السوق الموازي', exact: true }).boundingBox();
      assert(directionButton.y >= currencyInput.y + currencyInput.height && directionButton.y + directionButton.height <= parallelInput.y, 'Converter command must not overlap fields');
      await page.screenshot({ path: path.join(output, `converter-${width}.png`) });
      if (width < 768) {
        await page.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('button', { name: 'الذهب', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'لا توجد أسعار معادن متاحة' }).waitFor();
        await page.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('button', { name: 'المزيد', exact: true }).click();
        for (const title of ['سياسة الاستخدام', 'سياسة الخصوصية']) {
          await page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) }).first().click();
          await page.getByRole('heading', { name: title, exact: true }).waitFor();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${title} overflow`);
          await page.getByRole('button', { name: 'العودة', exact: true }).click();
        }
        await page.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('button', { name: 'الرئيسية', exact: true }).click();
      } else {
        for (const [label, title] of [['شروط الاستخدام', 'سياسة الاستخدام'], ['سياسة الخصوصية', 'سياسة الخصوصية']]) {
          await page.locator('footer').getByRole('button', { name: label, exact: true }).click();
          await page.getByRole('heading', { name: title, exact: true }).waitFor();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${title} overflow`);
          await page.getByRole('button', { name: 'العودة', exact: true }).click();
        }
      }
      usd = 9.5;
      await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
      await page.locator('.dollar-cards').getByText('9.50', { exact: true }).waitFor();
      ratesFailure = true;
      await page.getByRole('button', { name: 'تحديث البيانات', exact: true }).click();
      await page.waitForTimeout(500);
      assert(await page.locator('.dollar-cards').getByText('9.50', { exact: true }).isVisible(), 'Failed request retains available price');
      ratesFailure = false;
      await toggleTheme(page);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      empty = true;
      await page.evaluate(() => { localStorage.removeItem('lyd_rates'); localStorage.removeItem('lyd_history'); });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('لا توجد بيانات تاريخية كافية لهذه الفترة', { exact: true }).first().waitFor();
      assert(!await page.locator('.dollar-cards').innerText().then(text => /9\.55|9\.78|6\.41/.test(text)), 'No fabricated price fallback');
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS ${width}x${height}: layout, navigation, keyboard dialogs, search, empty data`);
      if (width === 320 || width === 1440 || width === 1920) {
        await page.goto(new URL('/admin-panel-secure', page.url()).href);
        await page.getByRole('textbox', { name: 'مفتاح الوصول الإداري', exact: true }).waitFor();
        await page.getByRole('button', { name: 'الوضع الفاتح', exact: true }).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Admin login overflow');
        await page.screenshot({ path: path.join(output, `admin-login-${width}.png`) });
        await page.route('**/api/admin/config', route => route.fulfill({ json: { terms: [], channels: [], adjustments: {}, calculationRules: [] } }));
        await page.route('**/api/admin/stats', route => route.fulfill({ json: { serverStartTime: now, memoryUsage: { heapUsed: 100, heapTotal: 200 } } }));
        await page.route('**/api/recent-changes', route => route.fulfill({ json: [] }));
        await page.addInitScript(() => localStorage.setItem('adminToken', 'ui-fixture-only'));
        await page.reload();
        await page.getByRole('button', { name: 'حفظ التغييرات', exact: true }).waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Admin dashboard overflow');
        if (width < 1024) {
          await page.getByRole('button', { name: 'فتح قائمة الإدارة', exact: true }).click();
          const adminMenu = page.getByRole('dialog', { name: 'قائمة الإدارة' });
          await page.waitForTimeout(100);
          assert(await adminMenu.evaluate(element => element.contains(document.activeElement)), 'Admin menu focus');
          await page.keyboard.press('Escape');
          await adminMenu.waitFor({ state: 'hidden' });
        }
        await page.getByRole('button', { name: 'الوضع الفاتح', exact: true }).click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        await page.screenshot({ path: path.join(output, `admin-dashboard-${width}.png`) });
        assert.equal(errors.length, 0, errors.join('\n'));
        console.log(`PASS admin ${width}: login, dashboard, theme, menu`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
