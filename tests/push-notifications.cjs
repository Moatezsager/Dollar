const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');
const Database = require('better-sqlite3');
const {build} = require('esbuild');

async function bundle(contents, mocks = {}, platform = 'node', format = 'cjs') {
  const result = await build({stdin: {contents, resolveDir: process.cwd(), loader: 'ts'}, bundle: true,
    platform, format, packages: 'external', write: false,
    plugins: [{name: 'isolated-push', setup(plugin) {
      plugin.onResolve({filter: /.*/}, args => {
        const key = args.path.startsWith('.') ? path.basename(args.path) : args.path;
        if (mocks[key]) return {path: key, namespace: 'fixture'};
      });
      plugin.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: mocks[args.path], loader: 'js'}));
    }}]});
  return result.outputFiles[0].text;
}
function compile(source) {
  const isolated = new Module(path.join(process.cwd(), 'tests/push-isolated.cjs'), module);
  isolated.filename = isolated.id; isolated.paths = module.paths;
  isolated._compile(source, isolated.filename);
  return isolated.exports;
}
const pause = () => new Promise(resolve => setImmediate(resolve));
const keys = {p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url')};
const sub = id => ({endpoint: 'https://fcm.googleapis.com/fcm/send/fixture-' + id, keys});
const row = id => ({endpoint: sub(id).endpoint, ...keys});
const snapshot = (time, usd = 9, eur = 10) => ({parallel: {USD: usd, EUR: eur}, official: {USD: 6, EUR: 7}, lastUpdated: new Date(time).toISOString()});

async function main() {
  const realNow = Date.now, realFetch = global.fetch;
  let now = Date.parse('2026-10-10T10:00:00Z');
  Date.now = () => now;
  const db = new Database(':memory:');
  db.exec("CREATE TABLE server_config(key TEXT PRIMARY KEY, value TEXT); CREATE TABLE push_subscriptions(endpoint TEXT PRIMARY KEY,p256dh TEXT,auth TEXT,created_at TEXT,last_active TEXT)");
  let remote = [], remoteFailure = false, queries = 0, sends = [], active = 0, maxActive = 0;
  global.__pushTest = {
    db, config: {terms: []},
    supabase: {from(table) {
      assert.equal(table, 'push_subscriptions');
      let offset = 0, end = 999, operation = 'select', values, filters = [];
      const query = {
        select() {return query;}, order() {return query;}, range(a,b) {offset=a;end=b;return query;},
        upsert(data) {operation='upsert';values=data;return query;},
        delete() {operation='delete';return query;}, eq(key,value) {filters.push([key,value]);return query;},
        abortSignal(signal) {assert(signal);return query;},
        then(resolve,reject) {
          queries++;
          if (!remoteFailure) {
            if (operation==='upsert') remote=[...remote.filter(row=>row.endpoint!==values.endpoint),values];
            if (operation==='delete') remote=remote.filter(row=>!filters.every(([key,value])=>row[key]===value));
          }
          return Promise.resolve({data:remote.slice(offset,end+1),error:remoteFailure?{message:'fixture'}:null}).then(resolve,reject);
        },
      };
      return query;
    }},
    webpush: {
      generateVAPIDKeys: () => ({publicKey: keys.p256dh, privateKey: 'fixture'}),
      setVapidDetails() {},
      async sendNotification(subscription, message, options) {
        active++; maxActive=Math.max(active,maxActive);
        try {
          sends.push({subscription, data: JSON.parse(message), options});
          await pause();
          if (subscription.endpoint.endsWith('-expired')) throw {statusCode:410};
          if (subscription.endpoint.endsWith('-failed')) throw {statusCode:503};
        } finally {active--;}
      },
    },
  };
  const oldPublic=process.env.VAPID_PUBLIC_KEY, oldPrivate=process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
  let server;
  try {
    const web = compile(await bundle([
      "export * from './shared/notifications';",
      "export * from './server/services/push.service';",
      "export * from './server/middleware/auth';",
      "export {timeoutMiddleware} from './server/middleware/security';",
      "export {default as pushRouter} from './server/routes/push.routes';",
      "export {default as adminPushRouter} from './server/routes/admin/push.routes';",
    ].join('\n'), {
      db: "export const db=globalThis.__pushTest.db; export const supabase=globalThis.__pushTest.supabase; export const supabaseAnonKey='fixture';",
      config: 'export const appConfig=globalThis.__pushTest.config;',
      'web-push': 'export default globalThis.__pushTest.webpush;',
    }));
    assert.equal(web.priceChanges(snapshot(now),snapshot(now,9.049)).length,0);
    assert.equal(web.priceChanges(snapshot(now),snapshot(now,9.05,10.06)).length,2);
    assert.equal(web.priceChanges({parallel:{GOLD_CAST_24:1000},official:{},lastUpdated:''},{parallel:{GOLD_CAST_24:1004},official:{},lastUpdated:''}).length,0);
    assert.equal(web.isQuietTime(Date.parse('2026-10-10T20:00:00Z')),true);
    assert.equal(web.isQuietTime(Date.parse('2026-10-10T06:00:00Z')),false);
    assert.equal(web.safeNotificationUrl('https://evil.test/', 'https://app.test'),'https://app.test/');
    assert.equal(web.safeNotificationUrl('javascript:alert(1)', 'https://app.test'),'https://app.test/');
    assert.equal(web.safeNotificationUrl('/#rates-section', 'https://app.test'),'https://app.test/#rates-section');
    assert(web.validPushSubscription(sub('safe')));
    const timeouts=[];
    for (const requestPath of ['/api/rates', '/api/push/subscribe', '/api/admin/push/test']) {
      web.timeoutMiddleware({path:requestPath},{setTimeout:limit=>timeouts.push(limit)},()=>{});
    }
    assert.deepEqual(timeouts,[5000,15000,15000],'Push network budget must fit inside the HTTP timeout; other APIs stay unchanged');
    for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://user:pass@fcm.googleapis.com/a']) assert(!web.validPushSubscription({...sub('safe'),endpoint}));
    assert(web.validPushEndpoint('https://web.push.apple.com/fixture'));
    assert(web.validPushEndpoint('https://wns2.fixture.notify.windows.com/fixture'));
    assert(web.validPushEndpoint('https://updates.push.services.mozilla.com/fixture'));
    assert(!web.validPushSubscription({...sub('safe'),keys:{...keys,auth:'bad'}}));
    console.log('PASS: thresholds, quiet hours, safe URLs and subscription validation');

    const insert = data => db.prepare('INSERT OR REPLACE INTO push_subscriptions(endpoint,p256dh,auth) VALUES (?,?,?)').run(data.endpoint,data.p256dh,data.auth);
    insert(row('local'));
    assert.equal((await web.pushOverview()).subscribers,0,'Empty remote storage must not resurrect a local subscription');
    remoteFailure=true; web.invalidatePushSubscribers();
    assert.equal((await web.pushOverview()).subscribers,1);
    remoteFailure=false; remote=Array.from({length:1001},(_,index)=>row(index)); web.invalidatePushSubscribers();
    const before=queries;
    assert.equal((await web.pushOverview()).subscribers,1001);
    assert.equal(queries-before,2,'Paginate beyond the Supabase default limit');
    await web.pushOverview(); assert.equal(queries-before,2,'Subscriber count cache avoids database polling');
    remote=[...Array.from({length:18},(_,index)=>row(index)),row('expired'),row('failed')];
    remote.forEach(insert); web.invalidatePushSubscribers();
    const result=await web.sendPushNotificationToAll('fixture','fixture','/');
    assert.deepEqual(result,{total:20,sent:18,removed:1,failed:1});
    assert.equal(maxActive,10,'Bound concurrent Push requests');
    assert(!db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get(sub('expired').endpoint));
    assert(!remote.some(item=>item.endpoint===sub('expired').endpoint));
    assert(sends.every(item=>item.options.timeout===10000 && item.data.icon==='/icon-192.png'));
    console.log('PASS: authoritative remote subscriptions, paging/cache, bounded sends and expired cleanup');

    remote=[row('only')]; web.invalidatePushSubscribers(); sends=[];
    web.queueRatePush({parallel:{USD:0},official:{},lastUpdated:new Date(now).toISOString()});
    now++;web.queueRatePush(snapshot(now));
    await web.flushPricePush();
    assert.equal(sends.length,0,'Initial data load must not blast users');
    now++;web.queueRatePush(snapshot(now,9.1,10.1));
    now++;web.queueRatePush(snapshot(now,9.2,10.2));
    assert.equal(sends.length,0,'Price bursts wait for batching');
    await web.flushPricePush();
    assert.equal(sends.length,1,'One grouped summary for multiple price changes');
    assert(sends[0].data.body.includes('9.20') && sends[0].data.body.includes('10.20'));
    now++;web.queueRatePush(snapshot(now,9.3,10.3));await web.flushPricePush();
    assert.equal(sends.length,1,'Cooldown suppresses another summary');
    now+=31*60000;web.queueRatePush(snapshot(now,9.2,10.2));await web.flushPricePush();
    assert.equal(sends.length,1,'A reversed change must not produce a misleading notification');
    now++;web.queueRatePush(snapshot(now,9.4,10.4));await web.flushPricePush();assert.equal(sends.length,2);
    for(let index=0;index<7;index++){now+=31*60000;web.queueRatePush(snapshot(now,10+index,11+index));await web.flushPricePush();}
    assert.equal(sends.length,6,'No more than six price summaries in a day');
    now=Date.parse('2026-10-11T00:00:00Z');web.queueRatePush(snapshot(now,20,21));await web.flushPricePush();assert.equal(sends.length,6,'Quiet hours defer price summaries');
    now=Date.parse('2026-10-11T06:00:00Z');await web.flushPricePush();assert.equal(sends.length,7,'Latest prices resume after quiet hours');
    console.log('PASS: startup, grouped latest prices, reversal, cooldown, daily cap and quiet-hours resume');

    sends=[];
    const campaign=await web.startPushCampaign('إعلان','رسالة','/');
    while((await web.pushOverview()).sending)await pause();
    assert.equal(sends.length,1);
    await assert.rejects(web.startPushCampaign('إعلان','رسالة','/'),error=>error.status===429);
    assert.equal((await web.pushOverview()).history.find(item=>item.id===campaign.id).status,'completed');
    await web.sendPushTest(sub('test-device'),'اختبار','جهازي','/');
    assert.equal(sends.length,2);assert.equal(sends.at(-1).subscription.endpoint,sub('test-device').endpoint);
    now+=11*60000;await web.startPushCampaign('إعلان 2','رسالة 2','/');while((await web.pushOverview()).sending)await pause();
    now+=11*60000;await web.startPushCampaign('إعلان 3','رسالة 3','/');while((await web.pushOverview()).sending)await pause();
    now+=11*60000;await assert.rejects(web.startPushCampaign('إعلان 4','رسالة 4','/'),error=>error.status===429);
    console.log('PASS: manual duplicate/cooldown/daily limits and single-device test');

    const app=express();app.use(express.json());app.use('/api',web.pushRouter);
    web.setAdminToken('fixture-admin');app.use('/api/admin',web.requireAdmin,web.adminPushRouter);
    server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const post=(url,data,token)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
    assert.equal((await fetch(base+'/api/admin/push/status')).status,401);
    assert.equal((await post('/api/admin/push/send',{title:'x',body:'x'})).status,401);
    assert.equal((await post('/api/admin/push/test',{title:'x',body:'x',url:'https://evil.test'},'fixture-admin')).status,400);
    assert.equal((await post('/api/push/subscribe',{subscription:{...sub('x'),endpoint:'https://127.0.0.1/internal'}})).status,400);
    remoteFailure=true;
    assert.equal((await post('/api/push/subscribe',{subscription:sub('persist')})).status,503);
    assert(!db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get(sub('persist').endpoint));
    remoteFailure=false;
    assert.equal((await post('/api/push/subscribe',{subscription:sub('persist')})).status,200);
    assert.equal((await post('/api/push/unsubscribe',{endpoint:sub('persist').endpoint})).status,400);
    assert.equal((await post('/api/push/unsubscribe',{subscription:{...sub('persist'),keys:{...keys,auth:Buffer.alloc(16,3).toString('base64url')}}})).status,200);
    assert(db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get(sub('persist').endpoint),'Endpoint alone or wrong keys cannot delete another device');
    assert.equal((await post('/api/push/unsubscribe',{subscription:sub('persist')})).status,200);
    assert(!db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get(sub('persist').endpoint));
    const previousSends=sends.length;
    assert.equal((await post('/api/admin/push/test',{title:'اختبار',body:'جهاز واحد',subscription:sub('api-test')},'fixture-admin')).status,200);
    assert.equal(sends.length,previousSends+1);
    assert.equal(sends.at(-1).subscription.endpoint,sub('api-test').endpoint);
    console.log('PASS: admin authorization, safe destinations, persistence failures and unsubscribe capability');

    const saved=JSON.parse(db.prepare('SELECT value FROM server_config WHERE key=?').get('web_notification_state').value);
    saved.history[0].status='sending';
    db.prepare('UPDATE server_config SET value=? WHERE key=?').run(JSON.stringify(saved),'web_notification_state');
    const sendsBeforeRestart=sends.length;
    const restarted=compile(await bundle("export * from './server/services/push.service';",{
      db: "export const db=globalThis.__pushTest.db;export const supabase=globalThis.__pushTest.supabase;export const supabaseAnonKey='fixture';",
      config: 'export const appConfig=globalThis.__pushTest.config;',
      'web-push': 'export default globalThis.__pushTest.webpush;',
    }));
    assert.equal((await restarted.pushOverview()).history[0].status,'interrupted');
    assert.equal(sends.length,sendsBeforeRestart,'Never replay a partially sent campaign on restart');
    console.log('PASS: interrupted campaigns are reported without automatic duplicate replay');

    const events={},shown=[],origin='https://app.test';
    let navigated='',focused=0,opened='',badges=0;
    const publicWindow={url:origin+'/',async navigate(url){navigated=url;return this;},async focus(){focused++;}};
    const self={location:{origin},navigator:{async setAppBadge(){badges++;},async clearAppBadge(){}},
      registration:{async showNotification(title,options){shown.push({title,options});},async getNotifications(){return shown;}},
      clients:{async matchAll(){return [{url:origin+'/admin'},publicWindow];},async openWindow(url){opened=url;}},
      addEventListener(name,handler){events[name]=handler;},skipWaiting(){}};
    const noop="export class ExpirationPlugin{}; export class NavigationRoute{}; export class NetworkFirst{}; export class CacheFirst{}; export class StaleWhileRevalidate{}; export function registerRoute(){}; export function precacheAndRoute(){}; export function cleanupOutdatedCaches(){};";
    const worker=await bundle("import './public/push-sw.js';",Object.fromEntries(['workbox-precaching','workbox-routing','workbox-strategies','workbox-expiration'].map(name=>[name,noop])),'browser','iife');
    vm.runInNewContext(worker,{self,URL,Date,Intl,console});
    const dispatch=async(name,data)=>{let wait;events[name]({...data,waitUntil(promise){wait=promise;}});await wait;};
    await dispatch('push',{data:{json:()=>({kind:'rates',title:'أسعار',body:'ملخص',url:'https://evil.test'})}});
    assert.equal(shown.length,1);assert.equal(shown[0].options.renotify,false);
    assert.equal(shown[0].options.requireInteraction,false);assert(!('vibrate' in shown[0].options));
    assert.equal(shown[0].options.data.url,origin+'/');assert.equal(shown[0].options.icon,'/icon-192.png');
    await dispatch('push',{data:{json:()=>null}});assert.equal(shown.length,2);
    now=Date.parse('2026-10-11T20:00:00Z');
    await dispatch('push',{data:{json:()=>({kind:'announcement',body:'إعلان'})}});
    assert.equal(shown.at(-1).options.silent,true);
    await dispatch('notificationclick',{notification:{close(){},data:{url:'/#rates-section'}}});
    assert.equal(navigated,origin+'/#rates-section');assert.equal(focused,1);assert.equal(opened,'');assert(badges);
    console.log('PASS: one visible OS notification per push, safe click/focus, quiet mode and badges');

    const storage=new Map(),browser={matchMedia:()=>({matches:false}),isSecureContext:true,PushManager:class{}};
    let subscription,unsubscribes=0,subscribes=0,saves=0,saveOK=true;
    const makeSubscription=()=>({options:{applicationServerKey:Buffer.from(keys.p256dh,'base64url')},
      toJSON:()=>sub('client'),async unsubscribe(){unsubscribes++;subscription=null;return true;}});
    subscription=makeSubscription();
    const navigatorMock={userAgent:'desktop',platform:'Win32',maxTouchPoints:0,serviceWorker:{ready:Promise.resolve({
      pushManager:{async getSubscription(){return subscription;},async subscribe(){subscribes++;subscription=makeSubscription();return subscription;}},
    })}};
    const NotificationMock={permission:'granted',async requestPermission(){return this.permission;}};
    const clientCode=await bundle("export * from './src/utils/pushNotifications';",{
      storage:'export const safeStorage=globalThis.__browserStorage;',
    },'browser','cjs');
    const clientContext={exports:{},module:{exports:{}},window:browser,navigator:navigatorMock,Notification:NotificationMock,Uint8Array,Array,atob,AbortSignal,setTimeout,clearTimeout,
      __browserStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
      async fetch(url){
        if(url.endsWith('public-key'))return new Response(JSON.stringify({publicKey:keys.p256dh}));
        if(url.endsWith('subscribe'))saves++;
        return new Response(JSON.stringify({success:saveOK}),{status:saveOK?200:503});
      }};
    vm.runInNewContext(clientCode,clientContext);const client=clientContext.module.exports;
    await client.enablePush();assert.equal(subscribes,0);assert.equal(unsubscribes,0);assert.equal(storage.get('pushEnabled'),'true');
    storage.delete('pushEnabled');saveOK=false;
    await assert.rejects(client.enablePush());assert(!storage.has('pushEnabled'),'Do not claim success when persistence failed');
    saveOK=true;saves=0;await Promise.all([client.syncPushSubscription(),client.syncPushSubscription()]);assert.equal(saves,1,'StrictMode callers share one synchronization');
    saveOK=false;await assert.rejects(client.disablePush());
    assert.equal(storage.get('pushEnabled'),'false');assert.equal(subscription,null,'Local unsubscribe succeeds even if server cleanup fails');
    navigatorMock.userAgent='iPhone';assert.equal(client.pushSupport(),'install');
    console.log('PASS: reuse subscription, honest save failure, deduplicated sync, unsubscribe and iOS install requirement');
  } finally {
    global.fetch=realFetch;Date.now=realNow;
    if(oldPublic===undefined)delete process.env.VAPID_PUBLIC_KEY;else process.env.VAPID_PUBLIC_KEY=oldPublic;
    if(oldPrivate===undefined)delete process.env.VAPID_PRIVATE_KEY;else process.env.VAPID_PRIVATE_KEY=oldPrivate;
    if(server)await new Promise(resolve=>server.close(resolve));
    db.close();delete global.__pushTest;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
