/**
 * [Web Server] Cron Schedulers — INTENTIONALLY DISABLED
 *
 * All scheduled recurring tasks (weekly reports, DB maintenance, etc.)
 * have been moved to the dedicated Worker Server (worker_server_Dollar-main).
 * The Web Server's sole responsibility is serving visitors and broadcasting
 * real-time updates via Socket.IO.
 */
export function initCronSchedulers() {
  console.log("[Cron] Web Server: All recurring cron jobs are managed by the Worker Server. Skipping.");
}
