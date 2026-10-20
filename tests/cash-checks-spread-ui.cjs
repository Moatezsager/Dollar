const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { assertSmoothCurve } = require('./chart-presentation.cjs');

async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const vite = await createServer({ configFile: false, plugins: [react(), tailwind()],
    cacheDir: path.join(require('node:os').tmpdir(), 'dollar-spread-vite-cache'),
    resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'recharts', 'lucide-react', 'motion/react', 'date-fns', 'date-fns/locale'] },
    server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  vite.middlewares.use('/__spread-test', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__spread-test', `<!doctype html><html dir="rtl" lang="ar"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة فجوة الكاش والصكوك</title></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {AdvancedChartsSection} from '/src/components/charts/AdvancedChartsSection.tsx';
      import {MainRatesGrid} from '/src/components/rates/MainRatesGrid.tsx';
      import {libyaDayKey} from '/src/utils/rateHistory.ts';
      import '/src/index.css';
      const now=Date.now()-60000, DAY=86400000;
      const point=(time,cash,checks)=>({time:new Date(time).toISOString(),usdParallel:cash,usdOfficial:6.4,ratesParallel:{USD:cash,USD_CHECKS:checks},ratesOfficial:{USD:6.4},observed:{parallel:['USD','USD_CHECKS'],official:[]}});
      const daily=Array.from({length:30},(_,i)=>point(now-(29-i)*DAY,10.1+i*.005,i===29?10.745:10.3+i*.005+(i%4)*.015));
      const windowMs=Math.min(4*3600000,now-Date.parse(libyaDayKey(now)+'T00:00:00+02:00'));
      const intraday=[10.16,10.19,10.17,10.21,10.23,10.20,10.22,10.24].map((cash,i)=>point(now-(8-i)/9*windowMs,cash,10.55+(cash-10.16)*1.2+(i%3)*.01));
      const baseline=[...daily.slice(0,-1),...intraday,daily.at(-1)];
      const initial={history:baseline,rates:{parallel:{USD:10.245,USD_CHECKS:10.745,EUR:11.12},official:{USD:6.4},lastUpdated:new Date(now).toISOString()},isOffline:false};
      function Fixture(){
        const [state,setState]=React.useState(initial),[currency,setCurrency]=React.useState('USD_CASH'),[range,setRange]=React.useState('1m');
        const home=new URLSearchParams(location.search).has('home');
        const [activeTab,setActiveTab]=React.useState(home?'main':'charts');
        const [view,setView]=React.useState(new URLSearchParams(location.search).has('spread')?'spread':'prices');
        const [expanded,setExpanded]=React.useState({foreign:false,checks:false,transfers:false,official:false});
        const openSpread=()=>{setView('spread');setActiveTab('charts');document.getElementById('analysis-tab-spread')?.focus();};
        window.spreadFixture={initial,point,update:(patch)=>setState(previous=>({...previous,...patch}))};
        return React.createElement('div',{className:'app-shell min-h-screen'},React.createElement('div',{style:{maxWidth:1240,margin:'0 auto',padding:'20px 16px 48px'}},
          React.createElement('p',{style:{fontSize:12,color:'var(--muted-ink)',borderBottom:'1px solid var(--line)',paddingBottom:10}},'معاينة محلية · بيانات تجريبية معزولة وليست أسعارًا حقيقية'),
          home&&React.createElement(MainRatesGrid,{activeTab,rates:state.rates,history:state.history,isOffline:state.isOffline,onOpenSpread:openSpread,
            configTerms:[{id:'EUR',name:'يورو',flag:'🇪🇺'},{id:'USD_CHECKS',name:'دولار صكوك',flag:'🇺🇸'}],dynamicCurrencies:[{code:'USD',name:'دولار أمريكي',flag:'🇺🇸'}],
            staleCurrencies:new Set(),trends24h:{},usdRate:state.rates?.parallel.USD||0,prevUsdRate:10.24,usdFlash:null,
            usdChecksRate:state.rates?.parallel.USD_CHECKS||0,prevUsdChecksRate:10.7,usdChecksFlash:null,officialUsdRate:6.4,prevOfficialUsdRate:6.4,officialUsdFlash:null,
            usd24hStats:{high:10.245,low:10.2,avg:10.23,changePercent:0.04},usdSparklineData:[],expandedSections:expanded,
            toggleSection:key=>setExpanded(previous=>({...previous,[key]:!previous[key]})),setSelectedRate:rate=>{window.selectedTestRate=rate;}}),
          home&&activeTab==='charts'&&React.createElement('button',{onClick:()=>setActiveTab('main')},'العودة للأسعار'),
          activeTab==='charts'&&React.createElement(AdvancedChartsSection,{activeTab,view,setView,history:state.history,rates:state.rates,isOffline:state.isOffline,
            chartAnalysisCurrency:currency,setChartAnalysisCurrency:setCurrency,chartAnalysisRange:range,setChartAnalysisRange:setRange})));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script></body></html>`);
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await vite.listen();
  const base = 'http://127.0.0.1:' + vite.httpServer.address().port + '/__spread-test';
  if (process.argv.includes('--preview')) { console.log('ISOLATED_SPREAD_PREVIEW=' + base + '?home=1'); return; }
  const output = process.env.UI_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'Dollar-spread-proof');
  await fs.mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 768, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage(), errors = [], apiRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
      await page.goto(base + '?home=1', { waitUntil: 'domcontentloaded' });
      const teaser = page.getByRole('region', { name: 'ملخص فجوة الكاش والصكوك' });
      await teaser.getByRole('heading', { name: 'فجوة الكاش والصكوك', exact: true }).waitFor();
      assert.equal(await teaser.locator('dd strong').innerText(), '+0.50');
      assert.equal(await teaser.locator('dd b').innerText(), '+4.8804%');
      assert.equal(await page.locator('.cash-spread').count(), 0, 'Detailed chart stays lazy on the home screen');
      const mainChart = page.locator('.usd-chart');
      const mainRanges = mainChart.getByRole('group', { name: 'فترة حركة الدولار', exact: true });
      await mainChart.locator('.usd-chart-price-marker text').waitFor();
      for (const [label, days] of [['24 ساعة', 1], ['7 أيام', 7], ['30 يومًا', 30]]) {
        await mainRanges.getByRole('button', { name: label, exact: true }).focus();
        await page.keyboard.press('Enter');
        assert.equal(await mainRanges.locator('[aria-pressed="true"]').innerText(), label);
        const expected = await page.evaluate(days => window.spreadFixture.initial.history.filter(point => Date.parse(point.time) >= Date.now() - days * 86400000).map(point => point.usdParallel), days);
        await page.waitForFunction(count => {
          const path = document.querySelector('.usd-chart .recharts-area-curve')?.getAttribute('d');
          return path && (path.match(/[MLC]/g) || []).length === count;
        }, expected.length);
        assert.equal(assertSmoothCurve(await mainChart.locator('.recharts-area-curve').getAttribute('d')), expected.length, 'Home chart preserves every real observation');
        assert.equal(await mainChart.locator('.usd-chart-quote strong').innerText(), expected.at(-1).toFixed(2));
        assert.equal(await mainChart.locator('.usd-chart-price-marker text').textContent(), expected.at(-1).toFixed(2));
        assert.deepEqual(await mainChart.locator('.usd-chart-stats dd').allTextContents(), [Math.max(...expected).toFixed(2), Math.min(...expected).toFixed(2), (expected.reduce((a,b)=>a+b,0)/expected.length).toFixed(2)]);
        assert.equal(await mainChart.locator('.usd-chart-change b').innerText(), '+' + ((expected.at(-1)-expected[0])/expected[0]*100).toFixed(2) + '%');
      }
      await mainChart.locator('svg.recharts-surface').focus();
      await page.keyboard.press('ArrowRight');
      await mainChart.locator('.price-chart-tooltip').waitFor();
      if (width < 768) {
        await mainChart.locator('svg.recharts-surface').tap({ position: { x: 70, y: 70 } });
        await mainChart.locator('.price-chart-tooltip').waitFor();
      }
      await page.mouse.move(0, 0);
      await mainChart.getByRole('button', { name: 'عرض تفاصيل حركة الدولار', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.selectedTestRate), { code: 'USD', name: 'دولار أمريكي (كاش موازي)', market: 'parallel' });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        const boxes = await page.evaluate(() => ['.primary-rates','.spread-teaser','.usd-chart'].map(selector => {
          const {top,bottom}=document.querySelector(selector).getBoundingClientRect(); return {top,bottom};
        }));
        assert(boxes[1].top >= boxes[0].bottom, 'Summary follows the dollar cards');
        assert(width < 1024 ? boxes[2].top >= boxes[1].bottom : boxes[1].top >= boxes[2].bottom, 'Summary respects mobile/desktop grid placement');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home screen has no horizontal overflow');
        await teaser.screenshot({ path: path.join(output, 'spread-summary-' + theme + '-' + width + '.png') });
        assert(await mainChart.locator('.usd-chart-price-marker').evaluate(marker => {
          const box = marker.getBoundingClientRect(), svg = marker.closest('svg').getBoundingClientRect();
          return box.left >= svg.left && box.right <= svg.right && box.top >= svg.top && box.bottom <= svg.bottom;
        }), 'Latest-price label stays inside the chart');
        await mainChart.screenshot({ path: path.join(output, 'home-dollar-chart-' + theme + '-' + width + '.png') });
        if (width === 390 || width === 1440) { await page.evaluate(() => scrollTo(0,0)); await page.screenshot({ path: path.join(output, 'spread-home-' + theme + '-' + width + '.png') }); }
      }
      await page.evaluate(() => document.documentElement.dataset.fontSize = 'large');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large summary text fits');
      assert(await mainRanges.getByRole('button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44)), 'Chart periods remain touch-sized with large text');
      assert(await mainChart.locator('.usd-chart-stats > div').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth + 1)), 'Large chart statistics do not collide');
      assert(await teaser.getByRole('button').evaluate(el => el.getBoundingClientRect().height >= 44));
      await page.evaluate(() => delete document.documentElement.dataset.fontSize);
      await page.evaluate(() => { const f=window.spreadFixture; f.update({history:[...f.initial.history,f.point(Date.now()-500,10.05,10.7)],isOffline:true}); });
      await mainChart.locator('.usd-chart-quote').getByText('10.05', { exact:true }).waitFor();
      assert.match(await mainChart.locator('.usd-chart-change b').innerText(), /^-/);
      assert.equal(await mainChart.locator('.usd-chart-price-marker text').textContent(), '10.05', 'Live observations update both the headline and endpoint');
      await mainChart.getByText('بيانات محفوظة', { exact:true }).waitFor();
      await page.evaluate(() => window.spreadFixture.update({history:window.spreadFixture.initial.history,isOffline:false}));
      await mainChart.locator('.usd-chart-quote').getByText('10.24', { exact:true }).waitFor();
      await teaser.getByRole('button', { name: 'عرض المزيد عن فجوة الكاش والصكوك', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.id === 'analysis-tab-spread');
      assert.equal(await page.getByRole('tab', { name: 'الكاش والصكوك', exact: true }).getAttribute('aria-selected'), 'true', 'More opens spread directly, not general price analysis');
      assert.equal(await page.locator('.spread-main-value strong').innerText(), '+0.50');
      if (width >= 768) {
        await teaser.getByRole('button').click();
        await page.waitForFunction(() => document.activeElement?.id === 'analysis-tab-spread');
      }
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const tabs = page.getByRole('tablist', { name: 'أقسام التحليل' });
      await tabs.getByRole('tab', { name: 'حركة الأسعار', exact: true }).waitFor();
      await tabs.getByRole('tab', { name: 'حركة الأسعار', exact: true }).focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await tabs.getByRole('tab', { name: 'الكاش والصكوك', exact: true }).getAttribute('aria-selected'), 'true');
      const section = page.locator('.cash-spread');
      await section.getByRole('heading', { name: 'فجوة الكاش والصكوك', exact: true }).waitFor();
      assert.equal(await section.locator('.spread-main-value strong').innerText(), '+0.50');
      assert.match(await section.locator('.spread-reading').innerText(), /حركة الفجوة.*كبرت/s);
      assert.match(await section.locator('.spread-reading').innerText(), /سعر الكاش زاد.*سعر الصكوك زاد/);
      assert.equal(await section.locator('.spread-reading p').count(), 2, 'The default reading is two concise statements');
      await section.getByRole('heading', { name: 'الصكوك أعلى من الكاش بـ 0.50 د.ل للدولار', exact: true }).waitFor();
      const insights = section.locator('.spread-insights');
      assert.equal(await insights.getAttribute('open'), null, 'Detailed statistics are collapsed by default');
      await insights.locator('summary').click();
      assert.match(await section.locator('.spread-reference').innerText(), /29 يوم|النطاق الأوسط/);
      assert.match(await section.locator('.spread-reference').innerText(), /مش توقع للسعر الجاي/);
      assert.equal(await insights.locator('.spread-statistics > div').count(), 4, 'Full statistics remain available on demand');
      await insights.locator('summary').click();
      assert.equal(await section.locator('.spread-status.is-caution').count(), 0);
      await section.locator('.recharts-line-curve').first().waitFor();
      assert.equal(await section.locator('.recharts-line-curve').count(), 2, 'Default chart directly compares the two prices');
      for (const path of await section.locator('.recharts-line-curve').evaluateAll(paths => paths.map(path => path.getAttribute('d')))) assert.equal(assertSmoothCurve(path), 30);
      const calculator = section.getByRole('region', { name: 'احسب الفرق الآن', exact: true });
      const amountInput = calculator.getByLabel('المبلغ بالدولار', { exact: true });
      const amountResults = calculator.locator('.spread-amount-results');
      assert.deepEqual(await amountResults.locator('dd strong').allTextContents(), ['10,245.00','10,745.00','+500.00']);
      const firstLabel = await section.locator('.recharts-xAxis-tick-labels').textContent();
      assert(firstLabel.length > 0);
      assert(!firstLabel.includes(':'), 'Daily chart uses Libya dates instead of foreign-zone hours');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
        const sizes = await section.locator('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
        assert(sizes.every(height => height >= 44), 'Touch targets remain at least 44px');
        await section.screenshot({ path: path.join(output, 'spread-' + theme + '-' + width + '.png') });
      }
      const modes = section.getByRole('group', { name: 'عرض رسم الفجوة' });
      await modes.getByRole('button', { name: 'الفرق د.ل', exact: true }).click();
      await section.locator('.recharts-area-curve').waitFor();
      const curve = section.locator('.recharts-area-curve');
      assert((await curve.getAttribute('d')).length > 40); assert(!/NaN|Infinity/.test(await curve.getAttribute('d')));
      assert.equal(assertSmoothCurve(await curve.getAttribute('d')), 30, 'Smoothing keeps every shared daily observation');
      await amountInput.fill('2500');
      assert.deepEqual(await amountResults.locator('dd strong').allTextContents(), ['25,612.50','26,862.50','+1,250.00']);
      await amountInput.fill('1.25');
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '+0.625');
      await amountInput.fill('0');
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '0.00');
      await calculator.getByText('نفس المقابل بالطريقتين', { exact: true }).waitFor();
      await amountInput.fill('');
      assert.deepEqual(await amountResults.locator('dd strong').allTextContents(), ['—','—','—'], 'Blank is not treated as a zero amount');
      await amountInput.fill('-1');
      assert.equal(await amountInput.getAttribute('aria-invalid'), 'true');
      await calculator.getByRole('alert').waitFor();
      await amountInput.fill('1000000001');
      assert.equal(await amountInput.getAttribute('aria-invalid'), 'true');
      await amountInput.fill('1000000000');
      assert.equal(await amountInput.getAttribute('aria-invalid'), 'false');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large amounts wrap without overflowing');
      await amountInput.fill('1000');
      await modes.getByRole('button', { name: 'النسبة %', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.cash-spread .recharts-yAxis-tick-labels')?.textContent.includes('%'));
      assert((await section.locator('.recharts-yAxis-tick-labels').textContent()).includes('%'));
      await modes.getByRole('button', { name: 'السعران', exact: true }).click();
      await section.locator('.recharts-line-curve').first().waitFor();
      assert.equal(await section.locator('.recharts-line-curve').count(), 2);
      const dashed = await section.locator('.recharts-line-curve').nth(1).getAttribute('stroke-dasharray');
      assert(dashed, 'Price series are distinguished by line pattern as well as color');
      await modes.getByRole('button', { name: 'الفرق د.ل', exact: true }).click();
      const graph = section.locator('.spread-chart');
      await graph.hover({ position: { x: 80, y: 80 } });
      await section.locator('.spread-tooltip').waitFor();
      assert.match(await section.locator('.spread-tooltip').innerText(), /نسبة الفجوة/);
      if (width < 768) {
        await graph.tap({ position: { x: 90, y: 100 } });
        await section.locator('.spread-tooltip').waitFor();
      }
      await page.mouse.move(0, 0);
      await section.getByText('سجل المقارنة', { exact: true }).click();
      assert.equal(await section.locator('tbody tr').count(), 30);
      await section.getByText('سجل المقارنة', { exact: true }).click();
      await section.getByText('كيف تُحسب هذه المقارنة؟', { exact: true }).click();
      assert.match(await section.locator('.spread-methodology').innerText(), /ليس.*|لا يثبت تزامن/);
      await section.getByText('كيف تُحسب هذه المقارنة؟', { exact: true }).click();
      await page.evaluate(() => document.documentElement.dataset.fontSize = 'large');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large text fits the viewport');
      assert.equal(await section.locator('.spread-reading p').first().evaluate(el => getComputedStyle(el).fontSize), '16px');
      await page.evaluate(() => delete document.documentElement.dataset.fontSize);
      const periods = section.getByRole('group', { name: 'فترة فجوة الكاش والصكوك' });
      await periods.getByRole('button', { name: '7 أيام', exact: true }).click();
      await insights.locator('summary').click();
      assert.match(await section.locator('.spread-reference').innerText(), /7 أيام رصد سابقة/);
      await insights.locator('summary').click();
      assert.match(await section.locator('.spread-chart-caption > span').innerText(), /^7 يوم رصد من 7 · \d+ لقطة مشتركة$/);
      await periods.getByRole('button', { name: 'اليوم', exact: true }).click();
      assert.match(await section.locator('.spread-chart-toolbar').innerText(), /متوسطات ساعية/);
      await page.evaluate(() => {const f=window.spreadFixture;f.update({history:[f.initial.history.at(-1)]});});
      await section.getByText('نحتاج رصدين داخل الفترة لنعرف كيف تغيّرت الفجوة.', {exact:false}).waitFor();
      assert.match(await section.locator('.spread-reading').innerText(), /نحتاج رصدين داخل الفترة/);
      await page.evaluate(() => window.spreadFixture.update({history:window.spreadFixture.initial.history}));
      await periods.getByRole('button', { name: '30 يومًا', exact: true }).click();
      await page.evaluate(() => { const f=window.spreadFixture; f.update({history:f.initial.history.filter((_,i)=>i!==15)}); });
      await page.waitForFunction(() => document.querySelector('.spread-chart-caption > span')?.textContent.includes('29 يوم رصد'));
      const gappedPath = await curve.getAttribute('d');
      assert.equal(assertSmoothCurve(gappedPath), 29);
      assert.equal((gappedPath.match(/M/g)||[]).length, 2, 'Smoothing does not connect a missing day');
      await page.evaluate(() => {const f=window.spreadFixture;f.update({history:[f.initial.history[0],f.initial.history[5],f.initial.history[10]]});});
      await page.waitForFunction(() => document.querySelectorAll('.spread-chart .recharts-area-dot').length===3);
      assert.equal(await section.locator('.recharts-area-dot').count(), 3, 'Isolated observations remain visible even without connected segments');
      await page.evaluate(() => {
        const f = window.spreadFixture, latest = f.point(Date.now() - 500, 10.245, 10.845);
        f.update({ history: [...f.initial.history, latest], rates: { ...f.initial.rates, parallel: { USD: 10.245, USD_CHECKS: 10.845 }, lastUpdated: latest.time } });
      });
      await section.locator('.spread-main-value strong').getByText('+0.60', { exact: true }).waitFor();
      assert.equal(await amountInput.inputValue(), '1000', 'Live updates preserve the chosen amount');
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '+600.00');
      assert.equal(await section.locator('.spread-status.is-caution').count(), 0, 'New quotes render immediately, without waiting for the local minute clock');
      await page.evaluate(() => window.spreadFixture.update({ rates: { ...window.spreadFixture.initial.rates, parallel: { USD: 10.245, USD_CHECKS: 10.945 } } }));
      await section.getByText('بانتظار لقطة أحدث', { exact: true }).waitFor();
      assert.equal(await section.locator('.spread-main-value strong').innerText(), '+0.60', 'Mismatched current quotes cannot fabricate a historical pairing');
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '+600.00', 'Calculator cannot mix mismatched current prices with the shared snapshot');
      await page.evaluate(() => { const f=window.spreadFixture; f.update({history:[f.point(Date.now()-13*3600000,10,9.7)],rates:{...f.initial.rates,parallel:{USD:10,USD_CHECKS:9.7}}}); });
      await section.getByText('لقطة قديمة', { exact: true }).waitFor();
      await section.getByRole('heading', { name: 'الصكوك أقل من الكاش بـ 0.30 د.ل للدولار', exact: true }).waitFor();
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '-300.00');
      await calculator.getByText('المقابل بالصكوك أقل', { exact: true }).waitFor();
      await page.evaluate(() => window.spreadFixture.update({isOffline:true}));
      await section.getByText('غير متصل', { exact: true }).waitFor();
      await page.evaluate(() => { const f=window.spreadFixture; f.update({isOffline:false,history:[f.point(Date.now()-500,10,10)],rates:{...f.initial.rates,parallel:{USD:10,USD_CHECKS:10}}}); });
      await section.getByText('الكاش والصكوك بنفس السعر في آخر رصد', { exact: true }).waitFor();
      assert.equal(await section.locator('.spread-main-value strong').innerText(), '0.00');
      assert.equal(await amountResults.locator('dd strong').last().innerText(), '0.00');
      await page.evaluate(() => window.spreadFixture.update({history:[],rates:null}));
      await section.getByText('بانتظار لقطة مشتركة للسعرين', { exact: true }).waitFor();
      assert.equal(await section.locator('.spread-main-value').count(), 0, 'Unavailable data is not shown as a zero quote');
      await page.goto(base + '?home=1', { waitUntil: 'domcontentloaded' });
      await teaser.locator('dd strong').getByText('+0.50', { exact: true }).waitFor();
      await page.evaluate(() => { const f=window.spreadFixture; f.update({history:[f.point(Date.now()-13*3600000,10,9.7)],rates:{...f.initial.rates,parallel:{USD:10,USD_CHECKS:9.7}}}); });
      await teaser.getByText('لقطة قديمة · ليست سعرًا حاليًا', { exact: true }).waitFor();
      assert.equal(await teaser.locator('dd strong').innerText(), '-0.30');
      const oldTime=await teaser.locator('time').getAttribute('datetime');
      await page.evaluate(() => { const f=window.spreadFixture; f.update({rates:{...f.initial.rates,parallel:{USD:10,USD_CHECKS:10.5}}}); });
      await teaser.getByText('بانتظار لقطة أحدث', { exact: true }).waitFor();
      assert.equal(await teaser.locator('time').getAttribute('datetime'), oldTime);
      assert.equal(await teaser.locator('dd strong').innerText(), '-0.30');
      await page.evaluate(() => window.spreadFixture.update({isOffline:true}));
      await teaser.getByText('غير متصل · بيانات محفوظة', { exact: true }).waitFor();
      await page.evaluate(() => { const f=window.spreadFixture; f.update({isOffline:false,history:[f.point(Date.now()-500,10,10)],rates:{...f.initial.rates,parallel:{USD:10,USD_CHECKS:10}}}); });
      await teaser.getByText('الكاش والصكوك بنفس السعر في آخر رصد', { exact: true }).waitFor();
      assert.equal(await teaser.locator('dd strong').innerText(), '0.00');
      await page.evaluate(() => window.spreadFixture.update({history:[],rates:null}));
      await teaser.getByText('بانتظار لقطة مشتركة للسعرين', { exact: true }).waitFor();
      assert.equal(await teaser.locator('dd strong').innerText(), '—');
      assert.equal(apiRequests.length, 0, 'The feature performs no API/database polling');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: home summary placement, keyboard/direct detail navigation, correct labels/formulas, line styles/tooltips/table, 320/390/768/1440 light/dark layouts, live updates, stale/offline/pending/negative/zero/empty states and no API requests. Screenshots: ' + output);
  } finally { await browser?.close(); await vite.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
