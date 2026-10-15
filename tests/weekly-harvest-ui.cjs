const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const vite = await createServer({ configFile: false, plugins: [react(), tailwind()], resolve: { dedupe: ['react','react-dom'] },
    cacheDir: path.join(require('node:os').tmpdir(), 'harvest-vite-cache'), optimizeDeps: { entries: [], include: ['react','react-dom/client','react/jsx-dev-runtime'] }, server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  vite.middlewares.use('/__harvest', async (_req, res) => {
    const html = await vite.transformIndexHtml('/__harvest', `<!doctype html><html dir="rtl" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px">${process.argv.includes('--preview') ? '<aside style="padding:12px;text-align:center;background:#e6f2ed;color:#17452f">معاينة التصميم ببيانات اختبارية</aside>' : ''}<div id="root" class="app-shell"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {AdminWeeklyHarvest} from '/src/components/AdminWeeklyHarvest.tsx'; import {buildWeeklyHarvest} from '/shared/weeklyHarvest.ts'; import '/src/index.css';
      const parallel=[],official=[],metals=[];
      for(let d=8;d<=14;d++) { const recorded_at='2026-10-'+String(d).padStart(2,'0')+'T10:00:00Z'; parallel.push({recorded_at,rates:{USD:10+(d-8)*.02,USD_CHECKS:12+(d-8)*.02,EUR:11.2-(d-8)*.01,GBP:12.6,TND:3.3,EGP:.2045,USD_TR:10.1,USD_AE:10.2,USD_CN:10.3}}); official.push({recorded_at,rates:{USD:6.4404+(d-8)*.0001,EUR:7.1}}); metals.push({recorded_at,rates:{GOLD_SCRAP_18:800+d,GOLD_SCRAP_21:900+d,GOLD_CAST_24:1000+d,GOLD_LIRA_8G:7000+d,SILVER_CAST_1000:12.5}}); }
      window.fixtureData=buildWeeklyHarvest(parallel,official,metals,new Date('2026-10-15T12:00:00Z'));
      const fetchOriginal=window.fetch; window.fetch=(url,opts)=>{
        if(String(url).includes('/weekly-harvest/data'))return Promise.resolve(new Response(JSON.stringify({success:true,...window.fixtureData})));
        if(String(url).includes('/weekly-harvest/send-telegram')){window.sentHarvest=JSON.parse(opts.body);return Promise.resolve(new Response(JSON.stringify({success:true})));}
        return fetchOriginal(url,opts);
      };
      createRoot(document.getElementById('root')).render(React.createElement(AdminWeeklyHarvest,{token:'fixture',config:{telegramPostChannel:'fixture-channel'},setError:()=>{},setSuccess:()=>{}}));
    </script></body></html>`);
    res.setHeader('Content-Security-Policy', "connect-src 'self' ws://127.0.0.1:* https://*.googleapis.com https://*.google.com https://*.gstatic.com; img-src 'self' data:");
    res.setHeader('Content-Type','text/html'); res.end(html);
  });
  await vite.listen();
  const base='http://127.0.0.1:'+vite.httpServer.address().port, out=path.join(require('node:os').tmpdir(),'Dollar-weekly-harvest'); await fs.mkdir(out,{recursive:true});
  if (process.argv.includes('--preview')) { console.log('Weekly harvest preview (sample data): '+base+'/__harvest'); return; }
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL||'msedge'});
    for(const width of [390,1440]) {
      const context=await browser.newContext({...width<700?devices['Pixel 7']:{},viewport:{width,height:1000},acceptDownloads:true,serviceWorkers:'block'}); const page=await context.newPage(); const errors=[];
      await page.addInitScript(mobile=>{
        window.shareCalls=[];window.revokedUrls=[];window.policyViolations=[];
        document.addEventListener('securitypolicyviolation',event=>window.policyViolations.push(event.blockedURI));
        const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revokedUrls.push(url);revoke(url);};
        Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>mobile&&files?.length===1&&files[0].type==='image/png'&&files[0].size>0});
        Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
          if(!navigator.userActivation.isActive)return Promise.reject(new DOMException('User activation required','NotAllowedError'));
          window.shareCalls.push({name:data.files[0].name,type:data.files[0].type,size:data.files[0].size});
          return window.shareFailure?Promise.reject(new DOMException('Fixture failure',window.shareFailure)):Promise.resolve();
        }});
      },width<700);
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>route.request().url().startsWith(base)||route.request().url().startsWith('blob:'+base)||route.request().url().startsWith('data:')?route.continue():route.abort());
      await page.goto(base+'/__harvest', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.locator('#weekly-harvest-card tbody tr').first().waitFor({ timeout: 90000 });
      await page.waitForFunction(()=>document.querySelector('.harvest-preview').getBoundingClientRect().height>200);
      assert.equal(await page.locator('#weekly-harvest-card').getByText('الدولار الرسمي',{exact:true}).count(),0);
      assert.equal(await page.locator('.harvest-highlights [data-currency=USD_CHECKS]').count(),1);
      assert.equal(await page.locator('.harvest-highlights>div').count(),3);
      assert.equal(await page.locator('.harvest-socials a').first().getAttribute('href'),'https://t.me/libya_index_dollar');
      assert.equal(await page.locator('.harvest-socials a').last().getAttribute('href'),'https://www.facebook.com/profile.php?id=61593953519936');
      assert(await page.evaluate(()=>{const paper=document.querySelector('#weekly-harvest-card').getBoundingClientRect(); return [...document.querySelectorAll('.harvest-follow a, .harvest-footer-line, .harvest-highlights>div')].every(node=>{const r=node.getBoundingClientRect();return r.left>=paper.left-1&&r.right<=paper.right+1&&r.bottom<=paper.bottom+1;});}),'Highlights and follow links fit the exported image');
      for(const theme of ['light','dark']) {
        await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
        await page.screenshot({path:path.join(out,`preview-${width}-${theme}.png`),fullPage:true});
      }
      const downloadPromise=page.waitForEvent('download',{timeout:10000}); await page.getByRole('button',{name:'تحميل الصورة',exact:true}).click(); const download=await downloadPromise;
      const file=path.join(out,`bulletin-${width}.png`); await download.saveAs(file); const png=await fs.readFile(file); assert.equal(png.readUInt32BE(16),1080); assert(png.length>30000);
      assert.equal(download.suggestedFilename(),'weekly-harvest-2026-10-08.png');
      const save=page.getByRole('link',{name:'حفظ ملف الصورة',exact:true}), savedUrl=await save.getAttribute('href');
      assert(savedUrl.startsWith('blob:'));
      const retry=page.waitForEvent('download');await save.click();assert.equal((await retry).suggestedFilename(),download.suggestedFilename());
      if(width<700){
        const share=page.getByRole('button',{name:'مشاركة الصورة',exact:true});await share.click();
        await page.getByText('تم فتح خيارات مشاركة الصورة.',{exact:true}).waitFor();
        assert.equal((await page.evaluate(()=>window.shareCalls))[0].name,download.suggestedFilename());
        await page.evaluate(()=>window.shareFailure='AbortError');await share.click();
        await page.getByText('أُلغيت المشاركة؛ الصورة ما زالت جاهزة للحفظ.',{exact:true}).waitFor();
        assert.equal(await page.getByRole('alert').count(),0);
        await page.evaluate(()=>window.shareFailure='NotAllowedError');await share.click();
        await page.getByRole('alert').filter({hasText:'تعذرت المشاركة'}).waitFor();
        assert(await save.isVisible(),'Keep the file available when sharing is denied');
      }else assert.equal(await page.getByRole('button',{name:'مشاركة الصورة',exact:true}).count(),0);
      const openImage=page.waitForEvent('popup');await page.getByRole('link',{name:'فتح الصورة',exact:true}).click();const imagePage=await openImage;
      await imagePage.waitForLoadState('load');assert.equal(imagePage.url(),savedUrl);assert(await imagePage.locator('img').evaluate(image=>image.complete&&image.naturalWidth===1080));await imagePage.close();
      await page.getByRole('button',{name:'إرسال للإدارة',exact:true}).click();await page.getByText('أُرسلت المعاينة إلى محادثة الإدارة.',{exact:true}).waitFor();
      const payload=await page.evaluate(()=>window.sentHarvest);assert(payload.imageBase64.startsWith('data:image/png;base64,iVBOR'));assert(payload.caption.length<=1024);
      assert.deepEqual(await page.evaluate(()=>window.policyViolations),[],'The export must respect production CSP without fetching data URLs');
      await page.screenshot({path:path.join(out,`save-${width}.png`),fullPage:true});
      await page.getByRole('button',{name:'تحرير النشرة',exact:true}).click();
      await page.getByLabel('آخر رصد دولار كاش',{exact:true}).fill('20');
      assert.equal(await page.getByRole('region',{name:'خيارات حفظ الصورة'}).count(),0,'Discard the generated file after editing');
      await page.waitForFunction(url=>window.revokedUrls.includes(url),savedUrl);
      assert(await page.getByRole('button',{name:'تحميل الصورة',exact:true}).isDisabled());
      await page.getByLabel('آخر رصد دولار كاش',{exact:true}).fill('10.10');
      assert(await page.getByRole('button',{name:'تحميل الصورة',exact:true}).isEnabled());
      await page.getByRole('checkbox',{name:'جنيه إسترليني',exact:true}).uncheck();
      assert.equal(await page.locator('#weekly-harvest-card').getByText('جنيه إسترليني',{exact:true}).count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(out,`editor-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]); await context.close();
    }
    console.log('PASS: responsive preview, CSP-safe 1080px PNG with Android touch, Blob download/open, native share/cancel/denial, upload encoding and stale-file cleanup. Screenshots: '+out);
  } finally {await browser?.close(); await vite.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
