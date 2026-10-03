/**
 * ⚠️ SERVER-ONLY utilities.
 * HMAC functions MUST NEVER be used in src/ or exposed to the client.
 * Intended for: cron webhook verification, server-to-server calls.
 */
import crypto from 'crypto';

/**
 * Standard asynchronous delay / sleep helper
 */
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Common Metal / Gold & Silver identifier set
 */
export const METAL_IDS = [
  "GOLD",
  "GOLD_CAST_18",
  "GOLD_CAST_24",
  "GOLD_EXT_18",
  "GOLD_EXT_21",
  "GOLD_SCRAP_18",
  "GOLD_SCRAP_21",
  "GOLD_LIRA_8G",
  "GOLD_LIRA_14G",
  "GOLD_MUJARA_14G",
  "SILVER_CAST_1000"
];

export const ALLOWED_GOLD_IDS = [
  "GOLD_CAST_18",
  "GOLD_EXT_18",
  "GOLD_EXT_21",
  "GOLD_SCRAP_18",
  "GOLD_SCRAP_21",
  "GOLD_CAST_24",
  "GOLD_LIRA_8G",
  "GOLD_LIRA_14G",
  "GOLD_MUJARA_14G",
  "SILVER_CAST_1000"
];

/**
 * Generates an HMAC-SHA256 signature for payload verification
 */
export function generateHmacSignature(payload: string | object, secret?: string): { signature: string; timestamp: number } {
  const hmacSecret = secret || process.env.API_HMAC_SECRET;
  if (!hmacSecret) {
    throw new Error('FATAL: API_HMAC_SECRET is not set. Refusing HMAC operation.');
  }
  const timestamp = Date.now();
  const dataToSign = typeof payload === 'string' ? `${timestamp}:${payload}` : `${timestamp}:${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', hmacSecret).update(dataToSign).digest('hex');
  return { signature, timestamp };
}

/**
 * Verifies an HMAC-SHA256 signature and checks for replay attacks (60s window)
 */
export function verifyHmacSignature(
  payload: string | object,
  signature: string,
  timestamp: number,
  secret?: string,
  maxAgeMs = 60000
): boolean {
  if (!signature || !timestamp) return false;
  // Reject requests older than maxAgeMs (default 60s) or from the future (> 5s drift)
  const now = Date.now();
  if (now - timestamp > maxAgeMs || timestamp - now > 5000) {
    return false;
  }

  const hmacSecret = secret || process.env.API_HMAC_SECRET;
  if (!hmacSecret) {
    throw new Error('FATAL: API_HMAC_SECRET is not set. Refusing HMAC operation.');
  }
  const dataToSign = typeof payload === 'string' ? `${timestamp}:${payload}` : `${timestamp}:${JSON.stringify(payload)}`;
  const expectedSignature = crypto.createHmac('sha256', hmacSecret).update(dataToSign).digest('hex');
  
  const bufExpected = Buffer.from(expectedSignature);
  const bufActual = Buffer.from(signature);
  if (bufExpected.length !== bufActual.length) return false;
  return crypto.timingSafeEqual(bufExpected, bufActual);
}

/**
 * Pass-through helper for clean rates data (XOR obfuscation removed)
 */
export const obfuscateData = <T>(data: T): T => {
  return data;
};

/**
 * Helper to detect significant price changes (ignores tiny floating point noise)
 */
export function isSignificantChange(val1: number, val2: number, threshold = 0.0001): boolean {
  return Math.abs((val1 || 0) - (val2 || 0)) > threshold;
}

/**
 * Strips Arabic diacritics (tashkeel) and tatweel from strings
 */
export function stripArabicDiacritics(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text.replace(/[\u064B-\u065F\u0670]/g, '');
  result = result.replace(/\u0640/g, '');
  return result;
}

/**
 * Returns current Date & Time breakdown in Tripoli/Libya timezone (UTC+2)
 */
export function getLibyaTimeInfo(now: Date = new Date()) {
  const libyaDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tripoli' }));
  const yyyy = libyaDateObj.getFullYear();
  const mm = String(libyaDateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(libyaDateObj.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const dayIndex = libyaDateObj.getDay();
  const hour = libyaDateObj.getHours();
  const minute = libyaDateObj.getMinutes();
  const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    dateObj: libyaDateObj,
    dateStr,
    dayIndex,
    hour,
    minute,
    timeFormatted
  };
}

/**
 * Returns standard YYYY-MM-DD date string in Libya timezone
 */
export function getLibyaDateString(now: Date = new Date()): string {
  return getLibyaTimeInfo(now).dateStr;
}

/**
 * Helper to detect if a number is likely part of a date or time (e.g. 2024, 21-03, 12/05, 15:48)
 */
export function isProbablyDateOrTime(text: string, matchIndex: number, matchValue: string): boolean {
  const contextBefore = text.substring(Math.max(0, matchIndex - 10), matchIndex);
  const contextAfter = text.substring(matchIndex + matchValue.length, Math.min(text.length, matchIndex + matchValue.length + 10));

  if (/^20\d{2}$/.test(matchValue)) return true;

  if (matchValue.includes('.') || matchValue.includes(',') || matchValue.length > 4) {
    return false;
  }

  if (/[/-]\d{1,2}$/.test(contextBefore) || /[/-]$/.test(contextBefore)) return true;
  if (/^\d{1,2}[/-]/.test(contextAfter) || /^[/-]/.test(contextAfter)) return true;

  if (/^:\d{2}/.test(contextAfter)) return true;
  if (/\d{2}:$/.test(contextBefore) || /:$/.test(contextBefore)) return true;

  if (/بتاريخ|يوم|سنة|عام|الساعة|ساعة/i.test(contextBefore)) return true;

  return false;
}
