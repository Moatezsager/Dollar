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
  console.log("[WebServer] Shutting down gracefully...");
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
  const app = await createApp(null as any);
  const server = createServer(app);
  const io = initSocketIO(server);

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
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
