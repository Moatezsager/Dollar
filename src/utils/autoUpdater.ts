/**
 * Smart Auto-Updater and Cache Purge Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects newly deployed versions on the server, intelligently purges stale
 * browser CacheStorage and ServiceWorker caches, and smoothly reloads the
 * application to prevent white screens, stale UIs, and chunk load errors.
 */

export const VERSION_STORAGE_KEY = 'dinar_app_build_signature';
const LAST_RELOAD_KEY = 'dinar_last_auto_update_reload';
const CHECK_INTERVAL_MS = 3.5 * 60 * 1000; // Check every 3.5 minutes

type UpdateCallback = (hasUpdate: boolean, newVersion?: string) => void;
const updateListeners: Set<UpdateCallback> = new Set();

export function onUpdateAvailable(callback: UpdateCallback): () => void {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
}

function notifyUpdateListeners(newVersion: string) {
  updateListeners.forEach(cb => {
    try { cb(true, newVersion); } catch (e) {}
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dinar:update-available', { detail: { newVersion } }));
  }
}

/**
 * Hard purges all caches (ServiceWorker CacheStorage, session storages) and reloads
 */
export async function purgeAllCachesAndReload(): Promise<void> {
  try {
    console.log('[AutoUpdater] 🧹 Starting comprehensive cache purge...');
    
    // 1. Purge CacheStorage (Service Worker caches)
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map(k => window.caches.delete(k)));
      console.log('[AutoUpdater] 🧹 Cleared CacheStorage keys:', keys);
    }

    // 2. Tell active Service Workers to skip waiting and clear
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        if (reg.active) reg.active.postMessage({ type: 'CLEAR_CACHE' });
        await reg.update().catch(() => {});
      }
    }

    // 3. Clear temporary data caches in storage while preserving favorites & preferences
    try {
      sessionStorage.clear();
      localStorage.removeItem('lyd_rates');
      localStorage.removeItem('lyd_history');
      localStorage.removeItem('lyd_recent_changes');
    } catch (e) {}

  } catch (err) {
    console.warn('[AutoUpdater] Notice while purging caches:', err);
  } finally {
    // 4. Force hard reload bypassing cache
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

/**
 * Processes an incoming server version (from socket or HTTP endpoint)
 */
export async function processIncomingVersion(serverVersion: string, autoReload = true): Promise<boolean> {
  if (!serverVersion || typeof serverVersion !== 'string') return false;

  const currentVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (!currentVersion) {
    // First recorded session on this device
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
    return false;
  }

  if (currentVersion !== serverVersion) {
    console.log(`[AutoUpdater] 🚀 New app version detected! (${currentVersion} -> ${serverVersion})`);
    
    // Prevent reload loops if update happened less than 10 seconds ago
    const lastReload = parseInt(sessionStorage.getItem(LAST_RELOAD_KEY) || '0', 10);
    if (Date.now() - lastReload < 10000) {
      localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      return false;
    }

    sessionStorage.setItem(LAST_RELOAD_KEY, Date.now().toString());
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
    notifyUpdateListeners(serverVersion);

    if (autoReload) {
      // Delay briefly so any listeners or banners can show
      setTimeout(async () => {
        await purgeAllCachesAndReload();
      }, 1500);
    }
    return true;
  }

  return false;
}

/**
 * Check if a new server version was deployed
 */
export async function checkForAppUpdate(silent = true): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !navigator.onLine) return false;

    // Fetch version with cache-busting timestamp & no-store
    const res = await fetch(`/api/version?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) return false;
    const data = await res.json();
    const serverVersion = data?.version;

    return await processIncomingVersion(serverVersion, true);
  } catch (e) {
    if (!silent) console.warn('[AutoUpdater] Error checking for updates:', e);
    return false;
  }
}

/**
 * Manual cache purge & refresh (e.g. for user button)
 */
export async function manualCachePurgeAndReload(): Promise<void> {
  try {
    // Fetch latest version first to align key
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.version) {
        localStorage.setItem(VERSION_STORAGE_KEY, data.version);
      }
    }
  } catch (e) {}
  await purgeAllCachesAndReload();
}

/**
 * Initialize background listeners for automatic update checks and dynamic chunk repair
 */
export function initAutoUpdater(): void {
  if (typeof window === 'undefined') return;

  // 1. Initial check shortly after load
  setTimeout(() => {
    checkForAppUpdate(true);
  }, 3000);

  // 2. Periodic background check
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate(true);
    }
  }, CHECK_INTERVAL_MS);

  // 3. Check on tab focus / wake up
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate(true);
    }
  });

  // 4. Vite Dynamic Chunk Preload Failure Catcher
  // When a new build is deployed, old cached index.html might try to request old deleted JS bundle hashes.
  // This listener catches that error and gracefully reloads to get the new bundles.
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[AutoUpdater] Vite preload error detected (stale bundle). Purging cache and reloading...');
    event.preventDefault();
    purgeAllCachesAndReload();
  });
}
