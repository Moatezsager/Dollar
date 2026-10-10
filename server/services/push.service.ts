import webpush from 'web-push';
import crypto from 'crypto';
import { appConfig } from '../config';
import { PriceSnapshot, priceChanges, priceDigest, tripoliTime, isQuietTime, RATE_PUSH_INTERVAL, RATE_PUSH_BATCH_DELAY, NOTIFICATION_ICON, NOTIFICATION_BADGE } from '../../shared/notifications';
import { db, supabase, supabaseAnonKey } from '../db';

// VAPID Keys setup
export let vapidKeys = { publicKey: '', privateKey: '' };

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
  };
  console.log('[Push] Using VAPID keys from environment variables (stable).');
} else {
  // Fallback: read from SQLite (local development)
  const storedKeys = db.prepare('SELECT value FROM server_config WHERE key = ?').get('vapid_keys') as any;
  if (storedKeys) {
    try {
      vapidKeys = JSON.parse(storedKeys.value);
      console.log('[Push] Using VAPID keys from SQLite (local dev).');
    } catch {
      vapidKeys = webpush.generateVAPIDKeys();
      db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run('vapid_keys', JSON.stringify(vapidKeys));
    }
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    db.prepare('INSERT INTO server_config (key, value) VALUES (?, ?)').run('vapid_keys', JSON.stringify(vapidKeys));
    console.log('[Push] Generated new VAPID keys and saved to SQLite.');
    console.warn('[Push] WARNING: Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to Render env vars to make them permanent!');
    console.warn('[Push] PUBLIC_KEY=' + vapidKeys.publicKey);
  }
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:admin@dinar-index.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('[Push] VAPID public key:', vapidKeys.publicKey.substring(0, 20) + '...');
}

type SubscriptionRow = {endpoint: string; p256dh: string; auth: string};
type PushResult = {total: number; sent: number; failed: number; removed: number};
type PushRecord = PushResult & {id: string; kind: 'rates' | 'announcement'; title: string; body: string; url: string; createdAt: number; status: 'sending' | 'completed' | 'failed' | 'interrupted'; fingerprint?: string};
type PushState = {history: PushRecord[]; rateSentAt: number; rateDay: string; rateCount: number};
const STATE_KEY = 'web_notification_state';
let state: PushState = {history: [], rateSentAt: 0, rateDay: '', rateCount: 0};
try {
  const row = db.prepare('SELECT value FROM server_config WHERE key = ?').get(STATE_KEY) as any;
  if (row) state = {...state, ...JSON.parse(row.value)};
} catch { console.warn('[Push] Notification state could not be read.'); }
state.history = Array.isArray(state.history) ? state.history.slice(0, 20).map(record => record.status === 'sending' ? {...record, status: 'interrupted'} : record) : [];
function saveState() {
  db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run(STATE_KEY, JSON.stringify(state));
}
if (state.history.some(record => record.status === 'interrupted')) saveState();

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const hosts = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.microsoft.com', 'push.apple.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}
export function validPushSubscription(value: any): boolean {
  if (!value || !validPushEndpoint(value.endpoint) || typeof value.keys?.p256dh !== 'string' || typeof value.keys?.auth !== 'string') return false;
  if (!/^[A-Za-z0-9_-]{86,88}={0,2}$/.test(value.keys.p256dh) || !/^[A-Za-z0-9_-]{22,24}={0,2}$/.test(value.keys.auth)) return false;
  const key = Buffer.from(value.keys.p256dh, 'base64url');
  return key.length === 65 && key[0] === 4 && Buffer.from(value.keys.auth, 'base64url').length === 16;
}

let cachedSubscriptions: SubscriptionRow[] | null = null;
let cacheUntil = 0;
export function invalidatePushSubscribers() { cachedSubscriptions = null; cacheUntil = 0; }
async function subscriptions(): Promise<SubscriptionRow[]> {
  if (cachedSubscriptions && Date.now() < cacheUntil) return cachedSubscriptions;
  let rows: SubscriptionRow[] | null = null;
  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    try {
      rows = [];
      const deadline = Date.now() + 12000;
      for (let offset = 0; ; offset += 1000) {
        if (Date.now() >= deadline) throw new Error('Subscription read budget exceeded');
        const {data, error} = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth').order('endpoint').range(offset, offset + 999).abortSignal(AbortSignal.timeout(Math.min(10000, deadline - Date.now())));
        if (error || !Array.isArray(data)) throw new Error('Subscription read failed');
        rows.push(...data);
        if (data.length < 1000) break;
      }
    } catch { rows = null; console.warn('[Push] Using local subscription storage after remote read failed.'); }
  }
  if (rows === null) rows = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all() as SubscriptionRow[];
  cachedSubscriptions = [...new Map(rows.filter(row => validPushSubscription({endpoint: row.endpoint, keys: row})).map(row => [row.endpoint, row])).values()];
  cacheUntil = Date.now() + 60000;
  return cachedSubscriptions;
}
async function removeExpired(endpoint: string) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  invalidatePushSubscribers();
  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    const {error} = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).abortSignal(AbortSignal.timeout(10000));
    if (error) console.warn('[Push] Expired remote subscription cleanup failed.');
  }
}

function payload(title: string, body: string, url: string, kind: 'rates' | 'announcement' | 'test', id: string) {
  return JSON.stringify({id, kind, title, body, url, sentAt: Date.now(), icon: NOTIFICATION_ICON, badge: NOTIFICATION_BADGE,
    tag: kind === 'rates' ? 'dinar-rates-digest' : 'dinar-' + kind, silent: isQuietTime()});
}
export async function sendPushNotificationToAll(title: string, body: string, url = '/', kind: 'rates' | 'announcement' = 'announcement', id = crypto.randomUUID()): Promise<PushResult> {
  const targets = await subscriptions();
  const result = {total: targets.length, sent: 0, failed: 0, removed: 0};
  const message = payload(title, body, url, kind, id);
  for (let offset = 0; offset < targets.length; offset += 10) {
    await Promise.all(targets.slice(offset, offset + 10).map(async row => {
      try {
        await webpush.sendNotification({endpoint: row.endpoint, keys: {p256dh: row.p256dh, auth: row.auth}}, message,
          {TTL: kind === 'rates' ? 3600 : 21600, urgency: 'normal', topic: kind === 'rates' ? 'dinar-rates-digest' : id.replace(/-/g, '').slice(0, 32), timeout: 10000});
        result.sent++;
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          result.removed++;
          try { await removeExpired(row.endpoint); } catch { console.warn('[Push] Expired subscription cleanup failed.'); }
        } else { result.failed++; console.warn('[Push] Delivery rejected:', error.statusCode || 'network'); }
      }
    }));
  }
  return result;
}
export async function sendPushTest(subscription: any, title: string, body: string, url: string) {
  if (!validPushSubscription(subscription)) throw new Error('اشتراك الجهاز غير صالح.');
  await webpush.sendNotification(subscription, payload(title, body, url, 'test', crypto.randomUUID()), {TTL: 300, urgency: 'normal', timeout: 10000});
}

let sending = false;
function newRecord(title: string, body: string, url: string, kind: PushRecord['kind'], fingerprint?: string): PushRecord {
  const record: PushRecord = {id: crypto.randomUUID(), kind, title, body, url, fingerprint, createdAt: Date.now(), status: 'sending', total: 0, sent: 0, failed: 0, removed: 0};
  state.history = [record, ...state.history].slice(0, 20);
  saveState();
  return record;
}
async function deliver(record: PushRecord) {
  try {
    Object.assign(record, await sendPushNotificationToAll(record.title, record.body, record.url, record.kind, record.id));
    record.status = record.failed > 0 && record.sent === 0 ? 'failed' : 'completed';
  } catch { record.status = 'failed'; }
  finally { sending = false; saveState(); }
  return record;
}
export async function pushOverview() {
  return {subscribers: (await subscriptions()).length, history: state.history, sending,
    policy: {batchSeconds: RATE_PUSH_BATCH_DELAY / 1000, intervalMinutes: RATE_PUSH_INTERVAL / 60000, maxRateDaily: 6, quietStart: 22, quietEnd: 8, priceThreshold: 0.05}};
}
export async function startPushCampaign(title: string, body: string, url: string) {
  if (sending) throw Object.assign(new Error('هناك إرسال جارٍ. انتظر اكتماله.'), {status: 409});
  const now = Date.now(), fingerprint = crypto.createHash('sha256').update(JSON.stringify({title, body, url})).digest('hex');
  const recent = state.history.filter(record => record.kind === 'announcement' && record.status !== 'failed');
  if (recent.some(record => record.fingerprint === fingerprint && now - record.createdAt < 15 * 60000)) throw Object.assign(new Error('أُرسلت هذه الرسالة مؤخرًا. لا حاجة لتكرارها.'), {status: 429});
  if (recent.some(record => now - record.createdAt < 10 * 60000) || recent.filter(record => tripoliTime(record.createdAt).day === tripoliTime(now).day).length >= 3) throw Object.assign(new Error('حفاظًا على راحة المشتركين، انتظر قبل إرسال رسالة أخرى. الحد اليومي 3 رسائل.'), {status: 429});
  sending = true;
  try {
    if (!(await subscriptions()).length) throw Object.assign(new Error('لا توجد أجهزة مشتركة حاليًا.'), {status: 400});
    const record = newRecord(title, body, url, 'announcement', fingerprint);
    // ponytail: single Web process; interrupted campaigns are reported, not automatically replayed.
    deliver(record).catch(() => { sending = false; console.error('[Push] Campaign completion could not be saved.'); });
    return record;
  } catch (error) { sending = false; throw error; }
}

// ponytail: batching is in-process; use a durable queue before multiple Web instances or guaranteed restart delivery.
let baseline: PriceSnapshot | null = null, latest: PriceSnapshot | null = null;
let digestTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDigest(delay = RATE_PUSH_BATCH_DELAY) {
  if (digestTimer) return;
  digestTimer = setTimeout(() => { digestTimer = null; flushPricePush().catch(() => { sending = false; scheduleDigest(RATE_PUSH_INTERVAL); }); }, delay);
  digestTimer.unref?.();
}
export function queueRatePush(snapshot: PriceSnapshot) {
  const timestamp = Date.parse(snapshot.lastUpdated);
  if (!Number.isFinite(timestamp) || timestamp < Date.parse((latest || baseline)?.lastUpdated || '')) return;
  const next = {parallel: {...snapshot.parallel}, official: {...snapshot.official}, lastUpdated: snapshot.lastUpdated};
  if (!baseline) { baseline = next; return; }
  // First valid value establishes a baseline, rather than announcing a newly loaded currency.
  for (const market of ['parallel', 'official'] as const) {
    for (const [code, value] of Object.entries(next[market])) {
      if ((!Number.isFinite(baseline[market][code]) || baseline[market][code] <= 0) && value > 0 && Number.isFinite(value)) baseline[market][code] = value;
    }
  }
  latest = next;
  if (priceChanges(baseline, next).length) scheduleDigest();
}
export async function flushPricePush() {
  if (!baseline || !latest) return;
  const changes = priceChanges(baseline, latest, 0.05, appConfig.terms);
  if (!changes.length) { latest = null; return; }
  const now = Date.now(), {day} = tripoliTime(now);
  if (state.rateDay !== day) { state.rateDay = day; state.rateCount = 0; }
  if (sending || isQuietTime(now) || state.rateCount >= 6) { scheduleDigest(RATE_PUSH_INTERVAL); return; }
  if (now - state.rateSentAt < RATE_PUSH_INTERVAL) { scheduleDigest(RATE_PUSH_INTERVAL - (now - state.rateSentAt)); return; }
  const captured = latest, digest = priceDigest(changes);
  sending = true;
  const record = newRecord(digest.title, digest.body, '/#rates-section', 'rates');
  await deliver(record);
  if (record.sent > 0 || record.total === 0) {
    baseline = captured;
    if (latest === captured) latest = null;
    if (record.sent > 0) { state.rateSentAt = now; state.rateCount++; saveState(); }
  }
  if (latest && priceChanges(baseline, latest).length) scheduleDigest(RATE_PUSH_INTERVAL);
}
