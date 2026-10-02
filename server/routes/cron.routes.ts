import express from "express";
import { rates } from "../state";
import { supabase, supabaseAnonKey } from "../db";
import { fetchParallelRatesFromTelegram, fetchOfficialRates } from "../services/scraper.service";
import { saveToSupabase } from "../services/db.service";
import { broadcastRatesUpdate } from "../socket/socket.service";
import { 
  extractProvidedCronKey, 
  isValidCronSecret, 
  cronParallelLimiter, 
  cronOfficialLimiter, 
  cronCleanupLimiter 
} from "../middleware/security";

const router = express.Router();

router.get("/refresh-parallel", cronParallelLimiter, async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('X-Accel-Buffering', 'no');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const providedKey = extractProvidedCronKey(req);
  
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
      message: parallelUpdate === true 
        ? "Parallel data updated and synced with database" 
        : parallelUpdate === false 
          ? "Server active & alive. No changes detected." 
          : "Server active & alive. Scraper executed recently, prices are up to date.",
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

router.get("/refresh-official", cronOfficialLimiter, async (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('X-Accel-Buffering', 'no');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const providedKey = extractProvidedCronKey(req);
  
  if (!isValidCronSecret(providedKey)) {
    console.warn(`[Cron-Job-Official] Unauthorized refresh attempt from IP: ${ip}`);
    return res.status(403).json({ success: false, error: "Forbidden: Invalid security key" });
  }
  
  console.log(`\n[Cron-Job-Official] Official refresh request received!`);
  
  try {
    const startTime = Date.now();
    const oldOfficial = rates.official.USD;

    // 1. Fetch official rates (CBL) in automatic mode
    const officialUpdate = await fetchOfficialRates(false, false);
    
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

router.get("/cleanup-db", cronCleanupLimiter, async (req: express.Request, res: express.Response) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const providedKey = extractProvidedCronKey(req);
  
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

export default router;
