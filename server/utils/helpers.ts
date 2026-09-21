import crypto from 'crypto';

/**
 * Generates an HMAC-SHA256 signature for payload verification
 */
export function generateHmacSignature(payload: string | object, secret?: string): { signature: string; timestamp: number } {
  const hmacSecret = secret || process.env.API_HMAC_SECRET || 'default_hmac_secret_key_change_in_production';
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

  const hmacSecret = secret || process.env.API_HMAC_SECRET || 'default_hmac_secret_key_change_in_production';
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

// Helper to detect significant price changes (ignores tiny floating point noise)
export function isSignificantChange(val1: number, val2: number, threshold = 0.0001) {
  return Math.abs((val1 || 0) - (val2 || 0)) > threshold;
}

// Helper to detect if a number is likely part of a date or time (e.g. 2024, 21-03, 12/05, 15:48)
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
