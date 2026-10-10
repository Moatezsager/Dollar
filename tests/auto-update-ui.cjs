const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const {build} = require('esbuild');
const {Server} = require('socket.io');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function checkEngine() {
  const bundle = await build({entryPoints:['src/utils/autoUpdater.ts'],bundle:true,platform:'node',format:'cjs',write:false});
  const storage = () => {
    const values = new Map();
    return {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,String(value)),
      removeItem:key=>values.delete(key),clear:()=>values.clear()};
  };
  let now = 20000, reloads = 0, notices = 0;
  const timers = [], localStorage = storage(), sessionStorage = storage();
  const context = {module:{exports:{}},console:{log(){},warn(){}},localStorage,sessionStorage,
    Date:{now:()=>now},navigator:{},CustomEvent:class {constructor(type){this.type=type;}},
    window:{dispatchEvent:event=>{assert.equal(event.type,'dinar:update-available');notices++;},
      location:{reload:()=>reloads++}},setTimeout:(callback,delay)=>timers.push({callback,delay})};
  vm.runInNewContext(bundle.outputFiles[0].text,context);
  const updater = context.module.exports;
  assert.equal(await updater.processIncomingVersion('first'),false);
  let callbacks = 0;
  const unsubscribe = updater.onUpdateAvailable(()=>callbacks++);
  now += 11000;
  assert.equal(await updater.processIncomingVersion('second'),true);
  assert.equal(callbacks,1);assert.equal(notices,1);
  assert.equal(timers.length,0,'Banner owns the countdown; no competing 1.5-second reload');
  assert.equal(await updater.processIncomingVersion('second'),false);
  unsubscribe();now += 11000;
  localStorage.setItem('colorTheme','light');localStorage.setItem('lyd_rates','stale');
  assert.equal(await updater.processIncomingVersion('third'),true);
  assert.equal(callbacks,1,'Unsubscribe removes the listener');
  assert.equal(timers.length,1);assert.equal(timers[0].delay,1500);
  await timers[0].callback();
  assert.equal(reloads,1,'Pages without a banner still update automatically');
  assert.equal(localStorage.getItem('lyd_rates'),null);
  assert.equal(localStorage.getItem('colorTheme'),'light','Updating preserves preferences');
  console.log('PASS: countdown ownership, unsubscribe, fallback and preference preservation');
}

async function listen(server) {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return server.address().port;
}
async function checkUI() {
  const fixture = http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end('{}');});
  const io = new Server(fixture);
  const fixturePort = await listen(fixture);
  const reserve = http.createServer(), vitePort = await listen(reserve);
  await new Promise(resolve=>reserve.close(resolve));
  const vite = spawn(process.execPath,[path.join(process.cwd(),'node_modules/vite/bin/vite.js'),
    '--host','127.0.0.1','--port',String(vitePort),'--strictPort'],{
    cwd:process.cwd(),env:{...process.env,APP_URL:'http://127.0.0.1:'+fixturePort},stdio:'ignore',windowsHide:true});
  let browser;
  try {
    const base = 'http://127.0.0.1:'+vitePort;
    for(let attempt=0;;attempt++) {
      try {if((await fetch(base)).ok)break;}catch{}
      if(attempt>300)throw new Error('Isolated Vite startup failed');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    browser = await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL});
    const context = await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      for(const [key,value] of Object.entries({colorTheme:'dark',hasSeenTour:'true',tourCompleted:'true',
        installPromptDismissed:'true',soundEnabled:'false',pushPromptDismissed_v4:String(Date.now())}))localStorage.setItem(key,value);
    });
    await page.route('**/src/utils/autoUpdater.ts*',route=>route.fulfill({contentType:'application/javascript',body:
      'const listeners=new Set(); window.__updateTest={calls:0,notify(){listeners.forEach(cb=>cb(true,"fixture"));window.dispatchEvent(new CustomEvent("dinar:update-available"));}};' +
      'export function onUpdateAvailable(cb){listeners.add(cb);return()=>listeners.delete(cb);}' +
      'export async function purgeAllCachesAndReload(){window.__updateTest.calls++;await new Promise(()=>{});}' +
      'export const initAutoUpdater=()=>{};export const processIncomingVersion=async()=>false;' +
      'export const manualCachePurgeAndReload=purgeAllCachesAndReload;'}));
    await page.route('**/api/**',route=>{
      const endpoint = new URL(route.request().url()).pathname;
      const data = endpoint==='/api/rates'
        ? {parallel:{USD:9.7,EUR:10.2},official:{USD:6.4,EUR:7.1},previousParallel:{},previousOfficial:{},
          lastChanged:{parallel:{},official:{}},lastUpdated:new Date().toISOString()}
        : endpoint==='/api/config' ? {terms:[]} : endpoint==='/api/history'||endpoint==='/api/recent-changes' ? [] : {};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.clock.install({time:new Date('2026-10-10T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-10T12:00:00Z'));
    const notice = page.locator('.update-notice'), output = process.env.UI_SCREENSHOT_DIR;
    if(output)fs.mkdirSync(output,{recursive:true});
    const open = async()=>{
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>Boolean(window.__updateTest));
      await page.waitForFunction(()=>document.querySelector('.app-shell'));
      await page.evaluate(()=>window.__updateTest.notify());
      await notice.waitFor();
      await page.clock.runFor(100);
    };
    for(const [width,height] of [[1440,900],[768,900],[390,844],[320,640],[568,320]]) {
      await page.setViewportSize({width,height});await open();
      for(const theme of ['dark','light']) {
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        const layout = await notice.evaluate(element=>{
          const rect = element.getBoundingClientRect(), button = element.querySelector('.update-notice-primary');
          const close = element.querySelector('.update-notice-dismiss'), image = element.querySelector('img');
          const a = button.getBoundingClientRect(), b = element.querySelector('.update-notice-countdown').getBoundingClientRect();
          const nav = document.querySelector('#mobile-bottom-nav');
          return {x:rect.x,right:rect.right,top:rect.top,bottom:rect.bottom,
            height:rect.height,buttonHeight:a.height,closeHeight:close.getBoundingClientRect().height,
            overlap:Math.min(a.right,b.right)>Math.max(a.left,b.left),overflow:element.scrollWidth>element.clientWidth,
            imageLoaded:image.naturalWidth>0,navTop:nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:null,
            background:getComputedStyle(element).backgroundColor};
        });
        assert(layout.x>=0 && layout.right<=width && layout.top>=0 && layout.bottom<=height,'Notice fits viewport');
        assert(!layout.overflow && !layout.overlap,'Countdown and action never overlap');
        assert(layout.buttonHeight>=44 && layout.closeHeight>=44,'Touch targets are at least 44px');
        assert(layout.imageLoaded,'Real brand icon loads');
        if(width<768 && layout.navTop!==null)assert(layout.bottom<=layout.navTop-4,'Notice clears bottom navigation');
        assert.equal(layout.background,theme==='light'?'rgb(255, 255, 255)':'rgb(25, 30, 33)');
        if(output)await page.screenshot({path:path.join(output,'update-'+width+'-'+theme+'.png')});
      }
      assert.equal(await notice.locator('output').textContent(),'3');
      assert.equal(await notice.locator('output').getAttribute('aria-live'),'off','Countdown does not announce every second');
    }
    await page.setViewportSize({width:390,height:844});await open();
    await page.clock.runFor(1000);assert.equal(await notice.locator('output').textContent(),'2');
    await page.getByRole('button',{name:'إغلاق تنبيه التحديث',exact:true}).click();
    await page.clock.runFor(4000);
    assert.equal(await notice.count(),0);assert.equal(await page.evaluate(()=>window.__updateTest.calls),0);
    await page.evaluate(()=>window.__updateTest.notify());await notice.waitFor();
    assert.equal(await notice.locator('output').textContent(),'3','Dismissed notice restarts the countdown');
    await page.clock.runFor(2000);assert.equal(await page.evaluate(()=>window.__updateTest.calls),0);
    await page.clock.runFor(1000);
    await page.getByRole('heading',{name:'جارٍ تحديث الواجهة',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__updateTest.calls),1,'StrictMode must not update twice');
    await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>window.__updateTest.calls),1);
    assert(await page.getByRole('button',{name:'جارٍ التحديث',exact:true}).isDisabled());
    await open();await page.getByRole('button',{name:'تحديث الآن',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__updateTest.calls),1);
    await page.clock.runFor(4000);assert.equal(await page.evaluate(()=>window.__updateTest.calls),1);
    assert.deepEqual(errors,[]);
    console.log('PASS: five viewport sizes, both themes, brand asset, touch targets, close/reopen, manual/automatic update and StrictMode');
  } finally {
    if(browser)await browser.close();
    const stopped = new Promise(resolve=>vite.once('exit',resolve));vite.kill();await stopped;
    await new Promise(resolve=>io.close(resolve));
  }
}
(async()=>{await checkEngine();await checkUI();})().catch(error=>{console.error(error);process.exitCode=1;});
