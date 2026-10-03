import express from "express";
import path from "path";
import fs from "fs";
import { db, supabase, supabaseAnonKey } from "../db";
import { vapidKeys } from "../services/push.service";

const router = express.Router();

router.get("/push/public-key", (req: express.Request, res: express.Response) => {
  res.json({ publicKey: vapidKeys.publicKey || '' });
});

router.post("/push/subscribe", express.json(), (req: express.Request, res: express.Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: "Invalid subscription" });
    }
    const keys = subscription.keys || {};
    const endpoint = subscription.endpoint;
    const p256dh = keys.p256dh || '';
    const auth = keys.auth || '';

    db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at, last_active)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(endpoint, p256dh, auth);

    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('push_subscriptions').upsert({
        endpoint,
        p256dh,
        auth,
        last_active: new Date().toISOString()
      }, { onConflict: 'endpoint' }).then(({ error }) => {
        if (error) console.error("[Supabase] Push subscribe error:", error.message);
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Push] Subscription error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/push/active", express.json(), (req: express.Request, res: express.Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      db.prepare(`
        UPDATE push_subscriptions SET last_active = datetime('now') WHERE endpoint = ?
      `).run(endpoint);

      if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
        supabase.from('push_subscriptions').update({
          last_active: new Date().toISOString()
        }).eq('endpoint', endpoint).then(() => {}, () => {});
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// Service Worker for Push Notifications
export function handlePushSwRoute(req: express.Request, res: express.Response) {
  const swPath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "push-sw.js")
    : path.join(process.cwd(), "public", "push-sw.js");
  if (fs.existsSync(swPath)) {
    res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Service Worker not found");
  }
}

export default router;
