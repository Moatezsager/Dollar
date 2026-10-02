import express from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { db, supabase, supabaseAnonKey } from "../db";
import { messageRateLimiter } from "../middleware/security";
import { forwardVisitorMessageToTelegram } from "../services/social.service";

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

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
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
      if (delivered && messageId) {
        try {
          db.prepare("UPDATE messages SET status = 'sent_to_telegram' WHERE id = ?").run(messageId);
        } catch (e) {}
      }
    }).catch(err => {
      console.error("Failed to forward visitor message to Telegram Saved Messages:", err);
    });
    
    res.json({ success: true, message: "تم إرسال رسالتك بنجاح. سيتم الرد عليك في أقل من 24 ساعة." });
  } catch (error: any) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حفظ الرسالة", details: error.message || error.toString() });
  }
});

router.post("/analytics/track", express.json(), (req: express.Request, res: express.Response) => {
  try {
    const { sessionId, visitorId, pagePath, referrer } = req.body;
    if (!sessionId || !visitorId) {
      return res.status(400).json({ success: false, error: "Missing sessionId or visitorId" });
    }

    const ua = req.headers['user-agent'] || 'Unknown';
    let deviceType = "Desktop";
    let deviceVendor = "Unknown";
    let deviceModel = "Unknown";

    if (/mobile/i.test(ua)) deviceType = "Mobile";
    if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";
    if (/bot|crawler|spider|googlebot|bingbot|yandex/i.test(ua)) deviceType = "Bot";

    if (/iPhone/i.test(ua)) {
      deviceVendor = "Apple"; deviceModel = "iPhone"; deviceType = "Mobile";
    } else if (/iPad/i.test(ua)) {
      deviceVendor = "Apple"; deviceModel = "iPad"; deviceType = "Tablet";
    } else if (/Samsung|SM-|GT-/i.test(ua)) {
      deviceVendor = "Samsung"; deviceModel = "Galaxy"; deviceType = "Mobile";
    } else if (/Huawei|Honor/i.test(ua)) {
      deviceVendor = "Huawei"; deviceModel = "Device"; deviceType = "Mobile";
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
      deviceVendor = "Xiaomi"; deviceModel = "Device"; deviceType = "Mobile";
    } else if (/Android/i.test(ua)) {
      deviceVendor = "Android"; deviceModel = "Smartphone"; deviceType = "Mobile";
    } else if (/Windows/i.test(ua)) {
      deviceVendor = "PC"; deviceModel = "Windows Desktop"; deviceType = "Desktop";
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      deviceVendor = "Apple"; deviceModel = "Macintosh"; deviceType = "Desktop";
    } else if (/Linux/i.test(ua)) {
      deviceVendor = "PC"; deviceModel = "Linux Desktop"; deviceType = "Desktop";
    }

    let osName = "Unknown";
    let osVersion = "Unknown";
    if (/Windows NT 10.0/i.test(ua)) { osName = "Windows"; osVersion = "10 / 11"; }
    else if (/Windows/i.test(ua)) { osName = "Windows"; }
    else if (/Mac OS X/i.test(ua)) { osName = "macOS"; }
    else if (/Android (\d+(\.\d+)?)/i.test(ua)) {
      const match = ua.match(/Android (\d+(\.\d+)?)/i);
      osName = "Android";
      osVersion = match ? match[1] : "Android";
    }
    else if (/iPhone OS (\d+_\d+)/i.test(ua)) {
      const match = ua.match(/iPhone OS (\d+_\d+)/i);
      osName = "iOS";
      osVersion = match ? match[1].replace("_", ".") : "iOS";
    } else if (/Linux/i.test(ua)) {
      osName = "Linux";
    }

    let browserName = "Other";
    let browserVersion = "Unknown";
    if (/SamsungBrowser/i.test(ua)) browserName = "Samsung Internet";
    else if (/Edg/i.test(ua)) browserName = "Microsoft Edge";
    else if (/Chrome|CriOS/i.test(ua)) browserName = "Google Chrome";
    else if (/Firefox|FxiOS/i.test(ua)) browserName = "Mozilla Firefox";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browserName = "Apple Safari";
    else if (/Opera|OPR/i.test(ua)) browserName = "Opera";

    // 1. Insert into local SQLite
    const insertLocal = db.prepare(`
      INSERT INTO analytics_events (
        visitor_id, session_id, page_path, referrer, 
        device_type, device_vendor, device_model, 
        os_name, os_version, browser_name, browser_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLocal.run(
      visitorId, sessionId, pagePath || '/', referrer || '',
      deviceType, deviceVendor, deviceModel,
      osName, osVersion, browserName, browserVersion
    );

    // 2. Insert into Supabase
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('analytics_events').insert([{
        visitor_id: visitorId,
        session_id: sessionId,
        page_path: pagePath || '/',
        referrer: referrer || '',
        device_type: deviceType,
        device_vendor: deviceVendor,
        device_model: deviceModel,
        os_name: osName,
        os_version: osVersion,
        browser_name: browserName,
        browser_version: browserVersion
      }]).then(({ error }) => {
        if (error) console.error("[Supabase] Analytics event sync error:", error.message);
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Analytics] Error logging tracking event:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') as string;
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
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "") as string;
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
