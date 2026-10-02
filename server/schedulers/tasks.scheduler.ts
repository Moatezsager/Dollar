import { monitorMemory, cleanupUserLogs } from "../services/maintenance.service";
import { cleanupOldData, saveToSupabase } from "../services/db.service";
import { 
  fetchOfficialRates, 
  fetchParallelRatesFromTelegram, 
  lastSuccessfulFetchTime, 
  setLastSuccessfulFetchTime, 
  clearLiveFeed 
} from "../services/scraper.service";
import { rates } from "../state";
import { broadcastRatesUpdate } from "../socket/socket.service";
import { getOrInitTelegramManager } from "../services/social.service";
import { initializeTelegram, activeClient } from "../../telegramClient";
import { whatsappManager, hasSavedSession } from "../services/whatsapp.service";

let isMonitoring = false;

export function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  // Reduced frequency to avoid connection conflicts
  setInterval(async () => {
    try {
      // Telegram check
      if (!activeClient || !activeClient.connected) {
        console.log("[Reconnector] Telegram disconnected or not initialized, attempting reconnect...");
        await initializeTelegram();
      }
      // WhatsApp stealth reconnect check
      if (hasSavedSession()) {
        const waStatus = whatsappManager.getStatus();
        if (waStatus.status === 'disconnected') {
          console.log("[Reconnector] WhatsApp session saved and disconnected, attempting reconnect...");
          whatsappManager.initClient().catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[Reconnector] Stealth reconnection failed, will retry next cycle.");
    }
  }, 15 * 60 * 1000); // 15 mins
}

export function initBackgroundTasks(port: number) {
  // Run memory watchdog every 15 minutes
  setInterval(monitorMemory, 15 * 60 * 1000);

  // Run memory cleanup every 15 minutes
  setInterval(cleanupUserLogs, 15 * 60 * 1000);

  // Run cleanup once on startup, then every 24 hours
  cleanupOldData(cleanupUserLogs);
  setInterval(() => cleanupOldData(cleanupUserLogs), 24 * 60 * 60 * 1000);

  // Admin Watchdog: alerts if no successful scrape for > 4 hours during active market hours
  setInterval(async () => {
    const libyaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hour: 'numeric', hourCycle: 'h23' });
    const currentLibyaHour = parseInt(libyaFormatter.format(new Date()), 10);
    
    // Only check during active market hours
    if (currentLibyaHour >= 9 || currentLibyaHour < 1) {
      const hoursSinceSuccess = (Date.now() - lastSuccessfulFetchTime) / (1000 * 60 * 60);
      if (hoursSinceSuccess > 4) {
        console.warn(`[Watchdog] No successful scrape for ${hoursSinceSuccess.toFixed(1)} hours!`);
        const tgMgr = getOrInitTelegramManager();
        if (tgMgr) {
          try {
            await tgMgr.sendMessage('me', `⚠️ *تنبيه للمدير (Watchdog)* ⚠️\n\nيبدو أن هناك مشكلة في الجلب الآلي للسوق الموازي.\nمرت أكثر من 4 ساعات دون أي عملية جلب ناجحة.\n\nرجاءً تحقق من حالة السيرفر أو حساب التليجرام.`);
            setLastSuccessfulFetchTime(Date.now());
          } catch (e) {
            console.error("[Watchdog] Failed to send alert", e);
          }
        }
      }
    }
  }, 30 * 60 * 1000); // Check every 30 minutes

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

  // Auto-refresh rates every 10 minutes as long as server is awake
  setInterval(async () => {
    try {
      // Stop fetching and publishing between 1 AM (01:00) and 7 AM (07:00) Libya time
      const libyaFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tripoli', hour: 'numeric', hourCycle: 'h23' });
      const currentLibyaHour = parseInt(libyaFormatter.format(new Date()), 10);
      
      if (currentLibyaHour >= 1 && currentLibyaHour < 7) {
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

  // Keep-alive ping for Render / Cloud Run (pings internal localhost)
  setInterval(() => {
    const url = `http://127.0.0.1:${port}/api/health`;
    console.log(`[Keep-Alive] Pinging ${url} to keep server healthy...`);
    fetch(url).catch(() => {});
  }, 4 * 60 * 1000);

  // Global reconnection monitoring
  startMonitoring();
}
