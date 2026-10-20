import express from "express";
import { rateLimit } from 'express-rate-limit';
import { recordPageview } from '../services/analytics-tracking';
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { db, supabase, supabaseAnonKey } from "../db";
import { messageRateLimiter } from "../middleware/security";
import { forwardVisitorMessageToTelegram } from "../services/social.service";
import { visitorIp } from "../services/visitor-details.service";

const router = express.Router();

const spamKeywords = ['casino', 'viagra', 'crypto', 'bitcoin', 'investment', 'lottery', 'winner', 'sex', 'porn', 'nude', 'http://', 'https://'];

export async function trackTelegramVisit(info: { ipHash: string; ua: string; ref: string; isBot: number }) {
  // 1. Update SQLite counter (for offline or local dev fallback)
  try {
    db.prepare(`UPDATE telegram_counter SET count = count + 1 WHERE id = 1`).run();
  } catch (e) {}

  try {
    db.prepare(`
      INSERT INTO telegram_visits (ip_hash, user_agent, referrer, is_bot)
      VALUES (?, ?, ?, ?)
    `).run(info.ipHash, info.ua.slice(0, 500), info.ref.slice(0, 500), info.isBot);
  } catch (e) {}

  // 2. Supabase single-row update (id = 0)
  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes("dummy")) {
    try {
      const { error: rpcErr } = await supabase.rpc("increment_telegram_visits", {
        p_ip_hash: info.ipHash,
        p_user_agent: info.ua.slice(0, 250),
        p_referrer: info.ref.slice(0, 250)
      });

      if (!rpcErr) {
        return;
      }

      const { data: row } = await supabase
        .from("telegram_visits")
        .select("visits_count")
        .eq("id", 0)
        .maybeSingle();

      const currentCount = (row && typeof row.visits_count === "number") ? row.visits_count : 0;
      const nowIso = new Date().toISOString();

      await supabase.from("telegram_visits").upsert({
        id: 0,
        visits_count: currentCount + 1,
        last_entry_at: nowIso,
        last_ip_hash: info.ipHash,
        last_user_agent: info.ua.slice(0, 250),
        last_referrer: info.ref.slice(0, 250),
        updated_at: nowIso
      }, { onConflict: "id" });
    } catch (sbErr: any) {
      console.error("[Supabase] Telegram visit track error:", sbErr.message);
    }
  }
}

router.post("/messages", messageRateLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, phone, message } = req.body;
    
    if (!email || !phone || !message) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    // Basic spam protection
    const messageLower = message.toLowerCase();
    const isSpam = spamKeywords.some(keyword => messageLower.includes(keyword));
    
    if (isSpam || message.length > 1000) {
      return res.status(400).json({ error: "تم رفض الرسالة بسبب محتواها أو طولها." });
    }

    const visitorName = typeof name === 'string' && name.trim() ? name.trim() : 'زائر';
    
    let messageId: number | bigint = 0;
    try {
      const stmt = db.prepare('INSERT INTO messages (name, email, phone, message) VALUES (?, ?, ?, ?)');
      const info = stmt.run(visitorName, email, phone, message);
      messageId = info.lastInsertRowid;
    } catch (dbErr) {
      const fallbackStmt = db.prepare('INSERT INTO messages (email, phone, message) VALUES (?, ?, ?)');
      const info = fallbackStmt.run(email, phone, message);
      messageId = info.lastInsertRowid;
    }

    const ip = visitorIp(req.headers['x-forwarded-for'], req.socket.remoteAddress, req.headers['cf-connecting-ip'] || req.headers['x-real-ip']);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const referrer = (req.headers['referer'] as string) || (req.headers['referrer'] as string) || '';
    
    // Supabase Sync
    if (supabase) {
      supabase.from('visitor_messages').insert([{
        name: visitorName,
        email,
        phone,
        message,
        ip,
        user_agent: userAgent,
        status: 'new'
      }]).then(({ error }) => {
        if (error) {
          supabase?.from('visitor_logs').insert([{
            ip_address: ip,
            user_agent: userAgent
          }]).then(() => {}, () => {});
        }
      });
    }

    // Telegram forwarding
    forwardVisitorMessageToTelegram({
      id: messageId,
      name: visitorName,
      email,
      phone,
      message,
      ip,
      userAgent,
      referrer
    }).then(delivered => {
      if (messageId) {
        try {
          db.prepare("UPDATE messages SET status = ? WHERE id = ?").run(delivered ? 'sent_to_telegram' : 'telegram_failed', messageId);
        } catch (e) {}
      }
    }).catch(err => {
      console.error("Failed to forward visitor message to Telegram Saved Messages:", err);
      if (messageId) {
        try {
          db.prepare("UPDATE messages SET status = 'telegram_failed' WHERE id = ?").run(messageId);
        } catch (e) {}
      }
    });
    
    res.json({ success: true, message: "تم إرسال رسالتك بنجاح. سيتم الرد عليك في أقل من 24 ساعة." });
  } catch (error: any) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حفظ الرسالة", details: error.message || error.toString() });
  }
});

const analyticsCapacity = rateLimit({ windowMs: 60000, limit: 300, keyGenerator: () => 'analytics', standardHeaders: 'draft-8', legacyHeaders: false });
const analyticsPerIP = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
router.post('/analytics/track', analyticsCapacity, analyticsPerIP, express.json({ limit: '4kb' }), recordPageview);

router.post("/track/install", (req: express.Request, res: express.Response) => {
  try {
    const { platform } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    
    const insert = db.prepare('INSERT INTO installs (platform, user_agent) VALUES (?, ?)');
    insert.run(platform || 'unknown', userAgent);
    
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('installs').insert([{
        platform: platform || 'unknown',
        user_agent: userAgent
      }]).then(({ error }) => {
        if (error) console.error("[Supabase] Install sync error:", error.message);
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error tracking install:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/telegram-click", express.json(), express.text(), (req: express.Request, res: express.Response) => {
  try {
    const ua = (req.headers['user-agent'] || '') as string;
    const isBot = /bot|crawler|spider|facebookexternalhit|facebookcatalog|meta|twitter|whatsapp|telegram|preview/i.test(ua) ? 1 : 0;
    let ref = '';
    if (typeof req.body === 'string') {
      try { ref = JSON.parse(req.body)?.referrer || ''; } catch (e) {}
    } else if (req.body && typeof req.body === 'object') {
      ref = req.body.referrer || '';
    }
    if (!ref) {
      ref = (req.headers['referer'] || req.headers['referrer'] || '') as string;
    }
    const ip = visitorIp(req.headers['x-forwarded-for'], req.socket?.remoteAddress, req.headers['cf-connecting-ip'] || req.headers['x-real-ip']);
    const ipHash = crypto.createHash('sha256').update(ip + '_salt_tg').digest('hex').slice(0, 16);

    if (!isBot) {
      trackTelegramVisit({ ipHash, ua, ref, isBot });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Non-API Telegram page and banner handlers
export function handleTelegramPageRoute(req: express.Request, res: express.Response) {
  try {
    const ua = (req.headers["user-agent"] || "") as string;
    const isBot = /bot|crawler|spider|facebookexternalhit|facebookcatalog|meta|twitter|whatsapp|telegram|preview/i.test(ua) ? 1 : 0;
    const ref = (req.headers["referer"] || req.headers["referrer"] || "") as string;
    const ip = visitorIp(req.headers["x-forwarded-for"], req.socket?.remoteAddress, req.headers["cf-connecting-ip"] || req.headers["x-real-ip"]);
    const ipHash = crypto.createHash("sha256").update(ip + "_salt_tg").digest("hex").slice(0, 16);

    const filePath = process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "dist", "telegram.html")
      : path.join(process.cwd(), "public", "telegram.html");
    const hasHtml = fs.existsSync(filePath);

    if (!hasHtml && !isBot) {
      trackTelegramVisit({ ipHash, ua, ref, isBot });
    }
  } catch (dbErr) {
    console.error("[Telegram Visit Track Error]:", dbErr);
  }

  const filePath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "telegram.html")
    : path.join(process.cwd(), "public", "telegram.html");
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    return res.sendFile(filePath);
  }
  res.redirect("https://t.me/libya_index_dollar");
}

export function handleTelegramBannerRoute(req: express.Request, res: express.Response) {
  const bannerPath = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "telegram-banner.png")
    : path.join(process.cwd(), "public", "telegram-banner.png");
  if (fs.existsSync(bannerPath)) {
    res.setHeader("Content-Type", "image/png");
    return res.sendFile(bannerPath);
  }
  res.status(404).send("Banner not found");
}

export default router;
