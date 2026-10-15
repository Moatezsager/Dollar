import { db, supabase } from '../db';

const DAY = 86400000;
const OFFSET = 2 * 3600000;
const LIMIT = 10000;
const columns = 'id,visitor_id,session_id,page_path,referrer,device_type,browser_name,os_name,created_at';
const dayKey = (time: number) => new Date(time + OFFSET).toISOString().slice(0, 10);
const timestamp = (value: string) => Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);

export function analyticsWindow(days: number, now: number) {
  const start = Date.parse(dayKey(now) + 'T00:00:00+02:00') - (days - 1) * DAY;
  return { start, previousStart: start - days * DAY, previousEnd: now - days * DAY };
}

export function summarizeAnalytics(rows: any[], days: number, now: number, comparable: boolean) {
  const { start, previousStart, previousEnd } = analyticsWindow(days, now);
  const trend = Array.from({ length: days }, (_, i) => ({ date: dayKey(start + i * DAY), pageviews: 0, ids: new Set<string>() }));
  const visitors = new Map<string, Set<string>>();
  const previousVisitors = new Set<string>();
  const sessions = new Set<string>();
  const deviceTypes: Record<string, number> = {}, browsers: Record<string, number> = {}, os: Record<string, number> = {};
  const pages: Record<string, number> = {}, sources: Record<string, number> = {};
  let totalPageviews = 0, previousPageviews = 0;
  const count = (map: Record<string, number>, key: string) => { map[key || 'غير معروف'] = (map[key || 'غير معروف'] || 0) + 1; };
  for (const row of rows) {
    const time = timestamp(String(row.created_at));
    if (!Number.isFinite(time) || time > now || time < previousStart || !row.visitor_id || row.device_type === 'Bot') continue;
    if (time < start) {
      if (time <= previousEnd) { previousPageviews++; previousVisitors.add(row.visitor_id); }
      continue;
    }
    totalPageviews++;
    const entry = trend[Math.floor((time - start) / DAY)];
    entry.pageviews++; entry.ids.add(row.visitor_id);
    if (!visitors.has(row.visitor_id)) visitors.set(row.visitor_id, new Set());
    if (row.session_id) { visitors.get(row.visitor_id)!.add(row.session_id); sessions.add(`${row.visitor_id}:${row.session_id}`); }
    count(deviceTypes, row.device_type); count(browsers, row.browser_name); count(os, row.os_name);
    count(pages, String(row.page_path || '/').split(/[?#]/)[0].slice(0, 100));
    let source = 'مباشر / غير معروف';
    try { const url = new URL(row.referrer); if (['https:', 'http:'].includes(url.protocol)) source = url.hostname; } catch {}
    count(sources, source);
  }
  const growth = (current: number, previous: number) => comparable && previous > 0 ? Math.round((current - previous) / previous * 1000) / 10 : null;
  return {
    summary: { totalPageviews, totalVisitors: visitors.size, sessions: sessions.size,
      returningVisitors: [...visitors.values()].filter(s => s.size > 1).length,
      pageviewGrowth: growth(totalPageviews, previousPageviews), visitorGrowth: growth(visitors.size, previousVisitors.size) },
    previous: comparable ? { pageviews: previousPageviews, visitors: previousVisitors.size } : null,
    trend: trend.map(({ date, pageviews, ids }) => ({ date, pageviews, visitors: ids.size })),
    deviceTypes, browsers, os, pages, sources
  };
}

// shortcut: reports cap raw rows at 10,000; use database aggregates when real traffic reaches this cap.
const cache = new Map<number, { until: number; value: any }>();
const pending = new Map<number, Promise<any>>();
export function readAnalytics(days: number): Promise<any> {
  const cached = cache.get(days);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
  if (pending.has(days)) return pending.get(days)!;
  const request = (async () => {
    const now = Date.now();
    const { previousStart } = analyticsWindow(days, now);
    let rows: any[] = [], source = 'supabase', truncated = false;
    try {
      if (!supabase) throw new Error('unavailable');
      const signal = AbortSignal.timeout(10000);
      for (let offset = 0; offset <= LIMIT; offset += 1000) {
        const { data, error } = await supabase.from('analytics_events').select(columns)
          .gte('created_at', new Date(previousStart).toISOString()).lte('created_at', new Date(now).toISOString())
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset === LIMIT ? offset : offset + 999).abortSignal(signal);
        if (error || !data) throw new Error('read_failed');
        if (offset === LIMIT) { truncated = data.length > 0; break; }
        rows.push(...data);
        if (data.length < 1000) break;
      }
    } catch {
      source = 'local';
      // SQLite defaults are UTC SQL timestamps, not ISO timestamps.
      rows = db.prepare(`SELECT ${columns} FROM analytics_events WHERE created_at >= ? ORDER BY created_at DESC, id DESC LIMIT ?`)
        .all(new Date(previousStart).toISOString().replace('T', ' ').slice(0, 19), LIMIT + 1) as any[];
      truncated = rows.length > LIMIT;
      rows = rows.slice(0, LIMIT);
    }
    const value = { success: true, ...summarizeAnalytics(rows, days, now, source === 'supabase' && !truncated),
      source, truncated, generatedAt: new Date(now).toISOString(), days, timezone: 'Africa/Tripoli' };
    cache.set(days, { until: Math.min(now + 300000, analyticsWindow(1, now).start + DAY), value });
    return value;
  })().finally(() => pending.delete(days));
  pending.set(days, request);
  return request;
}
