import { db, supabase, supabaseAnonKey } from '../db';

export interface BroadcastLogRow {
  id: number;
  created_at: number;
  platform: 'telegram' | 'facebook' | 'both';
  currency_ids: string;
  status: 'success' | 'success_after_retry' | 'failed';
  attempts: number;
  duration_ms: number | null;
  error_message: string | null;
  is_test: number;
}

export interface BroadcastLogFilter {
  platform?: string;
  status?: string;
  page?: number | string;
  limit?: number | string;
}

export interface BroadcastLogSummary {
  successRate24h: number | null;
  total24h: number;
  successful24h: number;
  failed24h: number;
  lastSuccessfulTelegram: number | null;
  lastSuccessfulFacebook: number | null;
}

export interface AddBroadcastLogParams {
  platform: 'telegram' | 'facebook' | 'both';
  currency_ids: string[];
  status: 'success' | 'success_after_retry' | 'failed';
  attempts: number;
  duration_ms?: number | null;
  error_message?: string | null;
  is_test?: boolean | number;
}

/**
 * Sanitize error message to ensure no tokens, session strings, or API keys are stored.
 */
export function sanitizeErrorMessage(rawError: any): string | null {
  if (!rawError) return null;
  let msg = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));

  // Redact known environment secrets if present
  const sensitiveStrings = [
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.FACEBOOK_ACCESS_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_SESSION_STRING,
    process.env.ADMIN_PASSWORD,
    process.env.SESSION_SECRET,
  ].filter((s): s is string => typeof s === 'string' && s.length > 4);

  for (const secret of sensitiveStrings) {
    msg = msg.split(secret).join('[REDACTED]');
  }

  // Regex sanitization for tokens, API credentials, URLs with query tokens
  msg = msg.replace(/EAA[a-zA-Z0-9_-]{20,}/g, '[REDACTED_FB_TOKEN]');
  msg = msg.replace(/\d{8,12}:[a-zA-Z0-9_-]{30,}/g, '[REDACTED_TG_TOKEN]');
  msg = msg.replace(/1[a-zA-Z0-9+/=]{50,}/g, '[REDACTED_SESSION]');
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  msg = msg.replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]');
  msg = msg.replace(/token=[^&\s]+/gi, 'token=[REDACTED]');

  if (msg.length > 500) {
    msg = msg.substring(0, 497) + '...';
  }
  return msg;
}

/**
 * Record a broadcast outcome log entry to SQLite and fire-and-forget to Supabase.
 */
export function addBroadcastLog(params: AddBroadcastLogParams): void {
  const createdAt = Date.now();
  const isTest = params.is_test ? 1 : 0;
  const currencyIdsJson = JSON.stringify(params.currency_ids || []);
  const sanitizedError = sanitizeErrorMessage(params.error_message);
  const durationMs = typeof params.duration_ms === 'number' ? Math.round(params.duration_ms) : null;

  try {
    const stmt = db.prepare(`
      INSERT INTO broadcast_log (
        created_at, platform, currency_ids, status, attempts, duration_ms, error_message, is_test
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      createdAt,
      params.platform,
      currencyIdsJson,
      params.status,
      params.attempts,
      durationMs,
      sanitizedError,
      isTest
    );
  } catch (err) {
    console.error("[BroadcastLog] Failed to insert log locally:", err);
  }

  // Mirror to Supabase in background (fire-and-forget, non-blocking)
  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    Promise.resolve(
      supabase
        .from('broadcast_log')
        .insert({
          created_at: createdAt,
          platform: params.platform,
          currency_ids: currencyIdsJson,
          status: params.status,
          attempts: params.attempts,
          duration_ms: durationMs,
          error_message: sanitizedError,
          is_test: isTest
        })
    )
      .then((res: any) => {
        const error = res?.error;
        if (error) {
          if (!error.message.includes('relation "broadcast_log" does not exist')) {
            console.error("[BroadcastLog] Supabase mirror sync error:", error.message);
          }
        }
      })
      .catch((err) => {
        console.error("[BroadcastLog] Supabase mirror sync error:", err);
      });
  }
}

/**
 * Query a paginated list of broadcast logs with optional platform and status filters.
 */
export function getBroadcastLogPage(params: BroadcastLogFilter = {}): {
  rows: BroadcastLogRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const pageNum = Math.max(1, parseInt(String(params.page || 1), 10) || 1);
  const rawLimit = parseInt(String(params.limit || 25), 10) || 25;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const offset = (pageNum - 1) * limit;

  const whereClauses: string[] = [];
  const queryParams: any[] = [];

  if (params.platform && params.platform !== 'all') {
    whereClauses.push('platform = ?');
    queryParams.push(params.platform);
  }

  if (params.status && params.status !== 'all') {
    whereClauses.push('status = ?');
    queryParams.push(params.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM broadcast_log ${whereSql}`);
    const countResult = countStmt.get(...queryParams) as { total: number };
    const total = countResult ? countResult.total : 0;

    const dataStmt = db.prepare(`
      SELECT * FROM broadcast_log
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = dataStmt.all(...queryParams, limit, offset) as BroadcastLogRow[];

    return {
      rows,
      total,
      page: pageNum,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  } catch (err) {
    console.error("[BroadcastLog] Error querying logs:", err);
    return {
      rows: [],
      total: 0,
      page: pageNum,
      limit,
      totalPages: 1
    };
  }
}

/**
 * Compute summary stats: 24h success rate and last successful broadcast timestamp per platform.
 */
export function getBroadcastLogSummary(): BroadcastLogSummary {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  try {
    // 24h success rate for non-test broadcasts
    const rateStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('success', 'success_after_retry') THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM broadcast_log
      WHERE is_test = 0 AND created_at >= ?
    `);
    const rateRow = rateStmt.get(oneDayAgo) as { total: number; successful: number; failed: number };
    const total24h = rateRow?.total || 0;
    const successful24h = rateRow?.successful || 0;
    const failed24h = rateRow?.failed || 0;
    const successRate24h = total24h > 0 ? Math.round((successful24h / total24h) * 100) : null;

    // Last successful telegram broadcast (non-test)
    const tgStmt = db.prepare(`
      SELECT MAX(created_at) as last_success
      FROM broadcast_log
      WHERE is_test = 0 AND status IN ('success', 'success_after_retry') AND platform IN ('telegram', 'both')
    `);
    const tgRow = tgStmt.get() as { last_success: number | null };
    const lastSuccessfulTelegram = tgRow?.last_success || null;

    // Last successful facebook broadcast (non-test)
    const fbStmt = db.prepare(`
      SELECT MAX(created_at) as last_success
      FROM broadcast_log
      WHERE is_test = 0 AND status IN ('success', 'success_after_retry') AND platform IN ('facebook', 'both')
    `);
    const fbRow = fbStmt.get() as { last_success: number | null };
    const lastSuccessfulFacebook = fbRow?.last_success || null;

    return {
      successRate24h,
      total24h,
      successful24h,
      failed24h,
      lastSuccessfulTelegram,
      lastSuccessfulFacebook
    };
  } catch (err) {
    console.error("[BroadcastLog] Error computing summary:", err);
    return {
      successRate24h: null,
      total24h: 0,
      successful24h: 0,
      failed24h: 0,
      lastSuccessfulTelegram: null,
      lastSuccessfulFacebook: null
    };
  }
}

/**
 * Delete broadcast log entries older than 45 days.
 */
export async function cleanupOldBroadcastLogs(): Promise<number> {
  const cutoff45Days = Date.now() - 45 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const result = db.prepare('DELETE FROM broadcast_log WHERE created_at < ?').run(cutoff45Days);
    deletedCount = result.changes || 0;
    if (deletedCount > 0) {
      console.log(`[BroadcastLog] Cleaned up ${deletedCount} logs older than 45 days.`);
    }
  } catch (err) {
    console.error("[BroadcastLog] Failed to clean up local logs:", err);
  }

  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    try {
      await supabase.from('broadcast_log').delete().lt('created_at', cutoff45Days);
    } catch (err) {
      console.error("[BroadcastLog] Failed to clean up Supabase broadcast logs:", err);
    }
  }

  return deletedCount;
}
