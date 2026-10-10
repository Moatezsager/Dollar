const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const {Server} = require('socket.io');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const app = express();
  const rates = {parallel:{USD:9.7,EUR:10.2},official:{USD:6.4,EUR:7.1},previousParallel:{},previousOfficial:{},lastChanged:{parallel:{},official:{}},lastUpdated:new Date().toISOString()};
  app.use('/api', (req,res) => {
    const data = req.path === '/rates' ? rates : req.path === '/history' ? [] : req.path === '/config' ? {terms:[]} : {status:'active',count:1};
    res.json(data);
  });
  app.use(express.static(path.join(process.cwd(),'dist')));
  app.get('*',(_req,res)=>res.sendFile(path.join(process.cwd(),'dist/index.html')));
  const server=http.createServer(app),io=new Server(server);
  let browser;
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL});
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base ? route.continue() : route.abort());
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('hasSeenTour','true');
      localStorage.setItem('installPromptDismissed','true');
      localStorage.setItem('pushPromptDismissed_v4',Date.now().toString());
      localStorage.setItem('soundEnabled','false');
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:30000});
    const details=await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.ready;
      return {scope:registration.scope,url:registration.active?.scriptURL,state:registration.active?.state,
        push:!!registration.pushManager,subscription:await registration.pushManager.getSubscription(),caches:await caches.keys(),
        permission:Notification.permission,icons:await Promise.all(['/icon-192.png','/icons/badge-72.png'].map(async url=>(await fetch(url)).status))};
    });
    assert.equal(details.scope,base+'/');
    assert.equal(details.url,base+'/push-sw.js');
    assert.equal(details.state,'activated');assert(details.push);
    assert.equal(details.subscription,null,'Registration test must not subscribe a real device');
    assert.equal(details.permission,'default','No automatic permission prompt');
    assert.deepEqual(details.icons,[200,200]);
    assert(details.caches.some(name=>name.includes('precache')));
    assert.equal(context.serviceWorkers().length,1,'Use one unified service worker');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: actual production service-worker registration/activation, PushManager, unified scope, precache and notification assets; no permission or Push sends');
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>io.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
