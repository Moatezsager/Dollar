import { db, supabase, supabaseAnonKey } from "../db";
import { lastBroadcastState } from "./social.service";
import { cleanupOldBroadcastLogs } from "./broadcastLog.service";
import { clearDbCache, cleanupOldData } from "./db.service";
import { DeviceLogEntry } from "../types";

export let userLogs: DeviceLogEntry[] = [];

export function getUserLogs(): DeviceLogEntry[] {
  return userLogs;
}

export function setUserLogs(logs: DeviceLogEntry[]): void {
  userLogs = logs;
}

export function clearUserLogs(): void {
  userLogs = [];
}

export const monitorMemory = () => {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  console.log(`[Watchdog] Memory Check: Heap=${heapUsedMB}MB, RSS=${rssMB}MB`);

  // If memory is getting high (Render free tier is 512MB), clear internal caches
  if (heapUsedMB > 400 || rssMB > 450) {
    console.warn(`[Watchdog] HIGH MEMORY DETECTED (${heapUsedMB}MB). Triggering emergency cache cleanup...`);
    clearDbCache();
    
    // Suggest GC to V8 if exposed
    if (global && typeof (global as any).gc === 'function') {
      try { (global as any).gc(); } catch (e) {}
    }
  }
};

export const cleanupUserLogs = () => {
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  const initialCount = userLogs.length;
  userLogs = userLogs.filter(log => new Date(log.timestamp).getTime() > twentyFourHoursAgo);
  if (userLogs.length !== initialCount) {
    console.log(`[Cleanup] Removed ${initialCount - userLogs.length} old user logs.`);
  }
};

export const cleanupLocalDatabase = () => {
  try {
    console.log("[Local DB] Running scheduled cleanup and VACUUM...");
    
    // Delete analytics older than 60 days
    const analyticsResult = db.prepare(`
      DELETE FROM analytics_events 
      WHERE created_at < datetime('now', '-60 days')
    `).run();
    if (analyticsResult.changes > 0) {
      console.log(`[Local DB] Deleted ${analyticsResult.changes} old analytics events.`);
    }

    // Delete messages older than 60 days
    const messagesResult = db.prepare(`
      DELETE FROM messages 
      WHERE created_at < datetime('now', '-60 days')
    `).run();
    if (messagesResult.changes > 0) {
      console.log(`[Local DB] Deleted ${messagesResult.changes} old messages.`);
    }

    // Delete broadcast logs older than 45 days
    cleanupOldBroadcastLogs().catch(err => {
      console.error("[Local DB] Error cleaning up broadcast logs:", err);
    });

    // Run VACUUM to reclaim space
    db.exec('VACUUM');
    console.log("[Local DB] VACUUM completed successfully.");
    
  } catch (error) {
    console.error("[Local DB] Error during cleanup:", error);
  }
};

export async function loadBroadcastStateFromStorageAndSupabase() {
  try {
    // 1. Fetch from Supabase (if available)
    let supabaseRows: any[] = [];
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase.from('broadcast_state').select('term_id, last_price, last_broadcast_time');
        if (!error && data) {
          supabaseRows = data;
        } else if (error && error.message.includes('relation "broadcast_state" does not exist')) {
          console.warn("[BroadcastState] Supabase table 'broadcast_state' does not exist yet.");
        }
      } catch (err) {
        console.error("[BroadcastState] Supabase load error:", err);
      }
    }
    
    // 2. Merge Supabase into local DB
    if (supabaseRows.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO broadcast_state (term_id, last_price, last_broadcast_time)
        VALUES (?, ?, ?)
        ON CONFLICT(term_id) DO UPDATE SET
          last_price = excluded.last_price,
          last_broadcast_time = excluded.last_broadcast_time
        WHERE excluded.last_broadcast_time > broadcast_state.last_broadcast_time
      `);
      db.transaction(() => {
        for (const row of supabaseRows) {
          insertStmt.run(row.term_id, row.last_price, row.last_broadcast_time);
        }
      })();
    }
    
    // 3. Load whatever is in SQLite into memory
    const finalRows = db.prepare('SELECT term_id, last_price, last_broadcast_time FROM broadcast_state').all() as any[];
    for (const r of finalRows) {
      lastBroadcastState[r.term_id] = { price: r.last_price, time: r.last_broadcast_time };
    }
    console.log(`[BroadcastState] Loaded ${finalRows.length} state records into memory.`);
  } catch (err) {
    console.error("[BroadcastState] Error loading state:", err);
  }
}
