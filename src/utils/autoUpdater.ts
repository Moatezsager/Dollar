/**
 * Smart Auto-Updater and Cache Purge Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects newly deployed versions on the server and refreshes the application
 * without deleting user preferences or the last usable offline snapshot.
 */

import { safeSessionStorage, safeStorage } from './storage';

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

const waitForWorker = (worker: ServiceWorker | null, timeoutMs = 6000): Promise<void> => {
  if (!worker || ['activated', 'redundant'].includes(worker.state)) return Promise.resolve();

  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('statechange', finish);
      clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    worker.addEventListener('statechange', finish);
  });
};

/**
 * Apply a new service worker before reloading. Runtime caches and local data
 * stay intact so older installs can update without losing their offline view.
 */
export async function purgeAllCachesAndReload(): Promise<void> {
  try {
    console.log('[AutoUpdater] Applying the latest service worker...');
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
        const worker = reg.waiting || reg.installing;
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        await waitForWorker(worker);
      }
    }
  } catch (err) {
    console.warn('[AutoUpdater] Notice while applying update:', err);
  } finally {
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

  const currentVersion = safeStorage.getItem(VERSION_STORAGE_KEY);

  if (!currentVersion) {
    // First recorded session on this device
    safeStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
    return false;
  }

  if (currentVersion !== serverVersion) {
    console.log(`[AutoUpdater] 🚀 New app version detected! (${currentVersion} -> ${serverVersion})`);
    
    // Prevent reload loops if update happened less than 10 seconds ago
    const lastReload = parseInt(safeSessionStorage.getItem(LAST_RELOAD_KEY) || '0', 10);
    if (Date.now() - lastReload < 10000) {
      safeStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      return false;
    }

    safeSessionStorage.setItem(LAST_RELOAD_KEY, Date.now().toString());
    safeStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
    notifyUpdateListeners(serverVersion);

    // The banner owns its visible countdown; keep the fallback for pages without it.
    if (autoReload && updateListeners.size === 0) {
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
        safeStorage.setItem(VERSION_STORAGE_KEY, data.version);
      }
    }
  } catch (e) {}

  // This is an explicit repair action, so it may clear runtime caches. User
  // preferences and cached rates/history remain available after the reload.
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await Promise.all((await window.caches.keys()).map(key => window.caches.delete(key)));
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.update().catch(() => {})));
    }
  } catch (e) {
    console.warn('[AutoUpdater] Notice while repairing runtime caches:', e);
  }
  window.location.reload();
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
