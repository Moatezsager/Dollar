// Security and Encryption helpers
export const getSecurityKey = () => {
  const d = new Date();
  return `DI_SECURE_${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`;
};

export const xorData = (str: string, key: string) => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

export const obfuscateData = (data: any) => {
  try {
    // 1. Key Mapping (Obfuscate main keys)
    const mapping: any = {
      'official': '_o',
      'parallel': '_p',
      'previousOfficial': '_po',
      'previousParallel': '_pp',
      'lastUpdated': '_t',
      'lastChanged': '_lc',
      'USD': 'u1',
      'EUR': 'e2',
      'GBP': 'g3',
      'TRY': 't4',
      'GOLD': 'g5',
      'USD_CHECKS': 'uc6',
      'USD_JBANK': 'uj7'
    };

    const processObject = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(processObject);
      if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
          const mappedKey = mapping[key] || key;
          newObj[mappedKey] = processObject(obj[key]);
        }
        return newObj;
      }
      return obj;
    };

    const obfuscated = {
      _m: mapping,
      _d: processObject(data)
    };

    // 2. Stringify -> XOR -> Base64
    const json = JSON.stringify(obfuscated);
    const encrypted = xorData(json, getSecurityKey());
    return Buffer.from(encrypted).toString('base64');
  } catch (e) {
    console.error("Obfuscation error:", e);
    return data;
  }
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
