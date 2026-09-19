import webpush from 'web-push';
import cron from 'node-cron';
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

export async function sendRetentionPushNotifications() {
  console.log('[Push] Checking for retention notifications...');
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    let subscriptions: any[] = [];
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .lt('last_active', threeDaysAgo)
          .gt('last_active', fourDaysAgo);
        if (!error && data) {
          subscriptions = data;
        }
      } catch (err) {
        console.error('[Push] Supabase retention query error:', err);
      }
    }

    if (subscriptions.length === 0) {
      subscriptions = db.prepare(`
        SELECT endpoint, p256dh, auth FROM push_subscriptions 
        WHERE last_active < ? AND last_active > ?
      `).all(threeDaysAgo, fourDaysAgo) as any[];
    }

    console.log(`[Push] Found ${subscriptions.length} users to remind.`);

    const payload = JSON.stringify({
      title: 'مؤشر الدينار',
      body: 'أسعار اليوم تغيرت، تفضل بالمتابعة',
      url: '/'
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
          if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
            supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(() => {}).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('[Push] Retention error:', err);
  }
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  url: string = '/'
) {
  try {
    let subscriptions: any[] = [];

    // First try fetching from Supabase
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth');
        if (!error && data && data.length > 0) {
          subscriptions = data;
        }
      } catch (err) {
        console.error('[Push] Supabase select error:', err);
      }
    }

    // Fallback to SQLite
    if (subscriptions.length === 0) {
      subscriptions = db.prepare(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions'
      ).all() as any[];
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No subscribers to notify.');
      return;
    }

    console.log(`[Push] Sending to ${subscriptions.length} subscribers: "${title}"`);

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'dinar-' + Date.now()
    });

    const BATCH_SIZE = 50;
    let sent = 0, failed = 0, removed = 0;

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (sub: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { TTL: 60 * 60 * 24 }
            );
            sent++;
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
              if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
                supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(() => {}).catch(() => {});
              }
              removed++;
            } else {
              failed++;
              console.warn('[Push] Failed to send to one subscriber:', err.statusCode || err.message);
            }
          }
        })
      );

      if (i + BATCH_SIZE < subscriptions.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`[Push] Done — sent: ${sent}, failed: ${failed}, removed (expired): ${removed}`);
  } catch (err) {
    console.error('[Push] Broadcast error:', err);
  }
}

// Scheduled retention push notification
cron.schedule('0 10 * * *', () => {
  sendRetentionPushNotifications();
}, {
  timezone: "Africa/Tripoli"
});
