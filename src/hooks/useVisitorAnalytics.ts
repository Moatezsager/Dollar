import { useEffect } from 'react';
import { safeStorage, safeSessionStorage } from '../utils/storage';

export function useVisitorAnalytics(page: string) {
  useEffect(() => {
    if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      if (!crypto.randomUUID) return;
      const now = Date.now();
      const previous = Number(safeSessionStorage.getItem('analytics_active') || 0);
      let visitorId = safeStorage.getItem('analytics_visitor');
      if (!visitorId) { visitorId = crypto.randomUUID(); safeStorage.setItem('analytics_visitor', visitorId); }
      let sessionId = safeSessionStorage.getItem('analytics_session');
      if (!sessionId || now - previous > 30 * 60000) { sessionId = crypto.randomUUID(); safeSessionStorage.setItem('analytics_session', sessionId); }
      safeSessionStorage.setItem('analytics_active', String(now));
      const pagePath = page === 'dashboard' ? '/' : `/${page}`;
      const marker = `analytics_view:${pagePath}`;
      if (now - Number(safeSessionStorage.getItem(marker) || 0) < 30000) return;
      safeSessionStorage.setItem(marker, String(now));
      let referrer = '';
      try { const url = new URL(document.referrer); if (url.origin !== location.origin) referrer = url.origin; } catch {}
      deadline = setTimeout(() => controller.abort(), 7000);
      void fetch('/api/analytics/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ visitorId, sessionId, pagePath, referrer })
      }).catch(() => {}).finally(() => clearTimeout(deadline));
    }, 500);
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [page]);
}
