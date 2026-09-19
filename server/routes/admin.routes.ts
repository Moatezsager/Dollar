import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { db, supabase, supabaseAnonKey } from '../db';
import { appConfig, updateAppConfig, saveConfigToSupabase } from '../config';
import { rates, serverStartTime } from '../state';
import { isSignificantChange, obfuscateData } from '../utils/helpers';
import { requireAdmin, adminToken } from '../middleware/auth';
import { AppConfig, DeviceLogEntry, Rates } from '../types';
import {
  fetchOfficialRates,
  fetchParallelRatesFromTelegram,
  extractRatesFromText,
  liveFeed,
  clearLiveFeed,
  lastSuccessfulScrape,
  channelStatusTracker
} from '../services/scraper.service';
import {
  cleanupOldData,
  clearDbCache,
  logPriceChange,
  recentChangesLog,
  saveToSupabase,
  syncCheckRates,
  CHECK_TRIO
} from '../services/db.service';
import {
  broadcastOfficialRates,
  broadcastRateChanges,
  broadcastToSocialMedia,
  facebookBroadcastStatus,
  telegramBroadcastStatus,
  getOrInitTelegramManager,
  getRetryQueueCount
} from '../services/social.service';
import {
  getBroadcastLogPage,
  getBroadcastLogSummary
} from '../services/broadcastLog.service';
import { updateStats } from '../services/reporting.service';
import { activeClient } from '../../telegramClient';

export interface AdminRouterDeps {
  io?: any;
  publicApiLimiter?: any;
  getPublicApiLimiter?: () => any;
  getUserLogs: () => DeviceLogEntry[];
  clearUserLogs: () => void;
  getOnlineUsers: () => number;
  apiStats: any;
  broadcastRatesUpdate: (rates: Rates) => void;
  broadcastConfigUpdate: () => void;
  broadcastUserLogs: () => void;
}

export function createAdminRouter(deps: AdminRouterDeps): express.Router {
  const router = express.Router();
  const tempClients: Record<string, { client: TelegramClient, apiId: number, apiHash: string }> = {};

  // Login endpoint - public (within admin context)
  router.post('/login', (req: express.Request, res: express.Response) => {
    const { password } = req.body;
    const effectiveAdminPassword = process.env.ADMIN_PASSWORD;
    if (password === effectiveAdminPassword) {
      res.json({ success: true, token: adminToken });
    } else {
      res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
    }
  });

  // Protect all remaining admin routes
  router.use(requireAdmin);

  // Messages management
  router.get('/messages', (req: express.Request, res: express.Response) => {
    try {
      const stmt = db.prepare('SELECT * FROM messages ORDER BY created_at DESC');
      const messages = stmt.all();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "حدث خطأ أثناء جلب الرسائل" });
    }
  });

  router.put('/messages/:id/status', (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['new', 'read', 'replied'].includes(status)) {
        return res.status(400).json({ error: "حالة غير صالحة" });
      }

      const stmt = db.prepare('UPDATE messages SET status = ? WHERE id = ?');
      stmt.run(status, id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تحديث حالة الرسالة" });
    }
  });

  router.delete('/messages/:id', (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
      stmt.run(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "حدث خطأ أثناء حذف الرسالة" });
    }
  });

  // API Stats & Config
  router.get('/api-stats', (req: express.Request, res: express.Response) => {
    res.json(deps.apiStats);
  });

  router.post('/api-config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body;
      appConfig.apiConfig = {
        ...appConfig.apiConfig,
        ...newConfig,
      };
      
      const limiter = deps.getPublicApiLimiter ? deps.getPublicApiLimiter() : deps.publicApiLimiter;
      if (limiter) {
        (limiter as any).windowMs = appConfig.apiConfig?.rateLimitWindowMs || 60000;
        (limiter as any).max = appConfig.apiConfig?.rateLimitMaxRequests || 20;
      }
      await saveConfigToSupabase(appConfig);
      res.json({ success: true, config: appConfig.apiConfig });
    } catch (err) {
      console.error("Error updating API config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Failed to update API config" });
      }
    }
  });

  // Diagnostics
  router.get('/diagnostics', async (req: express.Request, res: express.Response) => {
    try {
      const dbStatus = await supabase?.from('logs').select('id').limit(1).then(() => true) || false;
      const tgMgr = getOrInitTelegramManager();
      const telegramStatus = tgMgr ? true : false;
      
      let regexStatus = true;
      try {
        appConfig.terms.forEach(t => new RegExp(t.regex, 'i'));
      } catch (e) {
        regexStatus = false;
      }

      const allGood = dbStatus && telegramStatus && regexStatus;
      
      res.json({
        success: true,
        status: allGood ? 'ok' : 'error',
        db: dbStatus ? 'ok' : 'error',
        telegram: telegramStatus ? 'ok' : 'error',
        regex: regexStatus ? 'ok' : 'error'
      });
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: String(e) });
      }
    }
  });

  // Queue & RAM
  router.post('/clear-queue', (req: express.Request, res: express.Response) => {
    clearLiveFeed();
    res.json({ success: true, message: "تم تفريغ الطابور والرسائل المعلقة بنجاح ✅" });
  });

  router.post('/clear-ram', (req: express.Request, res: express.Response) => {
    try {
      if ((global as any).gc) {
        (global as any).gc();
        res.json({ success: true, message: "تم تنظيف الذاكرة العشوائية (RAM) بنجاح ✅" });
      } else {
        res.json({ success: true, message: "تم تنظيف الكاش الداخلي بنجاح ✅ (GC غير مفعل)" });
      }
    } catch (e) {
      res.json({ success: true, message: "تم تنظيف الكاش الداخلي بنجاح ✅" });
    }
  });

  // Live Feed
  router.get('/live-feed', (req: express.Request, res: express.Response) => {
    res.json({ success: true, feed: liveFeed });
  });

  // Manual Extract
  router.post('/manual-extract', async (req: express.Request, res: express.Response) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Text is required" });
    
    const cleanText = text;
    const rawExtracted = extractRatesFromText(cleanText);
    
    // Filter to keep only specific gold/metals if the term is a metal, while keeping other currencies
    const ALLOWED_GOLD_IDS = [
      "GOLD_CAST_18",
      "GOLD_EXT_18",
      "GOLD_EXT_21",
      "GOLD_SCRAP_18",
      "GOLD_SCRAP_21",
      "GOLD_CAST_24",
      "GOLD_LIRA_8G",
      "GOLD_LIRA_14G",
      "GOLD_MUJARA_14G",
      "SILVER_CAST_1000"
    ];
    const extracted = rawExtracted.filter(item => {
      const isMetal = item.code === "GOLD" || item.code.startsWith("GOLD_") || item.code.startsWith("SILVER_");
      if (isMetal) {
        return ALLOWED_GOLD_IDS.includes(item.code);
      }
      return true;
    });
    
    if (extracted.length === 0) {
      return res.json({ success: false, message: "لم يتم العثور على أي أسعار في هذا النص" });
    }
    
    let anyChanged = false;
    const manualUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
    for (const item of extracted) {
      const currentVal = rates.parallel[item.code];
      const term = appConfig.terms.find(t => t.id === item.code);
      const hasChanged = true; // يتم معاملة جميع المدخلات اليدوية كتغييرات حقيقية لحفظها ونشرها فوراً بدون شروط
      if (hasChanged) {
        rates.previousParallel[item.code] = currentVal !== item.value ? (currentVal || item.value) : (rates.previousParallel[item.code] || currentVal || item.value);
        rates.parallel[item.code] = item.value;
        rates.lastChanged.parallel[item.code] = new Date().toISOString();
        anyChanged = true;
      }
      if (term) {
        manualUpdates.push({
          id: item.code,
          name: term.name,
          oldVal: rates.previousParallel[item.code] || currentVal || item.value,
          newVal: item.value,
          flag: term.flag
        });
      }
    }
    
    if (anyChanged || manualUpdates.length > 0) {
      await syncCheckRates("استخراج المشرف");
      await saveToSupabase();
      deps.broadcastRatesUpdate(rates);

      if (manualUpdates.length > 0) {
        broadcastRateChanges(manualUpdates, false, 'all', true).catch(e => {
          console.error("[Manual Extract Broadcast Error]:", e);
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `تم استخراج ${extracted.length} أسعار بنجاح ✅`,
      extracted 
    });
  });

  // App Config
  router.get('/config', (req: express.Request, res: express.Response) => {
    res.json({ ...appConfig, serverStartTime: serverStartTime.toISOString(), facebookBroadcastStatus, telegramBroadcastStatus });
  });

  router.post('/config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body as AppConfig;
      if (!newConfig.channels || !newConfig.terms) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
      }
      updateAppConfig(newConfig);
      const saved = await saveConfigToSupabase(appConfig);
      
      const parallelTally = await fetchParallelRatesFromTelegram();
      if (parallelTally) {
        await saveToSupabase('parallel');
        deps.broadcastRatesUpdate(rates);
      }
      
      deps.broadcastConfigUpdate();
      res.json({ success: true, message: saved ? "تم حفظ الإعدادات بنجاح" : "تم حفظ الإعدادات وتطبيقها بنجاح (وضع الذاكرة المؤقتة)" });
    } catch (err) {
      console.error("Error saving config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "حدث خطأ أثناء الحفظ" });
      }
    }
  });

  // User tracking
  router.get('/tracking/logs', (req: express.Request, res: express.Response) => {
    res.json({ success: true, logs: deps.getUserLogs() });
  });

  router.post('/tracking/toggle', async (req: express.Request, res: express.Response) => {
    appConfig.enableUserTracking = !appConfig.enableUserTracking;
    await saveConfigToSupabase(appConfig);
    deps.broadcastConfigUpdate();
    res.json({ success: true, enabled: appConfig.enableUserTracking });
  });

  router.post('/tracking/clear', (req: express.Request, res: express.Response) => {
    deps.clearUserLogs();
    deps.broadcastUserLogs();
    res.json({ success: true, message: "تم مسح سجل المتصلين بنجاح" });
  });

  // Telegram MTProto Auth
  router.post('/telegram/send-code', async (req: express.Request, res: express.Response) => {
    try {
      const { phoneNumber, apiId, apiHash } = req.body;
      if (!phoneNumber || !apiId || !apiHash) {
        return res.status(400).json({ success: false, message: "بيانات غير مكتملة" });
      }

      const stringSession = new StringSession("");
      const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
        connectionRetries: 5,
        useWSS: false,
        deviceModel: "PriceScraperServer",
        systemVersion: "1.0.0",
        appVersion: "1.0",
      });

      await client.connect();
      
      const sendCodeResult = await client.sendCode(
        {
          apiId: Number(apiId),
          apiHash: apiHash,
        },
        phoneNumber
      );

      const authId = Math.random().toString(36).substring(7);
      tempClients[authId] = { client, apiId: Number(apiId), apiHash };

      res.json({ 
        success: true, 
        phoneCodeHash: sendCodeResult.phoneCodeHash,
        authId: authId
      });
    } catch (err: any) {
      console.error("Telegram send code error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message || "فشل إرسال الكود" });
      }
    }
  });

  router.post('/telegram/verify-code', async (req: express.Request, res: express.Response) => {
    try {
      const { phoneNumber, phoneCodeHash, code, password, authId } = req.body;
      
      const sessionData = tempClients[authId];
      if (!sessionData) {
        return res.status(400).json({ success: false, message: "جلسة التحقق غير صالحة أو منتهية" });
      }

      const { client, apiId, apiHash } = sessionData;
      await client.invoke(new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code
      })).catch(async (err: any) => {
        if (err.message.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
             throw new Error("كلمة مرور التحقق بخطوتين (2FA) مطلوبة");
          }
          await client.signInWithPassword(
            { apiId, apiHash }, 
            { 
              password: async () => password, 
              onError: (e) => { throw e; } 
            }
          );
        } else {
          throw err;
        }
      });

      const sessionString = (client.session as StringSession).save();
      
      try {
        await client.disconnect();
      } catch (e) {
        console.error("Error disconnecting temp client:", e);
      }
      
      delete tempClients[authId];

      res.json({ 
        success: true, 
        sessionString: sessionString 
      });
    } catch (err: any) {
      console.error("Telegram verify code error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message || "فشل التحقق من الكود" });
      }
    }
  });

  // Manual Refresh
  router.post('/refresh', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual refresh triggered`);
      const officialUpdate = await fetchOfficialRates();
      const parallelTally = await fetchParallelRatesFromTelegram();
      
      if (officialUpdate || parallelTally) {
        console.log("[Admin] Changes detected! Saving to database...");
        const saveType = (officialUpdate && parallelTally) ? 'both' : (officialUpdate ? 'official' : 'parallel');
        await saveToSupabase(saveType);
        deps.broadcastRatesUpdate(rates);
      }
      
      res.json({ 
        success: true, 
        message: "تم تشغيل عملية التحديث بنجاح",
        details: {
          official: officialUpdate ? "تم التحديث" : "لا يوجد تغيير",
          parallel: parallelTally ? "تم التحديث" : "لا يوجد تغيير"
        }
      });
    } catch (err) {
      console.error("Manual refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل التحديث اليدوي" });
      }
    }
  });

  // Manual Official Rates Refresh (Admin Auth)
  router.post('/refresh-official', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual official rates refresh triggered`);
      const officialUpdate = await fetchOfficialRates();
      if (officialUpdate) {
        await saveToSupabase('official');
        deps.broadcastRatesUpdate(rates);
      }
      res.json({ 
        success: true, 
        message: "تم تحديث السعر الرسمي بنجاح", 
        updated: officialUpdate 
      });
    } catch (err) {
      console.error("Manual official refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل التحديث اليدوي للسعر الرسمي" });
      }
    }
  });

  // Analytics Dashboard Data
  router.get('/analytics', async (req: express.Request, res: express.Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffIso = cutoff.toISOString();

      let events: any[] = [];
      let loadedFromSupabase = false;

      if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
        try {
          const { data, error } = await supabase
            .from('analytics_events')
            .select('*')
            .gte('created_at', cutoffIso)
            .order('created_at', { ascending: true });
          
          if (!error && data) {
            events = data;
            loadedFromSupabase = true;
          } else if (error) {
            console.error("[Analytics] Supabase query error, falling back to SQLite:", error.message);
          }
        } catch (err) {
          console.error("[Analytics] Supabase query exception, falling back to SQLite:", err);
        }
      }

      if (!loadedFromSupabase) {
        events = db.prepare(`
          SELECT * FROM analytics_events 
          WHERE created_at >= ?
          ORDER BY created_at ASC
        `).all(cutoffIso) as any[];
      }

      const dailyStatsMap: Record<string, { pageviews: number, uniqueVisitors: Set<string> }> = {};
      const deviceTypes: Record<string, number> = {};
      const browsers: Record<string, number> = {};
      const os: Record<string, number> = {};
      
      const allUniqueVisitors = new Set<string>();

      events.forEach(e => {
        const dateStr = e.created_at.split(' ')[0] || e.created_at.split('T')[0];
        if (!dailyStatsMap[dateStr]) { 
          dailyStatsMap[dateStr] = { pageviews: 0, uniqueVisitors: new Set() };
        }
        
        dailyStatsMap[dateStr].pageviews++;
        dailyStatsMap[dateStr].uniqueVisitors.add(e.visitor_id);
        allUniqueVisitors.add(e.visitor_id);
        
        deviceTypes[e.device_type] = (deviceTypes[e.device_type] || 0) + 1;
        
        const bName = e.browser_name || 'Unknown';
        browsers[bName] = (browsers[bName] || 0) + 1;
        
        const oName = e.os_name || 'Unknown';
        os[oName] = (os[oName] || 0) + 1;
      });

      const trend = Object.keys(dailyStatsMap).map(date => ({
        date,
        pageviews: dailyStatsMap[date].pageviews,
        visitors: dailyStatsMap[date].uniqueVisitors.size
      }));

      res.json({
        success: true,
        summary: {
          totalPageviews: events.length,
          totalVisitors: allUniqueVisitors.size,
        },
        trend,
        deviceTypes,
        browsers,
        os
      });
    } catch (err) {
      console.error("[Analytics] Error fetching dashboard data:", err);
      res.status(500).json({ success: false });
    }
  });

  // Manual Cleanup
  router.post('/cleanup', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual cleanup triggered by admin session`);
      await cleanupOldData(deps.clearUserLogs);
      res.json({ success: true, message: "تم تنظيف البيانات القديمة بنجاح" });
    } catch (err) {
      console.error("Manual cleanup failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل تنظيف البيانات" });
      }
    }
  });

  // Stats
  router.get('/stats', async (req: express.Request, res: express.Response) => {
    try {
      const minutesSinceLastScrape = Math.floor((Date.now() - lastSuccessfulScrape.getTime()) / 60000);
      
      let totalInstalls = 0;
      let installsToday = 0;
      try {
        const installsRes = db.prepare('SELECT COUNT(*) as count FROM installs').get() as {count: number};
        if (installsRes) totalInstalls = installsRes.count;
        
        const todayStr = new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString().split('T')[0];
        const installsTodayRes = db.prepare('SELECT COUNT(*) as count FROM installs WHERE created_at LIKE ?').get(`${todayStr}%`) as {count: number};
        if (installsTodayRes) installsToday = installsTodayRes.count;
      } catch (err) {
        console.error("Error fetching install stats:", err);
      }
      
      let dbStats = {
        parallelRatesCount: 0,
        officialRatesCount: 0,
        errorLogsCount: 0,
        priceChangesCount: 0
      };

      if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
        try {
          const [parallel, official, logs, changes] = await Promise.all([
            supabase.from('parallel_rates').select('*', { count: 'exact', head: true }),
            supabase.from('official_rates').select('*', { count: 'exact', head: true }),
            supabase.from('error_logs').select('*', { count: 'exact', head: true }),
            supabase.from('price_changes_log').select('*', { count: 'exact', head: true })
          ]);
          dbStats = {
            parallelRatesCount: parallel.count || 0,
            officialRatesCount: official.count || 0,
            errorLogsCount: logs.count || 0,
            priceChangesCount: changes.count || 0
          };
        } catch (e) {
          console.error("Failed to fetch DB stats:", e);
        }
      }

      const memory = process.memoryUsage();
      res.json({
        onlineUsers: deps.getOnlineUsers(),
        lastSuccessfulScrape: lastSuccessfulScrape.toISOString(),
        minutesSinceLastScrape,
        isStale: minutesSinceLastScrape > 30,
        channelsCount: appConfig.channels?.length || 0,
        termsCount: appConfig.terms?.length || 0,
        serverStartTime: serverStartTime.toISOString(),
        memoryUsage: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal
        },
        installs: {
          total: totalInstalls,
          today: installsToday
        },
        dbStats: {
          parallelRatesCount: dbStats.parallelRatesCount,
          officialRatesCount: dbStats.officialRatesCount,
          errorLogsCount: dbStats.errorLogsCount,
          priceChangesCount: dbStats.priceChangesCount
        },
        database: dbStats,
        channels: channelStatusTracker
      });
    } catch (err) {
      console.error("Error generating admin stats:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل توليد الإحصائيات" });
      }
    }
  });

  // Records management
  router.get('/records/:market/:currency', async (req: express.Request, res: express.Response) => {
    const { market, currency } = req.params;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id, recorded_at, rates')
        .order('recorded_at', { ascending: false })
        .limit(500);
        
      if (error) throw error;
      
      const records = data.map(row => ({
        id: row.id,
        recorded_at: row.recorded_at,
        value: row.rates ? row.rates[currency] : null
      })).filter(r => r.value !== null && r.value !== undefined);
      
      res.json({ success: true, records });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  router.put('/records/:market/:id', async (req: express.Request, res: express.Response) => {
    const { market, id } = req.params;
    const { currency, value } = req.body;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { data: existing, error: fetchError } = await supabase
        .from(table)
        .select('rates')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      const updatedRates = { ...existing.rates, [currency]: parseFloat(value) };
      
      const { error: updateError } = await supabase
        .from(table)
        .update({ rates: updatedRates })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      clearDbCache();
      
      try {
        const { data: latestRecord } = await supabase
          .from(table)
          .select('rates, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();
          
        if (latestRecord && latestRecord.rates) {
          if (market === 'official') {
             rates.official = { ...rates.official, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.official = latestRecord.recorded_at;
          } else {
             const oldVal = rates.parallel[currency] || existing.rates?.[currency] || parseFloat(value);
             const newVal = parseFloat(value);
             rates.parallel = { ...rates.parallel, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.parallel = latestRecord.recorded_at;
             
             const term = appConfig.terms.find(t => t.id === currency);
             if (term && Math.abs(newVal - oldVal) > 0.0001) {
                broadcastRateChanges([{
                   id: currency,
                   name: term.name,
                   oldVal: oldVal,
                   newVal: newVal,
                   flag: term.flag
                }], false, 'all').catch(console.error);
             }
             await syncCheckRates("تعديل السجل");
          }
          deps.broadcastRatesUpdate(rates);
        }
      } catch (syncErr) {
        console.error("Error resyncing cache after update:", syncErr);
      }
      
      res.json({ success: true, message: "تم تحديث السجل بنجاح" });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  router.delete('/records/:market/:id', async (req: express.Request, res: express.Response) => {
    const { market, id } = req.params;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      clearDbCache();
      
      try {
        const { data: latestRecord } = await supabase
          .from(table)
          .select('rates, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();
          
        if (latestRecord && latestRecord.rates) {
          if (market === 'official') {
             rates.official = { ...rates.official, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.official = latestRecord.recorded_at;
          } else {
             rates.parallel = { ...rates.parallel, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.parallel = latestRecord.recorded_at;
          }
          deps.broadcastRatesUpdate(rates);
        }
      } catch (syncErr) {
        console.error("Error resyncing cache after delete:", syncErr);
      }
      
      res.json({ success: true, message: "تم حذف السجل بنجاح" });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  // System Report
  router.get('/system-report', async (req, res) => {
    try {
      const minutesSinceLastScrape = Math.floor((Date.now() - lastSuccessfulScrape.getTime()) / 60000);
      
      let totalInstalls = 0;
      let installsToday = 0;
      try {
        const installsRes = db.prepare('SELECT COUNT(*) as count FROM installs').get() as {count: number};
        if (installsRes) totalInstalls = installsRes.count;
        
        const todayStr = new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString().split('T')[0];
        const installsTodayRes = db.prepare('SELECT COUNT(*) as count FROM installs WHERE created_at LIKE ?').get(`${todayStr}%`) as {count: number};
        if (installsTodayRes) installsToday = installsTodayRes.count;
      } catch (err) {
        console.error("Error fetching install stats:", err);
      }
      
      let recentErrors: any[] = [];
      let dbStats = null;
      if (supabase && process.env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY.includes('dummy')) {
        try {
          const { data: logs } = await supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(20);
          if (logs) recentErrors = logs;
          
          const pingStart = Date.now();
          const [parallel, official, errorLogsQuery] = await Promise.all([
            supabase.from('parallel_rates').select('*', { count: 'exact', head: true }),
            supabase.from('official_rates').select('*', { count: 'exact', head: true }),
            supabase.from('error_logs').select('*', { count: 'exact', head: true })
          ]);
          const ping_ms = Date.now() - pingStart;
          dbStats = {
            parallel_rates: parallel.count || 0,
            official_rates: official.count || 0,
            error_logs_count: errorLogsQuery.count || 0,
            ping_ms
          };
        } catch (e) {}
      }

      const memory = process.memoryUsage();
      const report = {
        generated_at: new Date().toISOString(),
        system_health: {
          uptime_hours: (process.uptime() / 3600).toFixed(2),
          server_start_time: serverStartTime.toISOString(),
          memory_mb: {
            rss: Math.round(memory.rss / 1024 / 1024),
            heap_total: Math.round(memory.heapTotal / 1024 / 1024),
            heap_used: Math.round(memory.heapUsed / 1024 / 1024)
          },
          node_version: process.version
        },
        database_status: {
          supabase_connected: !!(supabase && process.env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY.includes('dummy')),
          stats: dbStats
        },
        scraper_status: {
          last_successful_scrape: lastSuccessfulScrape.toISOString(),
          minutes_since_last_scrape: minutesSinceLastScrape,
          is_stale: minutesSinceLastScrape > 30,
          channels_count: appConfig.channels.length,
          terms_count: appConfig.terms.length
        },
        telegram_status: {
          is_authenticated: !!activeClient
        },
        network_stats: {
          public_api_requests: deps.apiStats.public.totalRequests,
          premium_api_requests: deps.apiStats.premium.totalRequests,
          banned_ips_count: deps.apiStats.bannedIPsCount,
          active_websocket_connections: deps.io?.engine ? deps.io.engine.clientsCount : 0,
          unique_visitors_tracked: deps.getUserLogs().length
        },
        installs: {
          total: totalInstalls,
          today: installsToday
        },
        recent_errors: recentErrors
      };

      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to generate system report", details: e.message });
    }
  });

  // Error Logs
  router.delete('/error-logs', async (req: express.Request, res: express.Response) => {
    try {
      if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
        return res.status(400).json({ success: false, message: "قاعدة بيانات Supabase غير متصلة" });
      }
      const { error } = await supabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      res.json({ success: true, message: "تم مسح جميع سجلات الأخطاء بنجاح" });
    } catch (err: any) {
      console.error("Error deleting error logs:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message || "فشل مسح السجلات" });
      }
    }
  });

  router.get('/error-logs', async (req: express.Request, res: express.Response) => {
    try {
      if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
        return res.json({ success: true, logs: [] });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      
      res.json({ success: true, logs: data || [] });
    } catch (err: any) {
      console.error("Error fetching error logs:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message || "فشل جلب السجلات" });
      }
    }
  });

  // Essale Fetch
  router.post('/fetch-essale', async (req: express.Request, res: express.Response) => {
    try {
      const response = await fetch("https://essale.ly/api/tick?fbclid=IwZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPMjc1MjU0NjkyNTk4Mjc5AAEewyFcX9XSJyGppLrX8mTzJ93xM3OWsx5NXnMmXZIKhCsJGfiW1pNkKU2kwnk_aem_5dOdrJMZDqyD8p_DDrntEw");
      const data = await response.json();
      
      const mapping: Record<string, string> = {
        "USD": "USD",
        "CJM": "USD_AE",
        "TUR": "TRY",
        "TUN": "TND",
        "EUR": "EUR",
        "GBP": "GBP",
        "EGP": "EGP",
        "CTT": "JOD",
        "GOLD": "GOLD_SCRAP_18",
        "SLVR": "SILVER_SCRAP"
      };
      
      const extractedRates: Record<string, number> = {};
      const extractedDates: Record<string, string> = {};
      
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const internalCode = mapping[item.n];
          if (internalCode && item.v) {
            extractedRates[internalCode] = parseFloat(item.v);
            if (item.d) {
              extractedDates[internalCode] = item.d;
            }
          }
        });
      }

      if (Object.keys(extractedRates).length > 0) {
        res.json({ success: true, extractedRates, extractedDates });
      } else {
        res.json({ success: false, message: "لم يتم العثور على أسعار مطابقة" });
      }
    } catch (err: any) {
      console.error("Essale fetch failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ في جلب البيانات: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  // Extract from text
  router.post('/extract', async (req: express.Request, res: express.Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, message: "No text provided" });
      }
      
      const extractedRates: Record<string, number> = {};
      const extractedDates: Record<string, string> = {};
      const rawResults = extractRatesFromText(text);
      
      // Filter to keep only specific gold/metals if the term is a metal, while keeping other currencies
      const ALLOWED_GOLD_IDS = [
        "GOLD_CAST_18",
        "GOLD_EXT_18",
        "GOLD_EXT_21",
        "GOLD_SCRAP_18",
        "GOLD_SCRAP_21",
        "GOLD_CAST_24",
        "GOLD_LIRA_8G",
        "GOLD_LIRA_14G",
        "GOLD_MUJARA_14G",
        "SILVER_CAST_1000"
      ];
      const results = rawResults.filter(item => {
        const isMetal = item.code === "GOLD" || item.code.startsWith("GOLD_") || item.code.startsWith("SILVER_");
        if (isMetal) {
          return ALLOWED_GOLD_IDS.includes(item.code);
        }
        return true;
      });
      
      for (const item of results) {
        extractedRates[item.code] = item.value;
        if (item.date) {
          extractedDates[item.code] = item.date;
        }
      }

      if (Object.keys(extractedRates).length > 0) {
        res.json({ success: true, extractedRates, extractedDates });
      } else {
        res.json({ success: false, message: "لم يتمكن النظام من استخراج أي أسعار من النص المدخل" });
      }
    } catch (err: any) {
      console.error("Extraction failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ في الاستخراج: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  // Manual Rates update
  router.post('/rates', async (req: express.Request, res: express.Response) => {
    try {
      const { updates } = req.body;
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: "Invalid updates object" });
      }

      let anyChanged = false;
      let checkPriceUpdate: number | null = null;
      let checkOldPrice: number | null = null;
      const changedCurrencies: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];

      for (const [code, value] of Object.entries(updates)) {
        const numVal = parseFloat(value as string);
        if (isNaN(numVal) || numVal <= 0) continue;

        // التقاط أي تحديث يخص ثلاثي الصكوك
        if (code === 'USD_CHECKS' || code === 'USD_JBANK' || code === 'USD_NCB') {
          checkPriceUpdate = numVal;
        }

        const term = appConfig.terms.find(t => t.id === code);
        const currentVal = rates.parallel[code];
        const hasChanged = true; // معاملة المدخلات اليدوية كتعديلات معتمدة ومطلوبة للنشر فوراً
        
        if (hasChanged) {
          rates.previousParallel[code] = currentVal !== numVal ? (currentVal || numVal) : (rates.previousParallel[code] || currentVal || numVal);
          rates.parallel[code] = numVal;
          rates.lastChanged.parallel[code] = new Date().toISOString();
          anyChanged = true;
          
          updateStats(code, numVal);

          const changeLog = {
            id: Math.random().toString(36).substring(2, 9),
            currencyCode: code,
            currencyName: term ? term.name : code,
            oldPrice: currentVal || 0,
            newPrice: numVal,
            source: "تعديل يدوي من المشرف",
            timestamp: new Date().toISOString()
          };
          await logPriceChange(changeLog);
        }

        // استبعاد صكوك الجمهورية والتجاري من قائمة النشر، والاحتفاظ بـ USD_CHECKS فقط
        if (code === 'USD_CHECKS' || code === 'USD_JBANK' || code === 'USD_NCB') {
          if (checkOldPrice === null) checkOldPrice = currentVal || numVal;
        } else if (term) {
          // في التحديث اليدوي / مستخرج النصوص: نضيف العملة أو المعدن لقائمة النشر
          const oldVal = hasChanged 
            ? (currentVal || numVal) 
            : (rates.previousParallel[code] || currentVal || numVal);

          changedCurrencies.push({
            id: code,
            name: term.name,
            oldVal: oldVal,
            newVal: numVal,
            flag: term.flag
          });
        }
      }

      // المزامنة الفورية لثلاثي الصكوك (دولار صكوك، صكوك تجاري، صكوك جمهورية)
      if (checkPriceUpdate !== null) {
        const synced = await syncCheckRates("تعديل يدوي من المشرف", checkPriceUpdate);
        if (synced) anyChanged = true;

        changedCurrencies.push({
          id: 'USD_CHECKS',
          name: 'دولار أمريكي (صكوك)',
          oldVal: checkOldPrice !== null ? checkOldPrice : checkPriceUpdate,
          newVal: checkPriceUpdate,
          flag: 'us'
        });
      }

      if (anyChanged || changedCurrencies.length > 0) {
        rates.lastUpdated = new Date().toISOString();
        await saveToSupabase('parallel');
        deps.broadcastRatesUpdate(rates);

        if (changedCurrencies.length > 0) {
          console.log(`[Admin Update] Broadcasting ${changedCurrencies.length} manual updates to social media (bypassing all conditions)...`);
          try {
            await broadcastRateChanges(changedCurrencies, false, 'all', true);
          } catch (err) {
            console.error("[Admin Update] Social broadcast failed:", err);
          }
        }
      }

      res.json({ 
        success: true, 
        message: anyChanged || changedCurrencies.length > 0
          ? `تم تحديث الأسعار وحفظها ونشرها تلقائياً للمتابعين بنجاح (${changedCurrencies.length} صنف/عملة)` 
          : "لم يتم تحديد أي أسعار صالحة للحفظ" 
      });
    } catch (err: any) {
      console.error("Rates update failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ أثناء الحفظ: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  // Telegram official broadcast
  router.post('/telegram/official-broadcast', async (req: express.Request, res: express.Response) => {
    try {
      const manager = getOrInitTelegramManager();
      if (!manager) {
        return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
      }
      
      const { channel } = req.body;
      const targetChannel = channel || appConfig.telegramPostChannel;
      
      if (!targetChannel) {
         return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
      }
      
      const originalChannel = appConfig.telegramPostChannel;
      appConfig.telegramPostChannel = targetChannel;
      
      await broadcastOfficialRates(true);
      
      appConfig.telegramPostChannel = originalChannel;
      
      res.json({ success: true, message: "تم إرسال أسعار المصرف المركزي بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to broadcast official rates" });
    }
  });

  // Telegram test broadcast
  router.post('/telegram/test-broadcast', async (req: express.Request, res: express.Response) => {
    try {
      const manager = getOrInitTelegramManager();
      if (!manager) {
        return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
      }
      
      const { channel } = req.body;
      const targetChannel = channel || appConfig.telegramPostChannel;
      
      if (!targetChannel) {
         return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
      }
      
      const originalChannel = appConfig.telegramPostChannel;
      appConfig.telegramPostChannel = targetChannel;
      
      const sampleUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
      for (const t of appConfig.terms) {
        const currentR = rates.parallel[t.id];
        const prevR = rates.previousParallel[t.id];
        if (currentR) {
          sampleUpdates.push({ 
            id: t.id,
            name: t.name, 
            oldVal: prevR || currentR, 
            newVal: currentR, 
            flag: t.flag || 'us' 
          });
        }
      }
      
      if (sampleUpdates.length === 0) {
        return res.status(400).json({ success: false, error: "لا توجد أسعار متاحة لإرسالها." });
      }
      
      await broadcastRateChanges(sampleUpdates, true, 'telegram');
      
      appConfig.telegramPostChannel = originalChannel;
      
      res.json({ success: true, message: "تم إرسال رسالة تجريبية" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to broadcast" });
    }
  });

  // Facebook test broadcast
  router.post('/facebook/test-broadcast', async (req: express.Request, res: express.Response) => {
    try {
      if (!appConfig.facebookPageId || !appConfig.facebookAccessToken) {
         return res.status(400).json({ success: false, error: "بيانات فيسبوك غير مكتملة. يرجى حفظ الإعدادات أولاً." });
      }
      
      const sampleUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
      for (const t of appConfig.terms) {
        const currentR = rates.parallel[t.id];
        const prevR = rates.previousParallel[t.id];
        if (currentR) {
          sampleUpdates.push({ 
            id: t.id,
            name: t.name, 
            oldVal: prevR || currentR, 
            newVal: currentR, 
            flag: t.flag || 'us' 
          });
        }
      }
      
      if (sampleUpdates.length === 0) {
        return res.status(400).json({ success: false, error: "لا توجد أسعار متاحة لإرسالها." });
      }
      
      await broadcastRateChanges(sampleUpdates, true, 'facebook');
      
      res.json({ success: true, message: "تم إرسال رسالة تجريبية إلى فيسبوك بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to broadcast to Facebook" });
    }
  });

  // AI Market Analysis
  router.post('/telegram/generate-analysis', async (req: express.Request, res: express.Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ success: false, error: "Gemini API Key is not configured." });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const updates = [];
      const termsToInclude = ["USD", "EUR", "GBP", "TND", "EGP"];
      for (const t of appConfig.terms) {
        if (termsToInclude.includes(t.id)) {
           const currentR = rates.parallel[t.id];
           const prevR = rates.previousParallel[t.id];
           if (currentR) {
              updates.push(`- ${t.name}: السعر الحالي ${currentR.toFixed(3)} ${prevR && currentR !== prevR ? '(كان '+prevR.toFixed(3)+')' : ''}`);
           }
        }
      }

      const prompt = `أنت خبير اقتصادي ومحلل مالي ليبي متخصص في سوق العملات ومؤشر الدينار الليبي. بناءً على التغيرات التالية في أسعار الصرف في السوق الموازي:
${updates.join('\n')}
قم بكتابة نبذة أو تعليق مختصر (بحد أقصى 3-4 أسطر) يصف حالة السوق (استقرار، صعود، أو هبوط) بلهجة ليبية عامية محترفة ولبقة.
يجب أن تكون جذابة وصالحة للنشر بقناة تيليجرام.
لا تستخدم أي مقدمات أو خاتمات زائدة من قبيل "حسنا سأقوم بذلك"، فقط الجملة التحليلية المطلوبة. ولا تذكر الأسعار مرة أخرى بالتفصيل بل تحدث عن الاتجاه العام (مثلا السوق راكد، الدولار طاير، اليورو طايح، وهكذا).`;

      const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: prompt
      });
      
      const text = response.text;
      
      let finalMessage = `📊 *رؤية السوق* 📊\n`;
      finalMessage += `━━━━━━━━━━━━━━━━━\n`;
      finalMessage += `${text?.trim()}\n`;
      finalMessage += `━━━━━━━━━━━━━━━━━\n`;
      finalMessage += `🔗 تابع التحديثات الحية على منصتنا:\n🌐 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}\n\n`;
      finalMessage += `📱 المصدر: شبكة مراسلي مؤشر الدينار | الدقة والسرعة`;

      res.json({ success: true, message: finalMessage });
    } catch (err: any) {
      console.error('Error generating analysis:', err);
      res.status(500).json({ success: false, error: err.message || "Failed to generate analysis" });
    }
  });

  router.post('/telegram/publish-analysis', async (req: express.Request, res: express.Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ success: false, error: "Gemini API Key is not configured." });
      }
      
      const { channel } = req.body;
      const targetChannel = channel || appConfig.telegramPostChannel;
      
      if (!targetChannel) {
         return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
      }
      
      const tgMgr = getOrInitTelegramManager();
      if (!tgMgr) {
        return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
      }

      const updates = [];
      const termsToInclude = ["USD", "EUR", "GBP", "TND", "EGP"];
      for (const t of appConfig.terms) {
        if (termsToInclude.includes(t.id)) {
           const currentR = rates.parallel[t.id];
           const prevR = rates.previousParallel[t.id];
           if (currentR) {
              updates.push(`- ${t.name}: السعر الحالي ${currentR.toFixed(3)} ${prevR && currentR !== prevR ? '(كان '+prevR.toFixed(3)+')' : ''}`);
           }
        }
      }

      const prompt = `أنت خبير اقتصادي ومحلل مالي ليبي متخصص في سوق العملات ومؤشر الدينار الليبي. بناءً على التغيرات التالية في أسعار الصرف في السوق الموازي:
${updates.join('\n')}
قم بكتابة نبذة أو تعليق مختصر (بحد أقصى 3-4 أسطر) يصف حالة السوق (استقرار، صعود، أو هبوط) بلهجة ليبية عامية محترفة ولبقة.
يجب أن تكون جذابة وصالحة للنشر بقناة تيليجرام.
لا تستخدم أي مقدمات أو خاتمات زائدة من قبيل "حسنا سأقوم بذلك"، فقط الجملة التحليلية المطلوبة. ولا تذكر الأسعار مرة أخرى بالتفصيل بل تحدث عن الاتجاه العام (مثلا السوق راكد، الدولار طاير، اليورو طايح، وهكذا).`;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: prompt
      });
      
      const text = response.text;
      
      let finalMessage = `📊 *رؤية السوق* 📊\n`;
      finalMessage += `━━━━━━━━━━━━━━━━━\n`;
      finalMessage += `${text?.trim()}\n`;
      finalMessage += `━━━━━━━━━━━━━━━━━\n`;
      finalMessage += `🔗 تابع التحديثات الحية على منصتنا:\n🌐 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}\n\n`;
      finalMessage += `📱 المصدر: شبكة مراسلي مؤشر الدينار | الدقة والسرعة`;

      await broadcastToSocialMedia(finalMessage, true, 'telegram');

      res.json({ success: true, message: "تم نشر التحليل الاقتصادي بنجاح" });
    } catch (err: any) {
      console.error('Error publishing analysis:', err);
      res.status(500).json({ success: false, error: err.message || "Failed to publish analysis" });
    }
  });

  // Recent changes log
  router.get('/recent-changes', (req: express.Request, res: express.Response) => {
    res.json(recentChangesLog);
  });

  router.delete('/recent-changes', async (req: express.Request, res: express.Response) => {
    recentChangesLog.length = 0;
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        await supabase.from('price_changes_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error("Failed to clear price changes in Supabase", e);
      }
    }
    res.json({ success: true });
  });

  // Broadcast logs (read-only)
  router.get('/broadcast-log', (req: express.Request, res: express.Response) => {
    try {
      const { platform, status, page, limit } = req.query;
      const result = getBroadcastLogPage({
        platform: platform ? String(platform) : undefined,
        status: status ? String(status) : undefined,
        page: page ? String(page) : undefined,
        limit: limit ? String(limit) : undefined
      });
      res.json(result);
    } catch (err: any) {
      console.error("[Admin] Error fetching broadcast logs:", err);
      res.status(500).json({ error: "Failed to fetch broadcast logs" });
    }
  });

  router.get('/broadcast-log/summary', (req: express.Request, res: express.Response) => {
    try {
      const summary = getBroadcastLogSummary();
      const activeRetryQueueCount = getRetryQueueCount();
      res.json({
        ...summary,
        activeRetryQueueCount
      });
    } catch (err: any) {
      console.error("[Admin] Error fetching broadcast log summary:", err);
      res.status(500).json({ error: "Failed to fetch broadcast log summary" });
    }
  });

  return router;
}
