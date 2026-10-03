import express from "express";
import { supabase, supabaseAnonKey } from "../db";
import { 
  extractProvidedCronKey, 
  isValidCronSecret, 
  cronParallelLimiter, 
  cronOfficialLimiter, 
  cronCleanupLimiter 
} from "../middleware/security";


const router = express.Router();

router.get("/refresh-parallel", cronParallelLimiter, (req: express.Request, res: express.Response) => {
  // [MOVED TO WORKER SERVER]
  // Parallel rates scraping is now exclusively handled by the Worker Server.
  // Trigger the Worker via its internal API instead.
  res.status(503).json({
    success: false,
    message: "This endpoint has been moved to the Worker Server. Scraping is no longer performed by the Web Server.",
    worker_endpoint: "POST /internal/jobs/telegram"
  });
});


router.get("/refresh-official", cronOfficialLimiter, (req: express.Request, res: express.Response) => {
  // [MOVED TO WORKER SERVER]
  // Official (CBL) rates scraping is now exclusively handled by the Worker Server.
  // Trigger the Worker via its internal API instead.
  res.status(503).json({
    success: false,
    message: "This endpoint has been moved to the Worker Server. Scraping is no longer performed by the Web Server.",
    worker_endpoint: "POST /internal/jobs/cbl"
  });
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
