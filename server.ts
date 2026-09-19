import dotenv from "dotenv";
dotenv.config({ override: true });
import cron from "node-cron";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { extractRatesWithAI } from './server/services/ai.service';
import { getTelegramClient, fetchChannelMessages, initializeTelegram, activeClient, TelegramManager, getTelegramManager } from "./telegramClient";
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

// Modular imports
import { db, supabase, supabaseUrl, supabaseAnonKey } from './server/db';
import { 
  appConfig, 
  updateAppConfig, 
  setTelegramManager,
  applyLoadedConfig,
  loadConfigFromStorage,
  loadConfigFromSupabase,
  saveConfigToSupabase
} from './server/config';
import { rates, history } from './server/state';
import {
  loadLatestRatesFromSupabase,
  logErrorArabic,
  logPriceChange,
  initializeRatesFromDB,
  saveToSupabase,
  fetchHistoryFromSupabase,
  clearDbCache,
  syncCheckRates,
  recentChangesLog,
  cleanupOldData
} from './server/services/db.service';
import { requireAdmin, adminToken } from './server/middleware/auth';
import { createAdminRouter } from './server/routes/admin.routes';
import { 
  broadcastToSocialMedia, 
  broadcastOfficialRates, 
  broadcastRateChanges, 
  executeBroadcast, 
  lastOfficialBroadcastDate, 
  facebookBroadcastStatus, 
  telegramBroadcastStatus, 
  lastSocialBroadcastTime,
  lastBroadcastState,
  getOrInitTelegramManager,
  forwardVisitorMessageToTelegram
} from './server/services/social.service';
import {
  dailyStats,
  weeklyStats,
  initStatsIfEmpty,
  updateStats,
  broadcastSuddenChangeAlert,
  broadcastDailyReport,
  broadcastWeeklyReport
} from './server/services/reporting.service';
import { cleanupOldBroadcastLogs } from './server/services/broadcastLog.service';
import {
  fetchFromCBL,
  fetchOfficialRates,
  stripArabicDiacritics,
  extractRatesFromText,
  fetchParallelRatesFromTelegram,
  lastOfficialFetchDate,
  lastSuccessfulFetchTime,
  setLastSuccessfulFetchTime,
  isScraping,
  lastSuccessfulScrape,
  lastAttemptTime,
  channelStatusTracker,
  liveFeed,
  clearLiveFeed
} from './server/services/scraper.service';
import { 
  Rates, 
  RateMap, 
  LastChangedMap, 
  HistoryPoint, 
  AppConfig, 
  PriceChangeLog, 
  CurrencyStat, 
  ChannelStatusInfo, 
  LiveFeedMessage, 
  DeviceLogEntry 
} from './server/types';
import { 
  vapidKeys, 
  sendPushNotificationToAll, 
  sendRetentionPushNotifications 
} from './server/services/push.service';
import { 
  getSecurityKey, 
  xorData, 
  obfuscateData, 
  isSignificantChange, 
  isProbablyDateOrTime 
} from './server/utils/helpers';

const serverStartTime = new Date();


// Arabic Logging Utility



cron.schedule('55 23 * * 5', () => {
  broadcastWeeklyReport().catch(console.error);
}, {
  timezone: "Africa/Tripoli"
});

// Telegram channels for parallel market rates

// Initial fetch and setup
initializeRatesFromDB().then(() => {
  loadConfigFromSupabase().then(() => {
    console.log("Server initialized. Waiting for cron job to trigger /api/refresh.");
  });
});

// --- Memory Watchdog & Self-Healing ---
const monitorMemory = () => {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  console.log(`[Watchdog] Memory Check: Heap=${heapUsedMB}MB, RSS=${rssMB}MB`);

  // If memory is getting high (Render free tier is 512MB), clear internal caches
  if (heapUsedMB > 400 || rssMB > 450) {
    console.warn(`[Watchdog] HIGH MEMORY DETECTED (${heapUsedMB}MB). Triggering emergency cache cleanup...`);
    clearDbCache();
    
    // Suggest GC to V8 if exposed
    if (global && typeof (global as any).gc === 'function') {
      try { (global as any).gc(); } catch (e) {}
    }
  }
};

let userLogs: DeviceLogEntry[] = [];

const cleanupUserLogs = () => {
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  const initialCount = userLogs.length;
  userLogs = userLogs.filter(log => new Date(log.timestamp).getTime() > twentyFourHoursAgo);
  if (userLogs.length !== initialCount) {
    console.log(`[Cleanup] Removed ${initialCount - userLogs.length} old user logs.`);
  }
};

// Run memory watchdog every 15 minutes
setInterval(monitorMemory, 15 * 60 * 1000);

// Run memory cleanup every 15 minutes
setInterval(cleanupUserLogs, 15 * 60 * 1000);

// Run cleanup once on startup, then every 24 hours
cleanupOldData(cleanupUserLogs);
setInterval(() => cleanupOldData(cleanupUserLogs), 24 * 60 * 60 * 1000);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("[Server] Shutting down gracefully...");
  if (activeClient && activeClient.connected) {
    try {
      console.log("[GramJS] Disconnecting Telegram client...");
      await activeClient.disconnect();
    } catch (e) {
      console.error("[GramJS] Error during disconnect:", e);
    }
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);


// ==========================================
// Local Database Maintenance (Auto-Vacuum)
// ==========================================
const cleanupLocalDatabase = () => {
  try {
    console.log("[Local DB] Running scheduled cleanup and VACUUM...");
    
    // Delete analytics older than 60 days
    const analyticsResult = db.prepare(`
      DELETE FROM analytics_events 
      WHERE created_at < datetime('now', '-60 days')
    `).run();
    if (analyticsResult.changes > 0) {
      console.log(`[Local DB] Deleted ${analyticsResult.changes} old analytics events.`);
    }

    // Delete messages older than 60 days
    const messagesResult = db.prepare(`
      DELETE FROM messages 
      WHERE created_at < datetime('now', '-60 days')
    `).run();
    if (messagesResult.changes > 0) {
      console.log(`[Local DB] Deleted ${messagesResult.changes} old messages.`);
    }

    // Delete broadcast logs older than 45 days
    cleanupOldBroadcastLogs().catch(err => {
      console.error("[Local DB] Error cleaning up broadcast logs:", err);
    });

    // Run VACUUM to reclaim space
    db.exec('VACUUM');
    console.log("[Local DB] VACUUM completed successfully.");
    
  } catch (error) {
    console.error("[Local DB] Error during cleanup:", error);
  }
};

// Schedule it to run at 3:00 AM every day
cron.schedule('0 3 * * *', cleanupLocalDatabase);

async function loadBroadcastStateFromStorageAndSupabase() {
  try {
    // 1. Fetch from Supabase (if available)
    let supabaseRows: any[] = [];
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase.from('broadcast_state').select('term_id, last_price, last_broadcast_time');
        if (!error && data) {
          supabaseRows = data;
        } else if (error && error.message.includes('relation "broadcast_state" does not exist')) {
          console.warn("[BroadcastState] Supabase table 'broadcast_state' does not exist yet.");
        }
      } catch (err) {
        console.error("[BroadcastState] Supabase load error:", err);
      }
    }
    
    // 2. Merge Supabase into local DB
    if (supabaseRows.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO broadcast_state (term_id, last_price, last_broadcast_time)
        VALUES (?, ?, ?)
        ON CONFLICT(term_id) DO UPDATE SET
          last_price = excluded.last_price,
          last_broadcast_time = excluded.last_broadcast_time
        WHERE excluded.last_broadcast_time > broadcast_state.last_broadcast_time
      `);
      db.transaction(() => {
        for (const row of supabaseRows) {
          insertStmt.run(row.term_id, row.last_price, row.last_broadcast_time);
        }
      })();
    }
    
    // 3. Load whatever is in SQLite into memory
    const finalRows = db.prepare('SELECT term_id, last_price, last_broadcast_time FROM broadcast_state').all() as any[];
    for (const r of finalRows) {
      lastBroadcastState[r.term_id] = { price: r.last_price, time: r.last_broadcast_time };
    }
    console.log(`[BroadcastState] Loaded ${finalRows.length} state records into memory.`);
  } catch (err) {
    console.error("[BroadcastState] Error loading state:", err);
  }
}

async function startServer() {
  await loadBroadcastStateFromStorageAndSupabase();
  
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  // Online Users Tracking
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    connectTimeout: 10000,
    transports: ['polling', 'websocket'],
    allowUpgrades: true
  });
  let onlineUsers = 0;
  const activeDeviceSockets = new Map<string, Set<string>>(); // deviceKey -> socketIds

  io.on('connection', (socket: any) => {
    const req = socket.request;
    onlineUsers++;
    broadcastOnlineCount();

    const rawIp = (req.headers["x-forwarded-for"] || req.connection.remoteAddress || "") as string;
    const ip = rawIp.split(",")[0].trim() || "127.0.0.1";
    const ua = (req.headers["user-agent"] || "Unknown") as string;
    const clientDeviceId = socket.handshake?.query?.deviceId as string || `${ip}_${ua}`;
    
    if (!activeDeviceSockets.has(clientDeviceId)) {
      activeDeviceSockets.set(clientDeviceId, new Set());
    }
    activeDeviceSockets.get(clientDeviceId)!.add(socket.id);

    if (appConfig.enableUserTracking) {
      let deviceType = "Desktop";
      let deviceName = "حاسوب مكتبي / محمول";

      if (/mobile/i.test(ua)) deviceType = "Mobile";
      if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";
      if (/bot|crawler|spider|googlebot|bingbot|yandex/i.test(ua)) deviceType = "Bot";

      if (/iPhone/i.test(ua)) {
        deviceName = "Apple iPhone"; deviceType = "Mobile";
      } else if (/iPad/i.test(ua)) {
        deviceName = "Apple iPad"; deviceType = "Tablet";
      } else if (/Samsung|SM-|GT-/i.test(ua)) {
        deviceName = "Samsung Galaxy"; deviceType = "Mobile";
      } else if (/Huawei|Honor/i.test(ua)) {
        deviceName = "Huawei Device"; deviceType = "Mobile";
      } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
        deviceName = "Xiaomi Device"; deviceType = "Mobile";
      } else if (/Android/i.test(ua)) {
        deviceName = "هاتف أندرويد (Android)"; deviceType = "Mobile";
      } else if (/Windows/i.test(ua)) {
        deviceName = "حاسوب ويندوز (Windows PC)"; deviceType = "Desktop";
      } else if (/Macintosh|Mac OS/i.test(ua)) {
        deviceName = "أبل ماك (MacBook / iMac)"; deviceType = "Desktop";
      } else if (/Linux/i.test(ua)) {
        deviceName = "حاسوب لينكس (Linux PC)"; deviceType = "Desktop";
      }

      let os = "غير محدد";
      if (/Windows NT 10.0/i.test(ua)) os = "Windows 10 / 11";
      else if (/Windows/i.test(ua)) os = "Windows";
      else if (/Mac OS X/i.test(ua)) os = "macOS";
      else if (/Android (d+(.d+)?)/i.test(ua)) {
        const match = ua.match(/Android (d+(.d+)?)/i);
        os = match ? `Android ${match[1]}` : "Android";
      }
      else if (/iPhone OS (d+_d+)/i.test(ua)) {
        const match = ua.match(/iPhone OS (d+_d+)/i);
        os = match ? `iOS ${match[1].replace("_", ".")}` : "iOS";
      } else if (/Linux/i.test(ua)) os = "Linux";

      let browser = "متصفح آخر";
      if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
      else if (/Edg/i.test(ua)) browser = "Microsoft Edge";
      else if (/Chrome|CriOS/i.test(ua)) browser = "Google Chrome";
      else if (/Firefox|FxiOS/i.test(ua)) browser = "Mozilla Firefox";
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Apple Safari";
      else if (/Opera|OPR/i.test(ua)) browser = "Opera";

      const existingLogIndex = userLogs.findIndex(log => log.deviceId === clientDeviceId || (log.ip === ip && log.userAgent === ua));

      if (existingLogIndex !== -1) {
        const existingLog = userLogs[existingLogIndex];
        existingLog.timestamp = new Date().toISOString();
        existingLog.last_active = new Date().toISOString();
        existingLog.visits = (existingLog.visits || 1) + 1;
        existingLog.isOnline = true;
        existingLog.ip = ip;
        existingLog.deviceName = deviceName;
        existingLog.deviceType = deviceType;
        existingLog.os = os;
        existingLog.browser = browser;
        
        userLogs.splice(existingLogIndex, 1);
        userLogs.unshift(existingLog);
        broadcastUserLogs();
      } else {
        const newLog: any = {
          id: clientDeviceId,
          deviceId: clientDeviceId,
          ip: ip,
          userAgent: ua,
          timestamp: new Date().toISOString(),
          last_active: new Date().toISOString(),
          firstVisit: new Date().toISOString(),
          visits: 1,
          deviceType: deviceType,
          deviceName: deviceName,
          os: os,
          browser: browser,
          isOnline: true,
          location: "جاري التحديد..."
        };
        userLogs.unshift(newLog);
        if (userLogs.length > 200) userLogs.pop();
        broadcastUserLogs();

        if (ip !== "127.0.0.1" && ip !== "::1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
           fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`)
             .then(res => res.json())
             .then((data: { status?: string; country?: string; city?: string }) => {
                if (data.status === "success") {
                   newLog.location = `${data.country}, ${data.city}`;
                   broadcastUserLogs();
                } else {
                   newLog.location = "غير معروف";
                   broadcastUserLogs();
                }
             }).catch(() => {
                newLog.location = "تعذر التحديد";
             });
        } else {
           newLog.location = "شبكة محلية";
           broadcastUserLogs();
        }
      }
    }

    socket.on("disconnect", () => {
      onlineUsers = Math.max(0, onlineUsers - 1);
      broadcastOnlineCount();

      const sockets = activeDeviceSockets.get(clientDeviceId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeDeviceSockets.delete(clientDeviceId);
          const log = userLogs.find(l => l.deviceId === clientDeviceId);
          if (log) {
            log.isOnline = false;
            log.last_active = new Date().toISOString();
            broadcastUserLogs();
          }
        }
      }
    });
  });

  function broadcastOnlineCount() {
    io.emit('online_count', { count: onlineUsers });
  }

  function broadcastUserLogs() {
    io.emit('user_logs', { logs: userLogs });
  }

  function broadcastConfigUpdate() {
    io.emit('config_update', { config: appConfig });
  }

  function broadcastRatesUpdate(updatedRates: Rates) {
    io.emit('rates_update', { rates: obfuscateData(updatedRates) });
  }

  // Global Error Handlers
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await logErrorArabic(`خطأ غير معالج في السيرفر: ${reason}`, "النظام", String(reason));
  });

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await logErrorArabic(`خطأ فادح في السيرفر: ${error.message}`, "النظام", error.stack || "");
    // Give some time for logging before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  app.use(compression());
  app.use(express.json());
  app.set('trust proxy', 1);

  interface ApiStat {
    timestamp: string;
    ip: string;
    userAgent: string;
    status: number;
    responseTime: number;
  }

  let apiStats = {
    public: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      recentRequests: [] as ApiStat[]
    },
    premium: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      recentRequests: [] as ApiStat[]
    },
    bannedIPsCount: 0
  };

  // Security Middlewares
  const bannedIPs = new Map<string, number>();

  const ipBanMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    if (ip && bannedIPs.has(ip)) {
      const banExpiry = bannedIPs.get(ip)!;
      if (Date.now() < banExpiry) {
        res.status(403).json({ success: false, error: "Your IP is temporarily banned due to excessive requests or suspicious activity." });
        return;
      } else {
        bannedIPs.delete(ip);
      }
    }
    next();
  };

  const suspiciousRoutes = ['/.env', '/wp-admin', '/wp-login.php', '/config.php', '/phpmyadmin'];
  const suspiciousActivityMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (suspiciousRoutes.some(route => req.path.toLowerCase().includes(route))) {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
      if (ip) {
        // Ban permanently (or for a very long time, e.g., 30 days)
        bannedIPs.set(ip, Date.now() + 30 * 24 * 60 * 60 * 1000);
        console.warn(`[Security] Banned IP ${ip} for accessing suspicious route: ${req.path}`);
      }
      res.status(403).json({ success: false, error: "Suspicious activity detected. IP banned." });
      return;
    }
    next();
  };

  const userAgentMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only apply to API routes
    if (req.path.startsWith('/api/')) {
      const ua = req.headers['user-agent'];
      if (!ua || ua.trim() === '' || ua.length < 5) {
        res.status(403).json({ success: false, error: "Valid User-Agent header is required." });
        return;
      }
    }
    next();
  };

  const timeoutMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Set timeout to 5 seconds for API routes
    if (req.path.startsWith('/api/')) {
      res.setTimeout(5000, () => {
        if (!res.headersSent) {
          res.status(408).json({ success: false, error: "Request Timeout (5s limit exceeded)" });
        }
      });
    }
    next();
  };

  app.use(ipBanMiddleware);
  app.use(suspiciousActivityMiddleware);
  app.use(userAgentMiddleware);
  app.use(timeoutMiddleware);

  // Security Headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    // frameguard is enabled by default (SAMEORIGIN), which prevents other sites from embedding this site in an iframe
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://flagcdn.com", "https://hatscripts.github.io", "https://picsum.photos", "https://*.supabase.co", "https://*.google.com", "https://*.gstatic.com"],
        "connect-src": ["'self'", "https://open.er-api.com", "https://t.me", "https://*.supabase.co", "wss:", "ws:", "https://*.google.com", "https://*.gstatic.com", "https://*.googleapis.com"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", "https://*.google.com", "https://*.gstatic.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:", "https://*.googleapis.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.gstatic.com"],
        "frame-ancestors": ["'self'", "https://*.google.com", "https://*.corp.google.com"],
        "worker-src": ["'self'", "blob:"],
        "upgrade-insecure-requests": null,
      },
    },
  }));

  // Rate Limiting
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "محاولات كثيرة جداً، يرجى المحاولة لاحقاً" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);

  // --- Admin API ---
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  
  const effectiveAdminPassword = ADMIN_PASSWORD;
  
  if (!effectiveAdminPassword) {
    console.error("CRITICAL: ADMIN_PASSWORD not set. Admin features will be disabled for security.");
  }



  // Spam protection words
  const spamKeywords = ['casino', 'viagra', 'crypto', 'bitcoin', 'investment', 'lottery', 'winner', 'sex', 'porn', 'nude', 'http://', 'https://'];

  const messageRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 messages per windowMs
    message: { error: "لقد تجاوزت الحد المسموح به من الرسائل. يرجى المحاولة لاحقاً." }
  });

  app.post("/api/messages", messageRateLimiter, async (req: express.Request, res: express.Response) => {
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
        // Fallback if schema doesn't have name column yet
        const fallbackStmt = db.prepare('INSERT INTO messages (email, phone, message) VALUES (?, ?, ?)');
        const info = fallbackStmt.run(email, phone, message);
        messageId = info.lastInsertRowid;
      }

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      const userAgent = (req.headers['user-agent'] as string) || '';
      const referrer = (req.headers['referer'] as string) || (req.headers['referrer'] as string) || '';
      
      // التزامن مع قاعدة البيانات السحابية (Supabase)
      if (supabase) {
        supabase.from('visitor_messages').insert([{
          name: visitorName,
          email,
          phone,
          message,
          ip,
          user_agent: userAgent,
          status: 'new'
        }]).then(({error}) => {
          if (error) {
            // Fallback to visitor_logs if visitor_messages doesn't exist
            supabase?.from('visitor_logs').insert([{
              ip_address: ip,
              user_agent: userAgent
            }]).then(() => {}).catch(() => {});
          }
        });
      }

      // إرسال تنبيه احترافي على تيليجرام (الرسائل المحفوظة) مع كامل التفاصيل
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

  app.use('/api/admin', createAdminRouter({
    io,
    getPublicApiLimiter: () => publicApiLimiter,
    getUserLogs: () => userLogs,
    clearUserLogs: () => { userLogs = []; },
    getOnlineUsers: () => onlineUsers,
    apiStats,
    broadcastRatesUpdate,
    broadcastConfigUpdate,
    broadcastUserLogs,
  }));

  // Programmatic access to post a message to a Telegram channel
  app.post("/api/telegram/send-message", requireAdmin, async (req: express.Request, res: express.Response) => {
    const { channel, message } = req.body;

    if (!channel || !message) {
      return res.status(400).json({ success: false, error: "Channel username and message are required" });
    }

    const tgMgr = getOrInitTelegramManager();
    if (!tgMgr) {
      return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
    }

    try {
      const success = await tgMgr.sendMessage(channel, message);
      if (success) {
        res.json({ success: true, message: "تم النشر بنجاح" });
      } else {
        res.status(500).json({ success: false, error: "فشل النشر" });
      }
    } catch (error: any) {
      console.error(`[API] Error sending message to ${channel}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message || "Failed to send message" });
      }
    }
  });

  // Programmatic access to trigger an update from a specific Telegram channel
  app.post("/api/telegram/update", requireAdmin, async (req: express.Request, res: express.Response) => {
    const { channel, limit = 10 } = req.body;

    if (!channel) {
      return res.status(400).json({ success: false, error: "Channel username is required" });
    }

    const tgMgr = getOrInitTelegramManager();
    if (!tgMgr || !tgMgr.isConnected()) {
      return res.status(503).json({ success: false, error: "Telegram client is not connected" });
    }

    try {
      const messages = await tgMgr.fetchMessages(channel, Math.min(limit, 50));
      
      let anyUpdated = false;
      const allExtracted: { code: string, value: number }[] = [];
      
      // Process messages from oldest to newest to ensure the latest rate is applied last
      const sortedMessages = [...messages].sort((a, b) => a.date - b.date);
      
      for (const msg of sortedMessages) {
        const cleanText = msg.text;
        const extracted = extractRatesFromText(cleanText).filter(item => !item.code.startsWith('GOLD_') && item.code !== 'GOLD');
        
        for (const item of extracted) {
          allExtracted.push(item);
          const currentVal = rates.parallel[item.code];
          
          if (isSignificantChange(currentVal, item.value)) {
            rates.previousParallel[item.code] = currentVal || item.value;
            rates.parallel[item.code] = item.value;
            rates.lastChanged.parallel[item.code] = new Date(msg.date).toISOString();
            anyUpdated = true;
            
            const term = appConfig.terms.find(t => t.id === item.code);
            await logPriceChange({
              id: Math.random().toString(36).substring(2, 9),
              currencyCode: item.code,
              currencyName: term ? term.name : item.code,
              oldPrice: currentVal || item.value,
              newPrice: item.value,
              source: `API Update (${channel})`,
              timestamp: new Date(msg.date).toISOString()
            });
          }
        }
      }
      
      if (anyUpdated) {
        rates.lastUpdated = new Date().toISOString();
        await syncCheckRates(`API Update (${channel})`);
        await saveToSupabase('parallel');
        broadcastRatesUpdate(rates);
      }
      
      res.json({ 
        success: true, 
        message: anyUpdated ? "Rates updated successfully" : "No new rates found",
        extracted: allExtracted,
        updated: anyUpdated
      });
    } catch (error: any) {
      console.error(`[API] Error updating from ${channel}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message || "Failed to update from channel" });
      }
    }
  });

  app.post("/api/analytics/track", express.json(), (req: express.Request, res: express.Response) => {
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

  app.get("/api/config", (req: express.Request, res: express.Response) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ terms: appConfig.terms });
  });

  
  app.post("/api/track/install", (req: express.Request, res: express.Response) => {
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

  app.post("/api/logs/error", async (req: express.Request, res: express.Response) => {
    const { message, stack, context, url, userAgent } = req.body;
    
    // Translation map for common client errors
    let arabicMessage = message;
    if (message?.includes("Failed to fetch")) arabicMessage = "فشل في جلب البيانات من السيرفر (مشكلة اتصال)";
    if (message?.includes("Unexpected token")) arabicMessage = "خطأ في معالجة البيانات المستلمة من السيرفر";
    if (message?.includes("NetworkError")) arabicMessage = "خطأ في الشبكة - تعذر الاتصال";

    console.error("\n[CLIENT ERROR LOG]");
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`Message: ${message}`);
    console.error(`Context: ${context}`);
    console.error(`URL: ${url}`);
    console.error(`User Agent: ${userAgent}`);
    if (stack) console.error(`Stack: ${stack}`);
    console.error("-------------------\n");

    // Save to Supabase
    await logErrorArabic(arabicMessage || message, context || "تطبيق العميل", stack, url);

    res.status(200).json({ success: true });
  });

  app.get("/api/rates", async (req: express.Request, res: express.Response) => {
    try {
      const force = req.query.refresh === 'true';
      await initializeRatesFromDB(force);
      res.json(obfuscateData(rates));
    } catch (err) {
      console.error("Error in /api/rates:", err);
      if (!res.headersSent) {
        res.json(obfuscateData(rates));
      }
    }
  });

  const publicApiLimiter = rateLimit({
    windowMs: appConfig.apiConfig?.rateLimitWindowMs || 60000,
    max: appConfig.apiConfig?.rateLimitMaxRequests || 20,
    handler: (req, res, next, options) => {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
      if (ip) {
        const banDuration = appConfig.apiConfig?.banDurationMinutes || 5;
        bannedIPs.set(ip, Date.now() + banDuration * 60 * 1000);
        console.warn(`[Security] Banned IP ${ip} for ${banDuration} minutes due to rate limit exceeded.`);
        apiStats.bannedIPsCount++;
      }
      apiStats.public.failedRequests++;
      res.status(options.statusCode).json({ success: false, error: `Too many requests. Your IP is temporarily banned.` });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.all("/api/public/rates", publicApiLimiter, async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    apiStats.public.totalRequests++;

    const logRequest = (status: number) => {
      if (status >= 200 && status < 300) {
        apiStats.public.successfulRequests++;
      } else {
        apiStats.public.failedRequests++;
      }
      apiStats.public.recentRequests.unshift({
        timestamp: new Date().toISOString(),
        ip,
        userAgent,
        status,
        responseTime: Date.now() - startTime
      });
      if (apiStats.public.recentRequests.length > 100) {
        apiStats.public.recentRequests.pop();
      }
    };

    if (appConfig.apiConfig?.enabled === false) {
      logRequest(503);
      res.status(503).json({ success: false, error: "API is currently disabled by administrator." });
      return;
    }

    // CORS Policy: Allow all origins, but only GET method
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      logRequest(204);
      res.status(204).end();
      return;
    }

    // Restrict to GET method
    if (req.method !== 'GET') {
      logRequest(405);
      res.status(405).json({ success: false, error: "Method Not Allowed. Only GET is supported." });
      return;
    }

    try {
      // Check for stale data (older than 12 hours)
      const lastUpdatedTime = new Date(rates.lastUpdated).getTime();
      const isStale = (Date.now() - lastUpdatedTime) > (12 * 60 * 60 * 1000);
      
      // Set cache control headers to force caching for 5 minutes
      res.setHeader('Cache-Control', 'public, max-age=300');
      
      const publicData = {
        success: !isStale,
        stale: isStale,
        data: {
          USD: rates.parallel.USD,
          EUR: rates.parallel.EUR,
          GBP: rates.parallel.GBP,
        },
        lastUpdated: rates.lastUpdated
      };
      
      if (isStale) {
        // Add a warning message if data is stale
        (publicData as any).warning = "البيانات قديمة جداً ولم يتم تحديثها منذ أكثر من 12 ساعة.";
      }
      
      logRequest(200);
      res.json(publicData);
    } catch (err) {
      console.error("Error in /api/public/rates:", err);
      if (!res.headersSent) {
        logRequest(500);
        res.status(500).json({ success: false, error: "Internal Server Error" });
      }
    }
  });

  // Premium API Limiter (e.g., 1000 requests per 15 minutes)
  const premiumApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({ success: false, error: `Too many requests. Please try again later.` });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.all("/api/premium/rates", premiumApiLimiter, async (req: express.Request, res: express.Response) => {
    // CORS Policy: Allow all origins, but only GET method
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // Restrict to GET method
    if (req.method !== 'GET') {
      res.status(405).json({ success: false, error: "Method Not Allowed. Only GET is supported." });
      return;
    }

    // Check API Key
    const startTime = Date.now();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    apiStats.premium.totalRequests++;

    const logRequest = (status: number) => {
      if (status >= 200 && status < 300) {
        apiStats.premium.successfulRequests++;
      } else {
        apiStats.premium.failedRequests++;
      }
      apiStats.premium.recentRequests.unshift({
        timestamp: new Date().toISOString(),
        ip,
        userAgent,
        status,
        responseTime: Date.now() - startTime
      });
      if (apiStats.premium.recentRequests.length > 100) {
        apiStats.premium.recentRequests.pop();
      }
    };

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logRequest(401);
      res.status(401).json({ success: false, error: "Unauthorized. Missing or invalid API key." });
      return;
    }

    const apiKey = authHeader.split(' ')[1];
    
    // Validate API Key (For now, we accept a hardcoded key or one from env)
    // In a real app, you'd check this against a database of subscribers
    const validKeys = [process.env.PREMIUM_API_KEY || 'premium-test-key-12345'];
    if (!validKeys.includes(apiKey)) {
      logRequest(403);
      res.status(403).json({ success: false, error: "Forbidden. Invalid API key." });
      return;
    }

    try {
      await initializeRatesFromDB(false);
      res.setHeader('Cache-Control', 'public, max-age=30'); // Cache for 30 seconds
      logRequest(200);
      res.json({
        success: true,
        data: rates,
        lastUpdated: rates.lastUpdated
      });
    } catch (err) {
      console.error("Error in /api/premium/rates:", err);
      if (!res.headersSent) {
        logRequest(500);
        res.status(500).json({ success: false, error: "Internal Server Error" });
      }
    }
  });

  // --- Secure Timing-Safe Key Verification for Cron Endpoints ---
  function isValidCronSecret(providedKey: unknown): boolean {
    const expectedKey = process.env.CRON_SECRET;
    if (!expectedKey || typeof providedKey !== 'string' || !providedKey) {
      return false;
    }
    const expectedBuffer = Buffer.from(expectedKey, 'utf8');
    const providedBuffer = Buffer.from(providedKey, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  // --- Rate Limiters for Cron Endpoints ---
  const cronParallelLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 1, // max 1 request per 2 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/refresh-parallel from IP: ${ip}`);
      res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
    }
  });

  const cronOfficialLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // max 5 requests per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/refresh-official from IP: ${ip}`);
      res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
    }
  });

  const cronCleanupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // max 5 requests per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/cleanup-db from IP: ${ip}`);
      res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
    }
  });

  app.get("/api/refresh-parallel", cronParallelLimiter, async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('X-Accel-Buffering', 'no');

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const providedKey = req.query.key;
    
    if (!isValidCronSecret(providedKey)) {
      console.warn(`[Cron-Job] Unauthorized refresh attempt from IP: ${ip}`);
      return res.status(403).json({ success: false, error: "Forbidden: Invalid security key" });
    }
    
    console.log(`\n[Cron-Job] Refresh request received!`);
    
    try {
      const startTime = Date.now();
      const oldUsd = rates.parallel.USD;

      // 1. Fetch data from Telegram
      const parallelUpdate = await fetchParallelRatesFromTelegram();
      
      if (parallelUpdate === true) {
        console.log(`[Cron-Job] Fetch completed (Changes: ${parallelUpdate}). Syncing with database...`);
        await saveToSupabase('parallel');
        broadcastRatesUpdate(rates);
      } else if (parallelUpdate === false) {
        console.log("[Cron-Job] No changes detected. Database sync skipped.");
      } else {
        console.log("[Cron-Job] Scraper was busy or too recent. Skipping DB sync.");
      }
      
      const duration = Date.now() - startTime;
      const newUsd = rates.parallel.USD;
      
      res.status(200).json({ 
        success: true, 
        message: parallelUpdate !== null ? "Parallel data updated and synced with database" : "Scraper busy, no update performed",
        details: {
          duration_ms: duration,
          parallel_usd: newUsd,
          last_sync: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error("[Cron-Job] Parallel refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Internal server error during refresh" });
      }
    }
  });

  app.get("/api/refresh-official", cronOfficialLimiter, async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('X-Accel-Buffering', 'no');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const providedKey = req.query.key;
    
    if (!isValidCronSecret(providedKey)) {
      console.warn(`[Cron-Job-Official] Unauthorized refresh attempt from IP: ${ip}`);
      return res.status(403).json({ success: false, error: "Forbidden: Invalid security key" });
    }
    
    console.log(`\n[Cron-Job-Official] Official refresh request received!`);
    
    try {
      const startTime = Date.now();
      const oldOfficial = rates.official.USD;

      // 1. Fetch official rates (CBL + fallbacks)
      const officialUpdate = await fetchOfficialRates();
      
      if (officialUpdate === true) {
        console.log(`[Cron-Job-Official] Fetch completed (Changes: ${officialUpdate}). Syncing with database...`);
        await saveToSupabase('official');
        broadcastRatesUpdate(rates);
      } else {
        console.log("[Cron-Job-Official] No changes detected. Database sync skipped.");
      }
      
      const duration = Date.now() - startTime;
      const newOfficial = rates.official.USD;
      
      res.status(200).json({ 
        success: true, 
        message: "Official data updated and synced with database",
        details: {
          duration_ms: duration,
          official_usd: newOfficial,
          last_sync: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error("[Cron-Job-Official] Official refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Internal server error during official refresh", details: err ? String(err) : "Unknown", stack: err && err.stack ? err.stack : "" });
      }
    }
  });

  app.get("/api/cleanup-db", cronCleanupLimiter, async (req: express.Request, res: express.Response) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const providedKey = req.query.key;
    
    if (!isValidCronSecret(providedKey)) {
      console.warn(`[Maintenance] Unauthorized cleanup attempt from IP: ${ip}`);
      return res.status(403).json({ success: false, error: "Forbidden: Invalid security key" });
    }

    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, error: "Database not connected" });
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff30 = thirtyDaysAgo.toISOString();

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const cutoff1 = oneDayAgo.toISOString();

      console.log(`[Maintenance] Manual cleanup triggered. Removing logs older than ${cutoff1} and rates older than ${cutoff30}`);

      // Perform all deletions in parallel
      const [legacyRes, parallelRes, officialRes, metalRes, logsRes, changesRes] = await Promise.all([
        supabase.from('exchange_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
        supabase.from('parallel_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
        supabase.from('official_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
        supabase.from('metal_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
        supabase.from('error_logs').delete({ count: 'exact' }).lt('created_at', cutoff1),
        supabase.from('price_changes_log').delete({ count: 'exact' }).lt('created_at', cutoff1)
      ]);

      const removedRates = (legacyRes.count || 0) + (parallelRes.count || 0) + (officialRes.count || 0) + (metalRes.count || 0);
      const removedLogs = logsRes.count || 0;
      const removedChanges = changesRes.count || 0;

      if (legacyRes.error || parallelRes.error || officialRes.error || metalRes.error || logsRes.error || changesRes.error) {
        console.error("Cleanup partial error:", { 
          legacy: legacyRes.error, 
          parallel: parallelRes.error, 
          official: officialRes.error, 
          metal: metalRes.error,
          logs: logsRes.error,
          changes: changesRes.error
        });
      }

      res.json({
        success: true,
        message: "تم تنظيف كافة جداول قاعدة البيانات بنجاح (السجلات أقدم من يوم، والأسعار أقدم من 30 يوم)",
        details: {
          removed_exchange_rates: legacyRes.count || 0,
          removed_parallel_rates: parallelRes.count || 0,
          removed_official_rates: officialRes.count || 0,
          removed_metal_rates: metalRes.count || 0,
          total_removed_rates: removedRates,
          removed_logs: removedLogs,
          removed_changes: removedChanges,
          cutoff_rates_date: cutoff30,
          cutoff_logs_date: cutoff1
        }
      });
    } catch (err) {
      console.error("[Maintenance] Cleanup failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Internal server error during cleanup" });
      }
    }
  });

  app.get("/api/recent-changes", async (req: express.Request, res: express.Response) => {
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase
          .from('price_changes_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
          
        if (!error && data) {
          return res.json(data.map(d => ({
            id: d.id,
            currencyCode: d.currency_code,
            currencyName: d.currency_name,
            oldPrice: d.old_price,
            newPrice: d.new_price,
            source: d.source,
            timestamp: d.created_at
          })));
        }
      } catch (e) {
        console.error("Failed to fetch price changes from Supabase", e);
      }
    }
    res.json(recentChangesLog);
  });

  app.get("/api/health", async (req: express.Request, res: express.Response) => {
    res.json({
      status: "online",
      uptime: Math.round((new Date().getTime() - serverStartTime.getTime()) / 1000),
      telegram: activeClient?.connected || false,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/history", async (req: express.Request, res: express.Response) => {
    try {
      const dbHistory = await fetchHistoryFromSupabase();
      res.json(obfuscateData(dbHistory));
    } catch (err) {
      if (!res.headersSent) {
        res.json(obfuscateData(history));
      }
    }
  });

  // Client Status endpoint
  app.get("/api/status", (req: express.Request, res: express.Response) => {
    res.json({
      status: "online",
      uptime: Math.round((Date.now() - serverStartTime.getTime()) / 1000),
      telegramConnected: !!(activeClient && activeClient.connected),
      timestamp: new Date().toISOString(),
      lastUpdated: rates?.lastUpdated || new Date().toISOString()
    });
  });

  // Telegram status endpoint
  app.get("/api/telegram/status", (req: express.Request, res: express.Response) => {
    const isConnected = !!(activeClient && activeClient.connected);
    const tgMgr = getOrInitTelegramManager();
    res.json({
      isConnected,
      lastFetchTime: tgMgr ? tgMgr.lastFetchTime : 0
    });
  });

  // Push notification public key and subscription management
  app.get("/api/push/public-key", (req: express.Request, res: express.Response) => {
    res.json({ publicKey: vapidKeys.publicKey || '' });
  });

  app.post("/api/push/subscribe", express.json(), (req: express.Request, res: express.Response) => {
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

  app.post("/api/push/active", express.json(), (req: express.Request, res: express.Response) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        db.prepare(`
          UPDATE push_subscriptions SET last_active = datetime('now') WHERE endpoint = ?
        `).run(endpoint);

        if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
          supabase.from('push_subscriptions').update({
            last_active: new Date().toISOString()
          }).eq('endpoint', endpoint).then(() => {}).catch(() => {});
        }
      }
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false });
    }
  });

  // Protect all remaining /api/* requests from falling into SPA fallback
  app.all("/api/*", (req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  app.get("/push-sw.js", (req, res) => {
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
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    
    // Handle SPA fallback, but ignore static file extensions to prevent redirect/html serving for missing static files
    app.get(/^(?!.*\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest|xml)$).*$/, (req, res, next) => {

      let html = fs.readFileSync(path.join(distPath, "index.html"), 'utf8');
      
      // Dynamic SEO Injection
      if (rates && rates.parallel && rates.parallel.USD) {
        const usdStr = rates.parallel.USD.toFixed(2);
        const eurStr = (rates.parallel.EUR || 0).toFixed(2);
        
        const dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | مؤشر الدينار`;
        const dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل، واليورو ${eurStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة.`;
        
        html = html.replace(/<title>.*?<\/title>/, `<title>${dynamicTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${dynamicDesc}" />`);
        html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${dynamicTitle}" />`);
        html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${dynamicDesc}" />`);
        html = html.replace(/<meta property="twitter:title" content=".*?" \/>/, `<meta property="twitter:title" content="${dynamicTitle}" />`);
        html = html.replace(/<meta property="twitter:description" content=".*?" \/>/, `<meta property="twitter:description" content="${dynamicDesc}" />`);
      }
      
      res.send(html);
    });
  }

  // Admin Watchdog (Suggestion 2)
  setInterval(async () => {
    const libyaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hour: 'numeric', hourCycle: 'h23' });
    const currentLibyaHour = parseInt(libyaFormatter.format(new Date()), 10);
    
    // Only check during active market hours
    if (currentLibyaHour >= 9 || currentLibyaHour < 1) {
      const hoursSinceSuccess = (Date.now() - lastSuccessfulFetchTime) / (1000 * 60 * 60);
      if (hoursSinceSuccess > 4) {
        console.warn(`[Watchdog] No successful scrape for ${hoursSinceSuccess.toFixed(1)} hours!`);
        // Send alert to admin via saved messages if possible
        const tgMgr = getOrInitTelegramManager();
        if (tgMgr) {
          try {
            await tgMgr.sendMessage('me', `⚠️ *تنبيه للمدير (Watchdog)* ⚠️\n\nيبدو أن هناك مشكلة في الجلب الآلي للسوق الموازي.\nمرت أكثر من 4 ساعات دون أي عملية جلب ناجحة.\n\nرجاءً تحقق من حالة السيرفر أو حساب التليجرام.`);
            // Reset to avoid spamming every minute, remind again after 4 hours
            setLastSuccessfulFetchTime(Date.now());
          } catch (e) {
            console.error("[Watchdog] Failed to send alert", e);
          }
        }
      }
    }
  }, 30 * 60 * 1000); // Check every 30 minutes

  // Memory Monitor
  const MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB
  setInterval(async () => {
    const mem = process.memoryUsage();
    if (mem.heapUsed > MEMORY_THRESHOLD) {
      console.warn(`[MemoryMonitor] High memory usage: ${Math.round(mem.heapUsed / 1024 / 1024)}MB. Cleaning...`);
      clearLiveFeed(); // Clear queue
      if (global.gc) {
        global.gc();
      }
      await fetchParallelRatesFromTelegram();
    }
  }, 60000); // Check every minute

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initial scrape on startup (with delay to avoid AUTH_KEY_DUPLICATED when Render restarts)
    (async () => {
      try {
        // 1. Load latest rates from Supabase immediately to ensure we have the latest prices
        await loadLatestRatesFromSupabase();
        for (const key in rates.parallel) {
          if (rates.parallel[key] > 0) {
            initStatsIfEmpty(key, rates.parallel[key]);
          }
        }

        
        console.log("[Startup] Waiting 30s for system to settle and old sessions to clear...");
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        const libyaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hour: 'numeric', hourCycle: 'h23' });
        const currentLibyaHour = parseInt(libyaFormatter.format(new Date()), 10);
        
        if (currentLibyaHour >= 1 && currentLibyaHour < 9) {
          console.log(`[Startup] Skipping initial update during quiet hours (Hour ${currentLibyaHour} Libya Time). Market is sleeping.`);
        } else {
          console.log("[Startup] Triggering initial rates update...");
          const officialChanged = await fetchOfficialRates();
          const parallelChanged = await fetchParallelRatesFromTelegram();
          
          if (officialChanged || parallelChanged) {
            console.log("[Startup] Initial changes detected! Saving to database...");
            const saveType = (officialChanged && parallelChanged) ? 'both' : (officialChanged ? 'official' : 'parallel');
            await saveToSupabase(saveType);
            broadcastRatesUpdate(rates);
          }
        }
      } catch (err) {
        console.error("[Startup] Error during initial update:", err);
      }
    })();
    
    // Auto-refresh rates every 10 minutes as long as server is awake
    setInterval(async () => {
      try {
        // Stop fetching and publishing between 12 AM (00:00) and 6 AM (06:00) Libya time
        const libyaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hour: 'numeric', hourCycle: 'h23' });
        const currentLibyaHour = parseInt(libyaFormatter.format(new Date()), 10);
        
        if (currentLibyaHour >= 1 && currentLibyaHour < 9) {
          console.log(`[Auto-Refresh] Skipping update during quiet hours (Current Hour: ${currentLibyaHour}:00 Libya Time). Market is sleeping.`);
          return;
        }

        console.log("[Auto-Refresh] Triggering automatic rates update...");
        const officialChanged = await fetchOfficialRates();
        const parallelChanged = await fetchParallelRatesFromTelegram();
        
        if (officialChanged || parallelChanged) {
          console.log("[Auto-Refresh] Changes detected! Saving to database...");
          const saveType = (officialChanged && parallelChanged) ? 'both' : (officialChanged ? 'official' : 'parallel');
          await saveToSupabase(saveType);
          broadcastRatesUpdate(rates);
        }
      } catch (err) {
        console.error("[Auto-Refresh] Error during automatic update:", err);
      }
    }, 10 * 60 * 1000);

    // Keep-alive ping for Render Free Tier (pings itself every 4 minutes)
    // This combined with external cron-job.org ensures 24/7 uptime
    setInterval(() => {
      const publicUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const url = `${publicUrl}/api/health`;
      console.log(`[Keep-Alive] Pinging ${url} to prevent hibernation...`);
      fetch(url).catch(() => {});
    }, 4 * 60 * 1000);
  });
}

// Global Reconnection Monitoring
let isMonitoring = false;
async function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  // Reduced frequency to avoid connection conflicts
  setInterval(async () => {
     try {
       // Only attempt if not already connected
       if (!activeClient || !activeClient.connected) {
         console.log("[Reconnector] Telegram disconnected or not initialized, attempting reconnect...");
         await initializeTelegram();
       }
     } catch (e) {
       console.warn("[Reconnector] Stealth reconnection failed, will retry next cycle.");
     }
  }, 15 * 60 * 1000); // 15 mins
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  if (activeClient) {
    try {
      console.log('Disconnecting Telegram Client...');
      await activeClient.disconnect();
    } catch (e) {}
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  
  if (activeClient) {
    try {
      console.log('Disconnecting Telegram Client...');
      await activeClient.disconnect();
    } catch (e) {}
  }
  process.exit(0);
});

startMonitoring();

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
