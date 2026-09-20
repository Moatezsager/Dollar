/**
 * Safe storage wrapper with in-memory fallback.
 * Prevents crashes in embedded WebViews (Facebook, Instagram, Safari private mode, etc.)
 * where accessing window.localStorage or window.sessionStorage throws SecurityError or DOMException.
 */

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

function createSafeStorage(type: 'localStorage' | 'sessionStorage'): Storage {
  const memory = new MemoryStorage();

  let isAvailable = false;
  try {
    if (typeof window !== 'undefined' && type in window && window[type] !== null) {
      const testKey = `__test_${type}_access__`;
      window[type].setItem(testKey, '1');
      window[type].removeItem(testKey);
      isAvailable = true;
    }
  } catch {
    isAvailable = false;
  }

  return {
    getItem(key: string): string | null {
      if (!isAvailable) {
        return memory.getItem(key);
      }
      try {
        return window[type].getItem(key);
      } catch {
        return memory.getItem(key);
      }
    },

    setItem(key: string, value: string): void {
      if (!isAvailable) {
        memory.setItem(key, value);
        return;
      }
      try {
        window[type].setItem(key, value);
      } catch {
        memory.setItem(key, value);
      }
    },

    removeItem(key: string): void {
      if (!isAvailable) {
        memory.removeItem(key);
        return;
      }
      try {
        window[type].removeItem(key);
      } catch {
        memory.removeItem(key);
      }
    },

    clear(): void {
      if (!isAvailable) {
        memory.clear();
        return;
      }
      try {
        window[type].clear();
      } catch {
        memory.clear();
      }
    },

    key(index: number): string | null {
      if (!isAvailable) {
        return memory.key(index);
      }
      try {
        return window[type].key(index);
      } catch {
        return memory.key(index);
      }
    },

    get length(): number {
      if (!isAvailable) {
        return memory.length;
      }
      try {
        return window[type].length;
      } catch {
        return memory.length;
      }
    }
  };
}

export const safeStorage = createSafeStorage('localStorage');
export const safeSessionStorage = createSafeStorage('sessionStorage');
export default safeStorage;
