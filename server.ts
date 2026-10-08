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
import { rates } from "./server/state";

// ─── Environment Validation on Bootstrap ───
if (process.env.NODE_ENV === "production") {
  const SECURITY_CHECKS: Array<{ name: string; minLen: number; isCritical: boolean }> = [
    { name: "ADMIN_PASSWORD", minLen: 8, isCritical: true },
    { name: "API_HMAC_SECRET", minLen: 32, isCritical: false },
    { name: "CRON_SECRET", minLen: 16, isCritical: false },
    { name: "WORKER_INTERNAL_SECRET", minLen: 16, isCritical: false },
  ];

  for (const check of SECURITY_CHECKS) {
    const val = process.env[check.name];
    if (!val || val.length < check.minLen) {
      if (check.isCritical) {
        console.warn(`⚠️ [SECURITY WARNING] '${check.name}' is missing or shorter than ${check.minLen} chars. Please configure it in Render environment settings.`);
      } else {
        console.warn(`ℹ️ [CONFIG NOTICE] '${check.name}' is not set. Some features may be unavailable.`);
      }
    }
  }

  if (!process.env.WORKER_URL) {
    console.warn(`⚠️ [CONFIG NOTICE] 'WORKER_URL' is not set. Admin refresh buttons and real-time Worker notifications will not work.`);
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
// Web Server is now lightweight — no Telegram or WhatsApp connections to close.
const gracefulShutdown = async () => {
  console.log("[Server] Shutting down gracefully...");
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ─── Server Startup ───
async function startServer() {
  console.log("==========================================");
  console.log("🚀 Starting Web Server (Visitor-Facing)");
  console.log("   Role: UI, Socket.IO, API, Admin Panel");
  console.log("==========================================");

  // 1. Initial database and configuration loading
  await initializeRatesFromDB();
  await loadConfigFromSupabase();
  await loadBroadcastStateFromStorageAndSupabase();

  // 2. Initialize HTTP server and Socket.IO
  const PORT = Number(process.env.PORT) || 3000;
  const dummyServer = createServer();
  const io = initSocketIO(dummyServer);
  const app = await createApp(io);
  const server = createServer(app);

  // Re-attach socket.io to the actual HTTP server handling requests
  io.attach(server);

  // 3. Initialize lightweight background tasks and (no-op) cron schedulers
  initCronSchedulers();
  initBackgroundTasks(PORT);

  // 4. Start listening
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] ✅ Web Server running on http://localhost:${PORT}`);

    // Load latest rates from Supabase on startup (populated by Worker Server)
    (async () => {
      try {
        await loadLatestRatesFromSupabase();
        await loadRecentBroadcastTimestamps();
        broadcastRatesUpdate(rates);
        console.log("[Startup] ✅ Rates loaded from Supabase and broadcast to Socket.IO clients.");
      } catch (err) {
        console.error("[Startup] Failed to load initial rates from Supabase:", err);
      }
    })();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});


