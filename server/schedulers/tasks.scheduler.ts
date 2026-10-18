import { cleanupUserLogs } from "../services/maintenance.service";

/**
 * [Web Server] Background Tasks — SIMPLIFIED
 *
 * Heavy tasks (scraping, social broadcasting, Telegram/WhatsApp reconnect,
 * memory watchdog, DB cleanup) have been moved to the Worker Server.
 *
 * This module only keeps:
 * 1. Optional Keep-Alive ping for deployments that explicitly need it.
 * 2. Lightweight in-memory log cleanup.
 */

export function initBackgroundTasks(port: number) {
  // Lightweight in-memory log rotation every 15 minutes
  setInterval(cleanupUserLogs, 15 * 60 * 1000);

  // Self-pinging is opt-in because it adds traffic without guaranteeing uptime on Render.
  if (process.env.KEEP_ALIVE_ENABLED === 'true') {
    setInterval(() => {
      const url = `http://127.0.0.1:${port}/api/health`;
      fetch(url, { headers: { 'User-Agent': 'Dollar-Price-Web/1.0' } }).catch(() => {});
    }, 4 * 60 * 1000);
  }

  console.log(`[Tasks] Web Server background tasks initialized (${process.env.KEEP_ALIVE_ENABLED === 'true' ? 'Keep-Alive + ' : ''}Log Cleanup).`);
}

