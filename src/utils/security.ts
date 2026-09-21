
/**
 * Safe data handling utility.
 * Insecure XOR obfuscation has been removed; rates are delivered cleanly and safely.
 */

/**
 * Safely parses and normalizes rate data from API or WebSocket
 */
export const decodeData = <T = any>(data: any): T | null => {
  if (data === null || data === undefined) return null;
  if (typeof data === 'object') {
    return data as T;
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  return null;
};

