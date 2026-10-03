import { cleanupUserLogs } from "../services/maintenance.service";

/**
 * [Web Server] Background Tasks — SIMPLIFIED
 *
 * Heavy tasks (scraping, social broadcasting, Telegram/WhatsApp reconnect,
 * memory watchdog, DB cleanup) have been moved to the Worker Server.
 *
 * This module only keeps:
 * 1. Keep-Alive ping to prevent Render from spinning down the instance.
 * 2. Lightweight in-memory log cleanup.
 */

export function initBackgroundTasks(port: number) {
  // Lightweight in-memory log rotation every 15 minutes
  setInterval(cleanupUserLogs, 15 * 60 * 1000);

  // Keep-alive ping for Render / Cloud Run
  setInterval(() => {
    const url = `http://127.0.0.1:${port}/api/health`;
    console.log(`[Keep-Alive] Pinging ${url}...`);
    fetch(url).catch(() => {});
  }, 4 * 60 * 1000);

  console.log("[Tasks] Web Server background tasks initialized (Keep-Alive + Log Cleanup only).");
}

