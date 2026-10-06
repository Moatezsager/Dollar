import crypto from 'crypto';

/**
 * Sends a notification to the Worker server to reload its configuration.
 * Uses WORKER_URL (or WORKER_NOTIFY_URL) and WORKER_INTERNAL_SECRET from environment variables.
 */
export async function notifyWorkerReloadConfig(): Promise<void> {
  const workerBaseUrl = (process.env.WORKER_URL || process.env.WORKER_NOTIFY_URL || '').trim();
  if (!workerBaseUrl) {
    console.log('[WebServer] WORKER_URL is not set. Skipping worker notify.');
    return;
  }

  const configuredSecret = (process.env.WORKER_INTERNAL_SECRET || '').trim();
  const endpoint = workerBaseUrl.endsWith('/api/internal/reload-config')
    ? workerBaseUrl
    : `${workerBaseUrl.replace(/\/+$/, '')}/api/internal/reload-config`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (configuredSecret) {
    headers['x-worker-secret'] = configuredSecret;
    headers['Authorization'] = `Bearer ${configuredSecret}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'reload-config',
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WebServer] Worker reload-config returned status ${res.status}`);
    } else {
      console.log('[WebServer] ✅ Successfully notified Worker to reload config.');
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('[WebServer] Worker reload-config timed out after 8s');
    } else {
      throw err;
    }
  }
}
