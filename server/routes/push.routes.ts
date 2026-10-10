import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { db, supabase, supabaseAnonKey } from "../db";
import { vapidKeys, validPushSubscription, validPushEndpoint, invalidatePushSubscribers } from "../services/push.service";

const router = express.Router();
const subscribeLimiter = rateLimit({windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: {success: false, error: 'طلبات كثيرة. أعد المحاولة لاحقًا.'}});

router.get("/push/public-key", (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({publicKey: vapidKeys.publicKey || ''});
});

router.post("/push/subscribe", subscribeLimiter, express.json(), async (req, res) => {
  const subscription = req.body?.subscription;
  if (!validPushSubscription(subscription)) return res.status(400).json({success: false, error: 'اشتراك الإشعارات غير صالح.'});
  try {
    const {endpoint, keys: {p256dh, auth}} = subscription;
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      const {error} = await supabase.from('push_subscriptions').upsert({endpoint, p256dh, auth, last_active: new Date().toISOString()}, {onConflict: 'endpoint'}).abortSignal(AbortSignal.timeout(10000));
      if (error) throw new Error('Subscription persistence failed');
    }
    db.prepare(`INSERT INTO push_subscriptions (endpoint,p256dh,auth,created_at,last_active)
      VALUES (?,?,?,datetime('now'),datetime('now')) ON CONFLICT(endpoint) DO UPDATE SET
      p256dh=excluded.p256dh,auth=excluded.auth,last_active=excluded.last_active`).run(endpoint,p256dh,auth);
    invalidatePushSubscribers();
    res.json({success: true});
  } catch {
    res.status(503).json({success: false, error: 'تعذر حفظ الاشتراك. أعد المحاولة لاحقًا.'});
  }
});

router.post("/push/unsubscribe", subscribeLimiter, express.json(), async (req, res) => {
  const subscription = req.body?.subscription;
  if (!validPushSubscription(subscription)) return res.status(400).json({success: false, error: 'اشتراك غير صالح.'});
  const {endpoint, keys: {p256dh, auth}} = subscription;
  try {
    // Subscription keys prove possession; knowing an endpoint alone cannot unsubscribe another device.
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      const {error} = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('p256dh', p256dh).eq('auth', auth).abortSignal(AbortSignal.timeout(10000));
      if (error) throw new Error('Subscription deletion failed');
    }
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND p256dh=? AND auth=?').run(endpoint,p256dh,auth);
    invalidatePushSubscribers();
    res.json({success: true});
  } catch { res.status(503).json({success: false, error: 'تعذر تنظيف الاشتراك على الخادم.'}); }
});

router.post("/push/active", subscribeLimiter, express.json(), (req, res) => {
  if (!validPushEndpoint(req.body?.endpoint)) return res.status(400).json({success: false});
  try {
    db.prepare("UPDATE push_subscriptions SET last_active=datetime('now') WHERE endpoint=?").run(req.body.endpoint);
    res.json({success: true});
  } catch { res.status(503).json({success: false}); }
});

// Service Worker for Push Notifications
export function handlePushSwRoute(req: express.Request, res: express.Response) {
  const swPath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "push-sw.js")
    : path.join(process.cwd(), "public", "push-sw.js");
  if (fs.existsSync(swPath)) {
    res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Service Worker not found");
  }
}

export default router;
