import dotenv from "dotenv";
dotenv.config({ override: true });

import { createServer } from "http";
import { createApp } from "./server/app";
import { initSocketIO, broadcastRatesUpdate } from "./server/socket/socket.service";
import { initCronSchedulers } from "./server/schedulers/cron.scheduler";
import { initBackgroundTasks } from "./server/schedulers/tasks.scheduler";
import { 
  loadBroadcastStateFromStorageAndSupabase 
} from "./server/services/maintenance.service";
import { 
  initializeRatesFromDB, 
  loadLatestRatesFromSupabase, 
  logErrorArabic 
} from "./server/services/db.service";
import { loadConfigFromSupabase } from "./server/config";
import { loadRecentBroadcastTimestamps } from "./server/services/social.service";
import { initStatsIfEmpty } from "./server/services/reporting.service";
import { whatsappManager, hasSavedSession } from "./server/services/whatsapp.service";
import { activeClient } from "./telegramClient";
import { rates } from "./server/state";

// ─── Environment Validation on Bootstrap ───
if (process.env.NODE_ENV === "production") {
  const SECURITY_CHECKS: Array<{ name: string; minLen: number; isCritical: boolean }> = [
    { name: "ADMIN_PASSWORD", minLen: 8, isCritical: true },
    { name: "API_HMAC_SECRET", minLen: 32, isCritical: false },
    { name: "CRON_SECRET", minLen: 16, isCritical: false },
  ];

  for (const check of SECURITY_CHECKS) {
    const val = process.env[check.name];
    if (!val || val.length < check.minLen) {
      if (check.isCritical) {
        console.warn(`⚠️ [SECURITY WARNING] '${check.name}' is missing or shorter than ${check.minLen} chars. Please configure it in Render environment settings.`);
      } else {
        console.warn(`ℹ️ [CONFIG NOTICE] '${check.name}' is not set yet in Render. Advanced server-to-server security features will require this variable.`);
      }
    }
  }
}

// ─── Global Error Handlers ───
process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  await logErrorArabic(`خطأ غير معالج في السيرفر: ${reason}`, "النظام", String(reason));
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  await logErrorArabic(`خطأ فادح في السيرفر: ${error.message}`, "النظام", error.stack || "");
  setTimeout(() => process.exit(1), 1000);
});

// ─── Graceful Shutdown ───
const gracefulShutdown = async () => {
  console.log("[Server] Shutting down gracefully...");
  whatsappManager.closeOnly();
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

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ─── Server Startup ───
async function startServer() {
  // 1. Initial database and configuration loading
  await initializeRatesFromDB();
  await loadConfigFromSupabase();
  await loadBroadcastStateFromStorageAndSupabase();

  // 2. Initialize HTTP server and Socket.IO
  const PORT = 3000;
  const dummyServer = createServer();
  const io = initSocketIO(dummyServer);
  const app = await createApp(io);
  const server = createServer(app);

  // Re-attach socket.io to the actual HTTP server handling requests
  io.attach(server);

  // 3. Initialize background schedulers and cron jobs
  initCronSchedulers();
  initBackgroundTasks(PORT);

  // 4. Start listening
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Initial startup data check and synchronization
    (async () => {
      try {
        await loadLatestRatesFromSupabase();
        await loadRecentBroadcastTimestamps();
        for (const key in rates.parallel) {
          if (rates.parallel[key] > 0) {
            initStatsIfEmpty(key, rates.parallel[key]);
          }
        }

        console.log("[Startup] Initializing rates synchronization from database...");
        await loadLatestRatesFromSupabase();
        broadcastRatesUpdate(rates);
      } catch (err) {
        console.error("[Startup] Error during initial database sync:", err);
      }
    })();

    // Auto-reconnect WhatsApp if session exists
    (async () => {
      try {
        await loadConfigFromSupabase();
        if (hasSavedSession()) {
          console.log("[WhatsApp] Found permanent session credentials in Supabase cloud. Auto-connecting...");
          await whatsappManager.initClient();
        } else {
          console.log("[WhatsApp] No saved session in Supabase cloud. Awaiting user QR pairing in admin panel.");
        }
      } catch (waBootErr) {
        console.warn("[WhatsApp] Boot check warning:", waBootErr);
      }
    })();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
