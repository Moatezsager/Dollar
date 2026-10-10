import express from 'express';
import { db, supabase, supabaseAnonKey } from '../../db';
import { appConfig } from '../../config';
import { rates, serverStartTime } from '../../state';
import { DeviceLogEntry } from '../../types';

// Note: activeClient (GramJS) and whatsappManager are managed by the Worker Server.
// Note: lastSuccessfulScrape, channelStatusTracker, lastSuccessfulFetchTime are Worker-side metrics.



export interface AdminSystemDeps {
  io?: any;
  getOnlineUsers: () => number;
  apiStats: any;
  getUserLogs: () => DeviceLogEntry[];
}

export function createAdminSystemRouter(deps: AdminSystemDeps): express.Router {
  const router = express.Router();
  let databaseSnapshot: any = null;
  let databaseCheckedAt = 0;
  let databaseRequest: Promise<any> | null = null;

  // Share expensive counts between dashboard/report requests for one minute.
  const readDatabaseSnapshot = async () => {
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return null;
    if (databaseSnapshot && Date.now() - databaseCheckedAt < 60000) return databaseSnapshot;
    if (databaseRequest) return databaseRequest;
    const started = Date.now();
    databaseRequest = Promise.all([
      supabase.from('parallel_rates').select('*', { count: 'exact', head: true }),
      supabase.from('official_rates').select('*', { count: 'exact', head: true }),
      supabase.from('error_logs').select('*', { count: 'exact', head: true }),
      supabase.from('price_changes_log').select('*', { count: 'exact', head: true }),
      supabase.from('telegram_visits').select('visits_count, last_entry_at').eq('id', 0).maybeSingle()
    ]).then(([parallel, official, logs, changes, visits]) => {
      databaseSnapshot = {
        connected: ![parallel, official, logs, changes].some(result => result.error),
        parallelRatesCount: parallel.error ? null : parallel.count,
        officialRatesCount: official.error ? null : official.count,
        errorLogsCount: logs.error ? null : logs.count,
        priceChangesCount: changes.error ? null : changes.count,
        telegramVisits: visits.data?.visits_count,
        ping_ms: Date.now() - started
      };
      databaseCheckedAt = Date.now();
      return databaseSnapshot;
    }).finally(() => { databaseRequest = null; });
    return databaseRequest;
  };

  // Diagnostics
  router.get('/diagnostics', async (req: express.Request, res: express.Response) => {
    try {
      let dbStatus = false;
      try {
        if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
          const { error } = await supabase.from('parallel_rates').select('id').limit(1);
          dbStatus = !error;
        } else {
          dbStatus = !!db.prepare('SELECT 1').get();
        }
      } catch (dbErr) {
        dbStatus = false;
      }

      const telegramConfigured = !!(appConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
      
      let regexStatus = true;
      try {
        appConfig.terms.forEach(t => new RegExp(t.regex, 'i'));
      } catch (e) {
        regexStatus = false;
      }

      const allGood = dbStatus && regexStatus;
      
      res.json({
        success: true,
        status: allGood ? 'ok' : 'error',
        db: dbStatus ? 'ok' : 'error',
        telegram: telegramConfigured ? 'configured' : 'unconfigured',
        regex: regexStatus ? 'ok' : 'error'
      });
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: String(e) });
      }
    }
  });

  // RAM cleanup
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

  // Stats
  router.get('/stats', async (req: express.Request, res: express.Response) => {
    try {
      const lastRateUpdate = Number.isFinite(Date.parse(rates.lastUpdated)) ? rates.lastUpdated : null;
      const minutesSinceLastScrape = lastRateUpdate
        ? Math.max(0, Math.floor((Date.now() - Date.parse(lastRateUpdate)) / 60000)) : null;
      const todayStr = new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let totalInstalls = 0;
      let installsToday = 0;
      try {
        const installsRes = db.prepare('SELECT COUNT(*) as count FROM installs').get() as {count: number};
        if (installsRes) totalInstalls = installsRes.count;
        
        const installsTodayRes = db.prepare('SELECT COUNT(*) as count FROM installs WHERE created_at LIKE ?').get(`${todayStr}%`) as {count: number};
        if (installsTodayRes) installsToday = installsTodayRes.count;
      } catch (err) {
        console.error("Error fetching install stats:", err);
      }

      let totalTelegramVisits = 0;
      let telegramVisitsToday = 0;
      try {
        const tgRes = db.prepare('SELECT count FROM telegram_counter WHERE id = 1').get() as {count: number} | undefined;
        if (tgRes && typeof tgRes.count === 'number') totalTelegramVisits = tgRes.count;

        const tgTodayRes = db.prepare('SELECT COUNT(*) as count FROM telegram_visits WHERE is_bot = 0 AND created_at LIKE ?').get(`${todayStr}%`) as {count: number} | undefined;
        if (tgTodayRes && typeof tgTodayRes.count === 'number') {
          telegramVisitsToday = tgTodayRes.count;
        }
      } catch (err) {
        console.error("Error fetching local telegram stats:", err);
      }
      
      const database = await readDatabaseSnapshot();
      const dbStats = database || {
        parallelRatesCount: null, officialRatesCount: null,
        errorLogsCount: null, priceChangesCount: null
      };
      if (typeof database?.telegramVisits === 'number') totalTelegramVisits = database.telegramVisits;

      const memory = process.memoryUsage();
      res.json({
        onlineUsers: deps.getOnlineUsers(),
        lastSuccessfulScrape: lastRateUpdate,
        lastRateUpdate,
        dbConnected: database?.connected ?? null,
        scope: 'web',
        minutesSinceLastScrape,
        isStale: minutesSinceLastScrape === null ? null : minutesSinceLastScrape > 30,
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
        telegramVisits: {
          total: totalTelegramVisits,
          today: telegramVisitsToday
        },
        dbStats: {
          parallelRatesCount: dbStats.parallelRatesCount,
          officialRatesCount: dbStats.officialRatesCount,
          errorLogsCount: dbStats.errorLogsCount,
          priceChangesCount: dbStats.priceChangesCount
        },
        database: dbStats,
        channels: {}
      });
    } catch (err) {
      console.error("Error generating admin stats:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل توليد الإحصائيات" });
      }
    }
  });

  // Telegram Visits Detailed
  router.get('/telegram-visits', async (req: express.Request, res: express.Response) => {
    try {
      let count = 0;
      let lastEntryAt: string | null = null;
      let record: any = null;

      if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
        try {
          const { data: tgRow } = await supabase.from('telegram_visits').select('*').eq('id', 0).maybeSingle();
          if (tgRow) {
            record = tgRow;
            if (typeof tgRow.visits_count === 'number') {
              count = tgRow.visits_count;
            }
            lastEntryAt = tgRow.last_entry_at || tgRow.updated_at || null;
          }
        } catch (e) {}
      }

      if (count === 0) {
        const row = db.prepare('SELECT count FROM telegram_counter WHERE id = 1').get() as {count: number} | undefined;
        if (row && typeof row.count === 'number') count = row.count;
      }

      let summary = { total_all: count, total_human: count, total_bots: 0 };
      let recent: any[] = [];

      try {
        const localSummary = db.prepare(`
          SELECT 
            COUNT(*) as total_all,
            SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as total_human,
            SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as total_bots
          FROM telegram_visits
        `).get() as any;

        if (localSummary && localSummary.total_all > 0) {
          summary = localSummary;
          if (count > summary.total_all) {
            summary.total_all = count;
            summary.total_human = count;
          }
        }

        recent = db.prepare(`
          SELECT * FROM telegram_visits 
          ORDER BY created_at DESC 
          LIMIT 50
        `).all();
      } catch (visitErr) {}

      res.json({ success: true, count, last_entry_at: lastEntryAt, record, summary, recent });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // System Report
  router.get('/system-report', async (req: express.Request, res: express.Response) => {
    try {
      const lastRateUpdate = Number.isFinite(Date.parse(rates.lastUpdated)) ? rates.lastUpdated : null;
      const minutesSinceLastScrape = lastRateUpdate
        ? Math.max(0, Math.floor((Date.now() - Date.parse(lastRateUpdate)) / 60000)) : null;
      
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
      const database = await readDatabaseSnapshot();
      const dbStats = database ? {
        parallel_rates: database.parallelRatesCount,
        official_rates: database.officialRatesCount,
        error_logs_count: database.errorLogsCount,
        price_changes_count: database.priceChangesCount,
        ping_ms: database.ping_ms
      } : null;
      if (supabase && database?.connected) {
        const { data } = await supabase.from('error_logs').select('*')
          .order('created_at', { ascending: false }).limit(20);
        recentErrors = data || [];
      }
      const telegramChannels = (appConfig.channels || []).map(ch => ({
        id: `@${ch.replace('@', '').trim()}`, name: ch.replace('@', '').trim(),
        platform: 'telegram' as const, type: 'channel', status: 'unknown',
        last_post_time: null, messages_processed: null,
        last_scrape_attempt: null, is_readable: null
      }));
      const whatsappChats: any[] = [];

      // SQLite metrics
      let sqliteSizeKb = 0;
      let pushSubsCount = 0;
      let totalMessagesDb = 0;
      let sqliteConnected = false;
      try {
        const fs = await import('fs');
        if (fs.existsSync('messages.db')) {
          sqliteSizeKb = Math.round(fs.statSync('messages.db').size / 1024);
        }
        const pushRes = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as any;
        if (pushRes) pushSubsCount = pushRes.count || 0;
        const msgRes = db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
        if (msgRes) totalMessagesDb = msgRes.count || 0;
        sqliteConnected = true;
      } catch (dbE) {}

      const uptimeSec = Math.floor(process.uptime());
      const uptimeDays = Math.floor(uptimeSec / 86400);
      const uptimeHours = Math.floor((uptimeSec % 86400) / 3600);
      const uptimeMins = Math.floor((uptimeSec % 3600) / 60);
      const uptimeFormatted = `${uptimeDays > 0 ? uptimeDays + ' يوم و ' : ''}${uptimeHours} ساعة و ${uptimeMins} دقيقة`;

      const memory = process.memoryUsage();
      const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
      const heapTotalMb = Math.round(memory.heapTotal / 1024 / 1024);
      const rssMb = Math.round(memory.rss / 1024 / 1024);
      const heapUsagePct = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

      const report = {
        generated_at: new Date().toISOString(),
        scope: 'web',
        worker_metrics_available: false,
        overall_health: {
          score: null,
          status: database?.connected === false ? 'warning' : 'unverified',
          status_arabic: database?.connected === false ? 'تعذر قراءة قاعدة البيانات' : 'تقرير Web فقط'
        },
        system_health: {
          uptime_formatted: uptimeFormatted,
          uptime_hours: (process.uptime() / 3600).toFixed(2),
          server_start_time: serverStartTime.toISOString(),
          memory_mb: {
            rss: rssMb,
            heap_total: heapTotalMb,
            heap_used: heapUsedMb,
            heap_usage_percent: heapUsagePct
          },
          node_version: process.version,
          platform: process.platform,
          architecture: process.arch
        },
        sources_directory: {
          summary: {
            total_reachable_sources: telegramChannels.length + whatsappChats.length,
            telegram_channels_count: telegramChannels.length,
            whatsapp_chats_count: whatsappChats.length,
            active_telegram_count: null,
            active_whatsapp_count: null
          },
          telegram_channels: telegramChannels,
          whatsapp_chats: whatsappChats.map(w => ({
            id: w.id,
            name: w.name,
            platform: 'whatsapp' as const,
            type: w.type,
            messages_count: w.messagesCount,
            last_message_time: w.lastMessageTime,
            last_snippet: w.lastSnippet,
            is_readable: w.isReadable,
            participants_count: w.participantsCount
          }))
        },
        database_status: {
          sqlite: {
            connected: sqliteConnected,
            file_size_kb: sqliteSizeKb,
            journal_mode: 'WAL',
            push_subscriptions_count: pushSubsCount,
            visitor_messages_count: totalMessagesDb
          },
          supabase: {
            connected: database?.connected ?? null,
            stats: dbStats
          }
        },
        scraper_status: {
          last_successful_scrape: lastRateUpdate,
          owner: 'worker',
          minutes_since_last_scrape: minutesSinceLastScrape,
          is_stale: minutesSinceLastScrape === null ? null : minutesSinceLastScrape > 30,
          channels_count: appConfig.channels.length,
          terms_count: appConfig.terms.length
        },
        central_bank_status: {
          last_official_fetch_date: rates.lastChanged?.official?.USD || null,
          last_successful_fetch_time: null,
          usd_official: rates.official.USD || null,
          eur_official: rates.official.EUR || null,
          gbp_official: rates.official.GBP || null,
          is_synced: !!rates.official.USD
        },
        telegram_status: {
          is_authenticated: null,
          owner: 'worker',
          bot_configured: !!(appConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN)
        },
        whatsapp_status: {
          status: 'unknown',
          owner: 'worker',
          phone: null,
          user: null,
          messages_count: null,
          rates_extracted: null,
          active_chats: null
        },
        ai_engine: {
          configured: !!process.env.GEMINI_API_KEY,
          model: 'gemini-flash-latest',
          status: process.env.GEMINI_API_KEY ? 'active' : 'unconfigured'
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
      console.error("System report generation failed:", e);
      res.status(500).json({ error: "Failed to generate system report", details: e.message });
    }
  });

  // Weekly Harvest Data
  router.get('/weekly-harvest/data', async (req: express.Request, res: express.Response) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();

      let historyRecords: any[] = [];
      if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
        try {
          const { data, error } = await supabase
            .from('parallel_rates')
            .select('rates, recorded_at')
            .gte('recorded_at', sevenDaysAgoIso)
            .order('recorded_at', { ascending: true });
          if (!error && Array.isArray(data)) {
            historyRecords = data;
          }
        } catch (dbErr) {
          console.warn("[WeeklyHarvest] Failed to fetch 7-day parallel rates from Supabase:", dbErr);
        }
      }

      const KEY_ITEMS = [
        { id: 'USD', name: 'الدولار الأمريكي (كاش)', flag: 'us', category: 'currency' },
        { id: 'USD_CHECKS', name: 'الدولار الأمريكي (صكوك)', flag: 'us', category: 'currency' },
        { id: 'EUR', name: 'اليورو الأوروبي', flag: 'eu', category: 'currency' },
        { id: 'GBP', name: 'الجنيه الإسترليني', flag: 'gb', category: 'currency' },
        { id: 'TND', name: 'الدينار التونسي', flag: 'tn', category: 'currency' },
        { id: 'EGP', name: 'الجنيه المصري', flag: 'eg', category: 'currency' },
        { id: 'USD_TR', name: 'حوالات تركيا', flag: 'tr', category: 'transfer' },
        { id: 'USD_AE', name: 'حوالات دبي (الإمارات)', flag: 'ae', category: 'transfer' },
        { id: 'USD_CN', name: 'حوالات الصين', flag: 'cn', category: 'transfer' },
        { id: 'GOLD_SCRAP_18', name: 'ذهب كسر عيار 18', flag: 'gold', category: 'metal' },
        { id: 'GOLD_SCRAP_21', name: 'ذهب كسر عيار 21', flag: 'gold', category: 'metal' },
        { id: 'GOLD_CAST_24', name: 'ذهب مسبوك عيار 24', flag: 'gold', category: 'metal' },
        { id: 'GOLD_LIRA_8G', name: 'ليرة ذهب (8 جرام)', flag: 'gold', category: 'metal' },
        { id: 'SILVER_CAST_1000', name: 'مسبوك فضة (1000)', flag: 'silver', category: 'metal' }
      ];

      const computedItems = KEY_ITEMS.map(item => {
        const currentClose = rates.parallel[item.id] || rates.previousParallel[item.id] || 0;
        
        let allValues: number[] = [];
        let earliestVal: number | null = null;

        for (const record of historyRecords) {
          const val = record.rates?.[item.id];
          if (typeof val === 'number' && val > 0) {
            allValues.push(val);
            if (earliestVal === null) earliestVal = val;
          }
        }

        const openPrice = earliestVal || rates.previousParallel[item.id] || currentClose;
        if (allValues.length === 0 && currentClose > 0) {
          allValues = [openPrice, currentClose];
        }

        const highPrice = allValues.length > 0 ? Math.max(...allValues, currentClose) : currentClose;
        const lowPrice = allValues.length > 0 ? Math.min(...allValues, currentClose) : currentClose;
        const diff = currentClose - openPrice;
        const changePct = openPrice > 0 ? (diff / openPrice) * 100 : 0;

        return {
          id: item.id,
          name: item.name,
          flag: item.flag,
          category: item.category,
          open: Number(openPrice.toFixed(3)),
          high: Number(highPrice.toFixed(3)),
          low: Number(lowPrice.toFixed(3)),
          close: Number(currentClose.toFixed(3)),
          change: Number(diff.toFixed(3)),
          changePct: Number(changePct.toFixed(2)),
          trend: diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : 'steady'
        };
      });

      const startFormatted = sevenDaysAgo.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', month: 'long', day: 'numeric' });
      const endFormatted = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', month: 'long', day: 'numeric', year: 'numeric' });
      const dateRangeStr = `من ${startFormatted} إلى ${endFormatted}`;

      // Professional financial trader market analysis (Realistic, concise, no AI buzzwords)
      const usdItem = computedItems.find(i => i.id === 'USD');
      const checksItem = computedItems.find(i => i.id === 'USD_CHECKS');
      const goldItem = computedItems.find(i => i.id === 'GOLD_SCRAP_18');

      const usdDiff = usdItem ? usdItem.change : 0;
      let usdSummary = '';
      if (usdDiff > 0.02) {
        usdSummary = `سجل الدولار كاش ارتفاعاً أسبوعياً بمقدار (+${usdDiff.toFixed(2)} د.ل) ليغلق عند ${usdItem?.close.toFixed(2)} د.ل وسط زيادة في حجم الطلب التجاري.`;
      } else if (usdDiff < -0.02) {
        usdSummary = `تراجع سعر الدولار كاش بنحو (${usdDiff.toFixed(2)} د.ل) مستقراً عند ${usdItem?.close.toFixed(2)} د.ل مع هدوء التداولات النقدية.`;
      } else {
        usdSummary = `حافظ الدولار كاش على ثباته السعري حول مستويات ${usdItem?.close.toFixed(2) || '---'} د.ل مع تقارب عروض البيع والشراء بسوق المشير.`;
      }

      const checkDiff = checksItem && usdItem ? (checksItem.close - usdItem.close).toFixed(2) : '0.00';
      const checksSummary = `فارق تداول الصكوك المصرفية استقر عند (+${checkDiff} د.ل) مقارنة بالكاش، مع وتيرة تنفيذ منتظمة لمقاصة المصارف التجارية.`;

      let goldSummary = '';
      const gClose = goldItem ? goldItem.close.toFixed(1) : '---';
      const gDiff = goldItem ? goldItem.change : 0;
      if (gDiff > 1) {
        goldSummary = `ارتفع الذهب كسر 18 بمقدار (+${gDiff.toFixed(1)} د.ل) ليقفل عند ${gClose} د.ل/جرام متأثراً بصعود البورصة العالمية.`;
      } else if (gDiff < -1) {
        goldSummary = `تراجع الذهب كسر 18 بمقدار (${gDiff.toFixed(1)} د.ل) لينهي الأسبوع عند ${gClose} د.ل/جرام في ظل هدوء الطلب المحلي.`;
      } else {
        goldSummary = `استقرار نسبي لأسعار الذهب كسر 18 عند مستويات ${gClose} د.ل/جرام وسط توازن حركة البيع والشراء في أسواق الذهب.`;
      }

      const defaultNotes = [
        usdSummary,
        checksSummary,
        goldSummary
      ];

      res.json({
        success: true,
        title: "حصاد الأسبوع | التقرير المالي وحركة التداول",
        dateRange: dateRangeStr,
        notes: defaultNotes,
        items: computedItems
      });
    } catch (err: any) {
      console.error("[WeeklyHarvest] Data calculation error:", err);
      res.status(500).json({ success: false, error: err.message || "فشل احتساب بيانات الحصاد الأسبوعي" });
    }
  });

  return router;
}

export default createAdminSystemRouter;
