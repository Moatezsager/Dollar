const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Loopback fixtures only: no production services, personal accounts or price writes.
async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const vite = await createServer({ configFile: false, plugins: [react(), tailwind()], appType: 'custom',
    cacheDir: path.join(require('node:os').tmpdir(), 'dollar-currency-pdf-vite'),
    resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'recharts', 'lucide-react', 'motion/react', 'html2canvas', 'jspdf'] },
    server: { host: '127.0.0.1', port: 0 } });
  vite.middlewares.use('/__currency-report-test', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__currency-report-test', `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير عملة · بيانات تجريبية</title></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {CurrencyChartModal} from '/src/components/modals/CurrencyChartModal.tsx';
      import {useRatesCalculations} from '/src/hooks/useRatesCalculations.ts';
      import {buildCurrencyReport} from '/src/utils/currencyReport.ts';
      import '/src/index.css';
      const now=Date.now()-60000, DAY=86400000, params=new URLSearchParams(location.search);
      const initialHistory=Array.from({length:30},(_,i)=>({time:new Date(now-(29-i)*DAY).toISOString(),
        usdParallel:10.1+i*.005+Math.sin(i)*.04,usdOfficial:6.4403+i*.0001,
        ratesParallel:{USD:10.1+i*.005+Math.sin(i)*.04,EUR:11.1+i*.005,GOLD_LIRA_8G:7000+i},
        ratesOfficial:{USD:6.4403+i*.0001},observed:{parallel:['USD','EUR','GOLD_LIRA_8G'],official:['USD']}}));
      const current={parallel:{USD:10.27,EUR:11.25,GOLD_LIRA_8G:7029},official:{USD:6.4432},lastUpdated:new Date(now).toISOString(),lastChanged:{official:{USD:new Date(now).toISOString()},parallel:{USD:new Date(now).toISOString()}}};
      const initialSelection={code:'USD',name:'دولار أمريكي · بيانات تجريبية',market:params.has('official')?'official':'parallel'};
      function Fixture(){
        const [rates,setRates]=React.useState(current),[history,setHistory]=React.useState(initialHistory),[selected,setSelected]=React.useState(initialSelection);
        const calculations=useRatesCalculations({rates,history,selectedRate:selected,configTerms:[]});
        window.reportFixture={updatePrice:(price)=>setRates(old=>({...old,parallel:{...old.parallel,USD:price}})),
          select:(selection)=>setSelected(selection),empty:()=>setHistory([]),refresh:()=>setRates(old=>({...old})),
          open:()=>setSelected(initialSelection),all:()=>calculations.setChartRange('all')};
        return React.createElement('div',{className:'app-shell min-h-screen'},React.createElement('p',{style:{padding:20}},'معاينة محلية · بيانات تجريبية وليست أسعارًا حقيقية'),
          React.createElement('button',{onClick:()=>setSelected(initialSelection)},'عرض العملة'),
          selected&&React.createElement(CurrencyChartModal,{selectedRate:selected,setSelectedRate:setSelected,rates,configTerms:[],...calculations,triggerHaptic:()=>{}}));
      }
      if(params.has('report')){
        const {CurrencyPdfReport}=await import('/src/components/CurrencyPdfReport.tsx');
        const market=initialSelection.market, report=buildCurrencyReport({...initialSelection,price:current[market].USD,lastUpdated:current.lastUpdated,lastChanged:current.lastUpdated,
          range:'all',points:initialHistory.map(p=>({time:p.time,value:market==='official'?p.usdOfficial:p.usdParallel})),amount:100,
          advanced:{ma30:market==='official'?6.4417:10.17,support:market==='official'?6.4403:10.08,resistance:market==='official'?6.4432:10.3}});
        window.reportModel=report;
        createRoot(document.getElementById('root')).render(React.createElement('div',{style:{width:794,margin:'0 auto'}},React.createElement(CurrencyPdfReport,{report})));
      }else createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script></body></html>`);
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}/__currency-report-test`;
  if (process.argv.includes('--preview')) { console.log('ISOLATED_CURRENCY_REPORT_PREVIEW=' + base); return; }
  const output = process.env.UI_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'Dollar-currency-report');
  await fs.mkdir(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' });
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, hasTouch: width < 768, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
      await context.addInitScript(() => {
        window.shareMode = 'unsupported'; window.shareCalls = []; window.revokedUrls = [];
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => window.shareMode !== 'unsupported' });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
          const file=payload.files[0]; window.shareCalls.push({ name:file.name,type:file.type,size:file.size,active:navigator.userActivation.isActive });
          if(window.shareMode==='cancel')throw new DOMException('Cancelled','AbortError');
          if(window.shareMode==='error')throw new Error('Unsupported share target');
        }});
        const revoke=URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL=url=>{window.revokedUrls.push(url);revoke(url);};
      });
      const page = await context.newPage(), errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://flagcdn.com/**', route => route.abort());
      await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort(); });
      await page.goto(base + '?official=1', { waitUntil: 'domcontentloaded' });
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: 'دولار أمريكي · بيانات تجريبية' }).waitFor();
      await dialog.getByRole('button', { name: 'إعداد تقرير العملة PDF', exact: true }).click();
      await page.getByText('التقرير جاهز', { exact: true }).waitFor({ timeout: 60000 });
      assert.equal(await page.locator('.currency-pdf-render').count(), 0, 'Temporary export DOM is removed');
      assert.equal(await dialog.getByRole('button', { name: 'مشاركة PDF', exact: true }).count(), 0, 'Unsupported sharing keeps a usable download');
      for (const theme of ['light','dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
        assert(await dialog.locator('.currency-detail-footer').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Footer fits at narrow widths');
        assert(await dialog.locator('.currency-report-buttons > a').evaluate(element => element.getBoundingClientRect().height >= 44));
        await dialog.screenshot({ path:path.join(output,`currency-pdf-${theme}-${width}.png`) });
      }
      const downloadEvent = page.waitForEvent('download');
      await dialog.getByRole('link', { name:'تحميل PDF',exact:true }).click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /dinar-USD-official-\d{4}-\d{2}-\d{2}\.pdf/);
      const target=path.join(output,`official-${width}.pdf`); await download.saveAs(target);
      const content=await fs.readFile(target); assert.equal(content.subarray(0,5).toString(),'%PDF-'); assert(content.length>20000 && content.length<4*1024*1024);
      await page.evaluate(()=>{window.shareMode='success';window.reportFixture.refresh();});
      await dialog.getByRole('button',{name:'مشاركة PDF',exact:true}).click();
      await dialog.getByText('تمت مشاركة التقرير.',{exact:true}).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.shareCalls.map(call=>[call.type,call.active])),[['application/pdf',true]],'A prepared PDF is shared on a fresh user gesture');
      await page.evaluate(()=>window.shareMode='cancel');
      await dialog.getByRole('button',{name:'مشاركة PDF',exact:true}).click();
      await dialog.getByText('أُلغيت المشاركة؛ التقرير ما زال جاهزًا.',{exact:true}).waitFor();
      assert.equal(await dialog.getByRole('alert').count(),0,'Cancelling is not reported as a failure');
      await page.evaluate(()=>window.shareMode='error');
      await dialog.getByRole('button',{name:'مشاركة PDF',exact:true}).click();
      await dialog.getByRole('alert').waitFor();
      assert(await dialog.getByRole('link',{name:'تحميل PDF',exact:true}).isVisible(),'Native share failure retains the file');
      await dialog.locator('.currency-detail-close').click();
      await page.waitForFunction(()=>window.revokedUrls.length>0);
      assert.equal(await page.locator('.currency-pdf-render').count(),0);
      assert.deepEqual(errors,[]); assert.deepEqual(requests,[],'Export does not fetch prices or contact production APIs');
      await context.close();
    }
    const page=await browser.newPage({viewport:{width:1100,height:1250},serviceWorkers:'block'});
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());
    await page.route('https://flagcdn.com/**',route=>route.abort());
    for(const market of ['parallel','official']){
      await page.goto(base+'?report=1'+(market==='official'?'&official=1':''));
      await page.locator('.currency-pdf-page').first().waitFor();
      assert.equal(await page.locator('.currency-pdf-page').count(),3,'Overview plus paginated daily history');
      assert(await page.locator('.currency-pdf-body').evaluateAll(elements=>elements.every(e=>e.scrollHeight<=e.clientHeight+2)),'All content fits before the footer');
      assert.equal(await page.locator('tbody tr').count(),30,'No available day is dropped');
      assert.equal(await page.locator('.recharts-area-curve').count(),1,'Actual chart is present');
      for(let i=0;i<3;i++)await page.locator('.currency-pdf-page').nth(i).screenshot({path:path.join(output,`report-${market}-${i+1}.png`)});
    }
    await page.goto(base);
    await page.getByRole('dialog').waitFor();
    await page.evaluate(()=>window.reportFixture.all());
    await page.getByRole('button',{name:'إعداد تقرير العملة PDF',exact:true}).click();
    await page.getByText('التقرير جاهز',{exact:true}).waitFor({timeout:60000});
    const event=page.waitForEvent('download'); await page.getByRole('link',{name:'تحميل PDF',exact:true}).click();
    await (await event).saveAs(path.join(output,'parallel-full-report.pdf'));
    const previousUrl=await page.getByRole('link',{name:'تحميل PDF',exact:true}).getAttribute('href');
    await page.evaluate(()=>window.reportFixture.updatePrice(11.55));
    assert.equal(await page.getByRole('link',{name:'تحميل PDF',exact:true}).getAttribute('href'),previousUrl,'Live prices do not silently mutate a prepared report');
    await page.evaluate(()=>window.reportFixture.empty());
    await page.getByRole('button',{name:'إعداد تقرير العملة PDF',exact:true}).click();
    await page.getByText('التقرير جاهز',{exact:true}).waitFor({timeout:60000});
    const emptyEvent=page.waitForEvent('download');await page.getByRole('link',{name:'تحميل PDF',exact:true}).click();
    await (await emptyEvent).saveAs(path.join(output,'currency-no-history.pdf'));
    await page.evaluate(()=>window.reportFixture.updatePrice(NaN));
    assert(await page.getByRole('button',{name:'إعداد تقرير العملة PDF',exact:true}).isDisabled(),'Invalid current price cannot be exported');
    await page.evaluate(()=>window.reportFixture.updatePrice(10.3));
    await page.getByRole('button',{name:'إعداد تقرير العملة PDF',exact:true}).click();
    await page.locator('.currency-detail-close').click();
    await page.waitForFunction(()=>document.querySelectorAll('.currency-pdf-render').length===0);
    await page.close();
    console.log('Currency PDF UI: desktop/mobile, real PDF downloads, Arabic layout, chart, pagination, sharing/cancellation/fallback and cleanup passed. Artifacts: '+output);
  } finally { await browser?.close(); await vite.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
