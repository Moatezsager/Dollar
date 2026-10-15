import { UAParser } from 'ua-parser-js';
import { db, supabase } from '../db';
import { appConfig } from '../config';

const recent = new Map<string, number>();
let activeWrites = 0;
export const analyticsWriteHealth = { localOnly: 0, since: new Date().toISOString() };
let lastWarning = 0;
function recordLocalOnly() {
  analyticsWriteHealth.localOnly++;
  if (Date.now() - lastWarning > 60000) {
    console.warn('[Analytics] Remote write unavailable; events retained locally. Admin report shows the missing-sync count.');
    lastWarning = Date.now();
  }
}
export async function recordPageview(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const ua = String(req.headers['user-agent'] || '').slice(0, 512);
  if (appConfig.enableUserTracking === false || req.headers.dnt === '1' || req.headers['sec-gpc'] === '1' || /bot|crawler|spider|headless|preview/i.test(ua)) return res.sendStatus(204);
  const { visitorId, sessionId, pagePath, referrer } = req.body || {};
  const validId = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
  if (!validId(visitorId) || !validId(sessionId) || !['/', '/api', '/contact', '/about', '/privacy', '/terms'].includes(pagePath)
    || (referrer !== undefined && (typeof referrer !== 'string' || referrer.length > 2048))) return res.sendStatus(400);
  const now = Date.now(), key = `${visitorId}:${sessionId}:${pagePath}`;
  for (const [id, expires] of recent) if (expires <= now) recent.delete(id);
  if (recent.has(key)) return res.sendStatus(204);
  if (recent.size >= 10000 || activeWrites >= 10) return res.status(429).set('Retry-After', '60').end();
  let source = '';
  try { const url = new URL(referrer); if (['https:', 'http:'].includes(url.protocol)) source = url.origin; } catch {}
  const parsed = new UAParser(ua).getResult();
  const event = {
    visitor_id: visitorId, session_id: sessionId, page_path: pagePath, referrer: source,
    device_type: parsed.device.type === 'mobile' ? 'Mobile' : parsed.device.type === 'tablet' ? 'Tablet' : 'Desktop',
    device_vendor: parsed.device.vendor || 'Unknown', device_model: parsed.device.model || 'Unknown',
    os_name: parsed.os.name || 'Unknown', os_version: parsed.os.version || '',
    browser_name: parsed.browser.name || 'Unknown', browser_version: parsed.browser.version || '',
    created_at: new Date(now).toISOString()
  };
  recent.set(key, now + 30000);
  activeWrites++;
  try {
    const fields = Object.keys(event);
    db.prepare(`INSERT INTO analytics_events (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
      .run(...Object.values(event).map((value, i) => fields[i] === 'created_at' ? value.replace('T', ' ').slice(0, 19) : value));
    if (supabase) {
      try {
        const { error } = await supabase.from('analytics_events').insert([event]).abortSignal(AbortSignal.timeout(5000));
        if (error) recordLocalOnly();
      } catch { recordLocalOnly(); }
    } else recordLocalOnly();
    res.sendStatus(204);
  } catch {
    recent.delete(key);
    res.sendStatus(503);
  } finally { activeWrites--; }
}
