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
  const fixture = http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end('{}');});
  const io = new Server(fixture);
  let socketToken;
  io.on('connection',socket=>{socketToken=socket.handshake.auth.token;});
  const fixturePort = await listen(fixture);
  const reserve = http.createServer();
  const vitePort = await listen(reserve);
  await new Promise(resolve=>reserve.close(resolve));
  const vite = spawn(process.execPath,[path.join(process.cwd(),'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(vitePort),'--strictPort'],{
    cwd:process.cwd(),env:{...process.env,APP_URL:`http://127.0.0.1:${fixturePort}`},stdio:'ignore',windowsHide:true,
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${vitePort}`;
    for (let i=0;;i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      if (i>300) throw new Error('Isolated Vite startup failed');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    browser=await chromium.launch({headless:true,channel:process.env.UI_BROWSER_CHANNEL});
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('colorTheme','dark');
      localStorage.setItem('hasSeenTour','true');
      localStorage.setItem('installPromptDismissed','true');
      localStorage.setItem('pushPromptDismissed_v4',Date.now().toString());
      localStorage.setItem('soundEnabled','false');
      const bytes = new Uint8Array(65); bytes[0] = 4; bytes.fill(1, 1);
      const p256dh = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const auth = btoa(String.fromCharCode(...new Uint8Array(16).fill(2))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      let subscribed = true;
      const subscription = {options:{applicationServerKey: bytes.buffer},
        toJSON: () => ({endpoint:'https://fcm.googleapis.com/fcm/send/fixture-browser',keys:{p256dh,auth}}),
        unsubscribe: async () => {subscribed=false; return true;}};
      Object.defineProperty(navigator.serviceWorker, 'ready', {value:Promise.resolve({pushManager:{
        getSubscription: async () => subscribed ? subscription : null,
        subscribe: async () => {subscribed=true;return subscription;},
      }})});
      Object.defineProperty(window, 'Notification', {value: {permission:'granted', requestPermission:async ()=>'granted'}});
    });
    let config = {channels:['fixture'],terms:[{id:'USD',name:'الدولار',flag:'us',regex:'(\\d+)',min:1,max:25}],telegramBotToken:'fixture-bot',telegramAdminChatId:'42',enableUserTracking:false};
    let messages=[
      {id:1,name:'أحمد',email:'ahmed@example.test',phone:'0912345678',message:'رسالة زائر أولى',created_at:'2026-10-10T12:00:00+02:00',status:'sent_to_telegram'},
      {id:2,name:'سارة',email:'sara@example.test',phone:'0923456789',message:'استفسار محفوظ مع تعذر التوصيل',created_at:'invalid',status:'telegram_failed'},
    ];
    let statsRequests=0, statusRequests=0, testRequests=0, saveFailure=false, messagesFailure=false;
    let pushSends=0, pushTests=0, pushSaveFailure=false;
    let pushHistory=[];
    await page.route('**/api/**',async route=>{
      const url=new URL(route.request().url());
      let status=200,data={success:true};
      if (url.pathname.startsWith('/api/admin/') && url.pathname!=='/api/admin/login'
        && route.request().headers().authorization!=='Bearer fixture-admin-token') {
        await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({success:false,message:'غير مصرح'})});
        return;
      }
      if (url.pathname==='/api/admin/login') {
        const password=route.request().postDataJSON().password;
        if(password==='fixture-password')data={success:true,token:'fixture-admin-token'};
        else {status=password==='fixture-rate-limit'?429:401;data={success:false,message:status===429?'محاولات كثيرة، حاول بعد قليل':'كلمة المرور غير صحيحة'};}
      } else if (url.pathname==='/api/rates') {
        data={parallel:{USD:9.7,EUR:10.2},official:{USD:6.4,EUR:7.1},previousParallel:{},previousOfficial:{},lastChanged:{official:{},parallel:{}},lastUpdated:new Date().toISOString()};
      } else if(url.pathname==='/api/history')data=[];
      else if(url.pathname==='/api/config')data={terms:config.terms};
      else if (url.pathname==='/api/admin/config') {
        if(route.request().method()==='POST') {
          if(saveFailure){status=500;data={success:false,message:'تعذر الحفظ التجريبي'};}
          else {config=route.request().postDataJSON();data={success:true};}
        } else data=config;
      } else if(url.pathname==='/api/admin/stats') {
        statsRequests++;
        data={onlineUsers:4,termsCount:1,channelsCount:1,dbConnected:true,lastRateUpdate:new Date().toISOString(),serverStartTime:new Date(Date.now()-3600000).toISOString(),memoryUsage:{heapUsed:50e6,heapTotal:100e6,rss:120e6},installs:{total:12,today:2},dbStats:{parallelRatesCount:100,officialRatesCount:20,errorLogsCount:2,priceChangesCount:5}};
      } else if(url.pathname==='/api/admin/messages') {
        if(messagesFailure){status=503;data={error:'تعذر تحميل الرسائل التجريبي'};}else data=messages;
      } else if(url.pathname.startsWith('/api/admin/messages/')) {
        const id=Number(url.pathname.split('/')[4]);
        if(route.request().method()==='PUT') messages=messages.map(message=>message.id===id?{...message,status:route.request().postDataJSON().status}:message);
        else messages=messages.filter(message=>message.id!==id);
      } else if(url.pathname==='/api/admin/telegram/bot-status') {
        statusRequests++;
        data={connected:true,bot:{username:'fixture_bot'},configuredAdminChatId:'42',detectedChatId:'43',detectedChatUser:'fixture user'};
      } else if(url.pathname.startsWith('/api/admin/telegram/test-')) {
        testRequests++;data={success:true,message:'تم التوصيل التجريبي'};
      } else if(url.pathname==='/api/admin/push/status') data={subscribers:12,sending:false,history:pushHistory};
      else if(url.pathname==='/api/admin/push/test') {
        assert(route.request().postDataJSON().subscription.endpoint.endsWith('fixture-browser'));
        pushTests++;data={success:true,message:'قبلت خدمة Push رسالة الاختبار لهذا الجهاز فقط.'};
      } else if(url.pathname==='/api/admin/push/send') {
        const content=route.request().postDataJSON();pushSends++;
        const campaign={...content,id:'fixture-campaign',kind:'announcement',createdAt:Date.now(),status:'completed',total:12,sent:10,failed:1,removed:1};
        pushHistory=[campaign];status=202;data={success:true,campaign};
      } else if(url.pathname==='/api/push/public-key') data={publicKey:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url')};
      else if(url.pathname==='/api/push/subscribe') {
        status=pushSaveFailure?503:200;data={success:!pushSaveFailure};
      } else if(url.pathname==='/api/recent-changes') data=[];
      else if(url.pathname==='/api/version') data={version:'fixture'};
      else if(url.pathname==='/api/admin/system-report') data={scope:'web',generated_at:new Date().toISOString(),system_health:{uptime_formatted:'ساعة',node_version:'fixture',memory_mb:{heap_used:50,rss:120}},database_status:{supabase:{connected:null,stats:null},sqlite:{connected:true,visitor_messages_count:2}},central_bank_status:{usd_official:null,eur_official:null},sources_directory:{telegram_channels:[{id:'@fixture'}]},network_stats:{active_websocket_connections:4}};
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    const output=process.env.UI_SCREENSHOT_DIR;
    if(output)fs.mkdirSync(output,{recursive:true});
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      const brand=page.getByRole('link',{name:'مؤشر الدينار، الرئيسية',exact:true});
      await brand.dblclick();
      assert.equal(new URL(page.url()).pathname,'/','Logo must not open admin accidentally');
      await page.getByRole('button',{name:'المزيد من الخيارات',exact:true}).click();
      const entry=page.getByRole('link',{name:'دخول الإدارة',exact:true});
      assert.equal(await entry.getAttribute('href'),'/admin');
      await entry.focus();await page.keyboard.press('Enter');
      await page.getByRole('heading',{name:'لوحة الإدارة',exact:true}).waitFor();
      assert.equal(new URL(page.url()).pathname,'/admin');
      assert.equal(await page.getByRole('heading',{name:'ملخص التشغيل'}).count(),0);
      assert.equal(await page.getByLabel('كلمة مرور الإدارة',{exact:true}).getAttribute('autocomplete'),'current-password');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(output)await page.screenshot({path:path.join(output,'admin-login-'+width+'.png'),fullPage:true});
    }
    await page.getByLabel('كلمة مرور الإدارة',{exact:true}).fill('wrong-password');
    await page.getByRole('button',{name:'إظهار كلمة المرور',exact:true}).click();
    assert.equal(await page.getByLabel('كلمة مرور الإدارة',{exact:true}).getAttribute('type'),'text');
    await page.getByRole('button',{name:'إخفاء كلمة المرور',exact:true}).click();
    assert.equal(await page.getByLabel('كلمة مرور الإدارة',{exact:true}).getAttribute('type'),'password');
    await page.getByRole('button',{name:'فتح لوحة التحكم',exact:true}).click();
    await page.getByRole('alert').getByText('كلمة المرور غير صحيحة',{exact:true}).waitFor();
    await page.getByLabel('كلمة مرور الإدارة',{exact:true}).fill('fixture-rate-limit');
    await page.getByRole('button',{name:'فتح لوحة التحكم',exact:true}).click();
    await page.getByRole('alert').getByText('محاولات كثيرة، حاول بعد قليل',{exact:true}).waitFor();
    await page.evaluate(()=>{localStorage.setItem('adminToken','invalid-token');localStorage.setItem('admin_device_token','authorized_device_token_xyz');});
    await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
    await page.getByLabel('كلمة مرور الإدارة',{exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'ملخص التشغيل'}).count(),0,'Storage flags are not authorization');
    await page.goto(base+'/setup-device-auth-8899',{waitUntil:'domcontentloaded'});
    await page.waitForURL(base+'/admin');
    await page.getByLabel('كلمة مرور الإدارة',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('admin_device_token')),null);
    await page.getByLabel('كلمة مرور الإدارة',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'فتح لوحة التحكم',exact:true}).click();
    await page.getByRole('heading',{name:'ملخص التشغيل'}).waitFor();
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/admin-panel-secure',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'ملخص التشغيل'}).waitFor();
    assert(!await page.getByText('NODE_PROD_1').count());
    assert(!await page.getByText('System Ready').count());
    await page.waitForTimeout(500);
    assert.equal(socketToken,'fixture-admin-token');
    const navigate=async label=>{
      if(await page.locator('.admin-sidebar').isVisible()) await page.locator('.admin-sidebar').getByRole('button',{name:label,exact:true}).click();
      else {
        await page.getByRole('button',{name:'فتح قائمة الإدارة',exact:true}).click();
        await page.getByRole('dialog',{name:'قائمة الإدارة'}).getByRole('button',{name:label,exact:true}).click();
      }
    };
    const capture=async name=>{if(output)await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});};
    const checkLayout=async()=>{
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page horizontal overflow');
      const header=await page.locator('.admin-header').boundingBox();
      const main=await page.locator('.admin-content').boundingBox();
      assert(main.y>=header.y+header.height-1,'Header must not cover content');
      const width = page.viewportSize().width;
      assert.equal(await page.getByRole('button',{name:'فتح قائمة الإدارة',exact:true}).isVisible(), width < 1024);
      assert.equal(await page.locator('.admin-header-actions .admin-connection').isVisible(), width >= 768);
    };
    await checkLayout();await capture('admin-desktop-dark');
    await navigate('إشعارات المستخدمين');
    await page.getByText('جهاز مشترك',{exact:true}).waitFor();
    await page.getByLabel('العنوان',{exact:true}).fill('تحديث مهم للأسعار');
    await page.getByLabel('نص الإشعار',{exact:true}).fill('اطّلع على أحدث أسعار الدولار واليورو في مؤشر الدينار.');
    await page.getByLabel('الوجهة عند فتح الإشعار').selectOption('/#rates-section');
    assert.equal(await page.getByLabel('معاينة الإشعار').getByRole('heading',{name:'تحديث مهم للأسعار'}).count(),1);
    await page.getByRole('button',{name:'اختبار على جهازي',exact:true}).click();
    await page.getByRole('status').getByText('قبلت خدمة Push رسالة الاختبار لهذا الجهاز فقط.',{exact:true}).waitFor();
    assert.equal(pushTests,1);assert.equal(pushSends,0);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'إرسال للمشتركين',exact:true}).click();
    assert.equal(pushSends,0,'Cancel never sends a campaign');
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'إرسال للمشتركين',exact:true}).click();
    await page.getByText('قبلتها الخدمة 10',{exact:true}).waitFor();
    assert.equal(pushSends,1);
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});await checkLayout();
      const fields=await page.locator('.admin-push-fields').boundingBox();
      const preview=await page.locator('.admin-push-preview-area').boundingBox();
      if(width<768)assert(preview.y>=fields.y+fields.height,'Mobile preview must follow composer');
      assert(await page.getByLabel('معاينة الإشعار').locator('img').evaluate(img=>img.complete && img.naturalWidth>0));
      await capture('admin-push-'+width+'-dark');
      await page.getByRole('button',{name:'الوضع الفاتح',exact:true}).click();
      await capture('admin-push-'+width+'-light');
      await page.getByRole('button',{name:'الوضع الفاتح',exact:true}).click();
    }
    await page.setViewportSize({width:1440,height:1000});
    await navigate('البوت والتنبيهات');
    await page.getByText('متصل بـ Telegram',{exact:false}).waitFor();
    await page.getByLabel('توكن البوت',{exact:true}).fill('fixture-new-bot');
    assert(await page.getByRole('button',{name:'فحص الاتصال',exact:true}).isDisabled());
    saveFailure=true;
    await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
    await page.getByRole('alert').getByText('تعذر الحفظ التجريبي',{exact:true}).waitFor();
    assert(await page.getByRole('button',{name:'فحص الاتصال',exact:true}).isDisabled(),'Failed save retains draft');
    await page.getByRole('button',{name:'تحديث بيانات اللوحة',exact:true}).click();
    await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).waitFor();
    assert.equal(await page.getByLabel('توكن البوت',{exact:true}).inputValue(),'fixture-new-bot','Refreshing must not discard unsaved settings');
    saveFailure=false;
    await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
    await page.getByRole('button',{name:'فحص الاتصال',exact:true}).waitFor();
    await page.getByRole('button',{name:'فحص الاتصال',exact:true}).click();
    await page.getByRole('button',{name:'إرسال رسالة اتصال تجريبية',exact:true}).click();
    await page.getByText('تم التوصيل في آخر اختبار',{exact:true}).waitFor();
    assert.equal(testRequests,1);
    await page.getByText('تم التوصيل التجريبي',{exact:true}).waitFor({state:'hidden'});
    await capture('admin-bot-desktop');
    await navigate('رسائل الزوار');
    await page.getByRole('heading',{name:'أحمد',exact:true}).waitFor();
    assert(!(await page.locator('.admin-message').first().innerText()).includes('تاريخ غير متاح'),'Timezone offsets are valid dates');
    assert.equal(await page.getByRole('link',{name:'WhatsApp',exact:true}).first().getAttribute('href'),'https://wa.me/218912345678');
    await page.getByLabel('تصفية الرسائل').selectOption('telegram_failed');
    assert.equal(await page.locator('.admin-message').count(),1);
    await page.getByLabel('تصفية الرسائل').selectOption('all');
    await page.getByLabel('حالة رسالة أحمد').selectOption('read');
    assert.equal(messages[0].status,'read');
    messagesFailure=true;
    await page.getByRole('button',{name:'تحديث الرسائل',exact:true}).click();
    await page.getByRole('alert').getByText('تعذر تحميل الرسائل التجريبي',{exact:true}).waitFor();
    assert.equal(await page.locator('.admin-message').count(),2,'Failed refresh preserves inbox');
    messagesFailure=false;
    await capture('admin-messages-desktop');
    for(const width of [320,390,768,1024]){
      await page.setViewportSize({width,height:900});
      await checkLayout();
      if(width<1024){
        assert(await page.locator('.admin-bottom-nav').isVisible());
        await page.locator('.admin-bottom-nav').getByRole('button',{name:'البوت',exact:true}).click();
      }else await navigate('البوت والتنبيهات');
      await checkLayout();await capture('admin-bot-'+width+'-dark');
      await page.getByRole('button',{name:'الوضع الفاتح',exact:true}).click();
      await capture('admin-bot-'+width+'-light');
      await page.getByRole('button',{name:'الوضع الفاتح',exact:true}).click();
      if(width<1024){
        await page.getByRole('button',{name:'فتح قائمة الإدارة',exact:true}).click();
        await page.getByRole('dialog',{name:'قائمة الإدارة'}).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog',{name:'قائمة الإدارة'}).waitFor({state:'hidden'});
      }
    }
    await navigate('تقرير Web');
    await page.getByRole('heading',{name:'تقرير خدمة Web',exact:true}).waitFor();
    assert.equal(await page.getByText('4.8500 د.ل',{exact:true}).count(),0);
    await capture('admin-report');
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'المزيد من الخيارات',exact:true}).click();
    await page.locator('#notification-settings-btn').click();
    await page.getByRole('tab',{name:'التنبيهات',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'الإعدادات',exact:true});
    await settings.getByText('مفعّلة على هذا الجهاز',{exact:true}).waitFor();
    await settings.getByRole('button',{name:'إيقاف',exact:true}).click();
    await settings.getByRole('button',{name:'تفعيل',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('pushEnabled')),'false');
    pushSaveFailure=true;
    await settings.getByRole('button',{name:'تفعيل',exact:true}).click();
    await settings.getByRole('alert').waitFor();
    assert.equal(await settings.getByText('مفعّلة على هذا الجهاز',{exact:true}).count(),0,'Failed save is not a successful activation');
    pushSaveFailure=false;
    await settings.getByRole('button',{name:'تفعيل',exact:true}).click();
    await settings.getByText('مفعّلة على هذا الجهاز',{exact:true}).waitFor();
    await settings.getByRole('switch',{name:'تنبيهات داخل الموقع',exact:true}).click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('inAppNotifications')),'false');
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:900});
      assert(await settings.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      await capture('notification-settings-'+width);
    }
    await settings.getByRole('button',{name:'تم',exact:true}).click();
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: admin entry/session validation, responsive themes, drafts, bot, inbox, Push preview/test/confirmation/history and settings persistence/failure');
    console.log(`Fixture requests: stats=${statsRequests}, bot-status=${statusRequests}, test-messages=${testRequests}; no production services used.`);
  } finally {
    if(browser)await browser.close();
    vite.kill();
    await new Promise(resolve=>io.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
