
/**
 * Security utility for data obfuscation to prevent scraping
 */

const getSecretKey = () => {
  const d = new Date();
  // Key changes every day to make static scraping harder
  return `DI_SECURE_${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`;
};

const xor = (str: string, key: string) => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

/**
 * Decodes obfuscated data from the server
 */
export const decodeData = (encodedData: string): any => {
  try {
    if (!encodedData || typeof encodedData !== 'string') return null;
    
    // 1. Base64 decode
    const decodedBase64 = atob(encodedData);
    
    // 2. XOR decode
    const decrypted = xor(decodedBase64, getSecretKey());
    
    // 3. JSON parse
    const data = JSON.parse(decrypted);
    
    // 4. Map keys back if they were obfuscated
    if (data._m && data._d) {
      const mapping = data._m;
      const obfuscatedData = data._d;
      
      const deobfuscate = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(deobfuscate);
        if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          for (const key in obj) {
            // Find original key from mapping
            const originalKey = Object.keys(mapping).find(k => mapping[k] === key) || key;
            newObj[originalKey] = deobfuscate(obj[key]);
          }
          return newObj;
        }
        return obj;
      };
      
      return deobfuscate(obfuscatedData);
    }
    
    return data;
  } catch (e) {
    console.error("Failed to decode security layer:", e);
    return null;
  }
};
