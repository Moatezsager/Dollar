import { monitorMemory, cleanupUserLogs } from "../services/maintenance.service";
import { cleanupOldData, syncLatestRatesFromDB } from "../services/db.service";
import { clearLiveFeed } from "../services/scraper.service";

export function startMonitoring() {
  // External scraping monitoring disabled: scraping is handled exclusively by dedicated worker server
}

export function initBackgroundTasks(port: number) {
  // Run memory watchdog every 15 minutes
  setInterval(monitorMemory, 15 * 60 * 1000);

  // Run memory cleanup every 15 minutes
  setInterval(cleanupUserLogs, 15 * 60 * 1000);

  // Run cleanup once on startup, then every 24 hours
  cleanupOldData(cleanupUserLogs);
  setInterval(() => cleanupOldData(cleanupUserLogs), 24 * 60 * 60 * 1000);

  // Memory Monitor: cleans feed and suggests GC if heap > 500MB
  const MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB
  setInterval(async () => {
    const mem = process.memoryUsage();
    if (mem.heapUsed > MEMORY_THRESHOLD) {
      console.warn(`[MemoryMonitor] High memory usage: ${Math.round(mem.heapUsed / 1024 / 1024)}MB. Cleaning...`);
      clearLiveFeed();
      if ((global as any).gc) {
        (global as any).gc();
      }
    }
  }, 60000); // Check every minute

  // Auto-sync rates directly from database every 30 seconds
  // Receives fresh rates saved by the dedicated scraping server and broadcasts to WebSocket clients
  setInterval(async () => {
    try {
      await syncLatestRatesFromDB("Periodic DB Sync");
    } catch (err) {
      console.error("[DB-Sync] Error during database rates sync:", err);
    }
  }, 30 * 1000);

  // Keep-alive ping for Render / Cloud Run (pings internal localhost)
  setInterval(() => {
    const url = `http://127.0.0.1:${port}/api/health`;
    fetch(url).catch(() => {});
  }, 4 * 60 * 1000);
}
