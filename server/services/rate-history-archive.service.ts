import { getLibyaDateString, getPriceHistoryCutoff } from '../utils/helpers';

const ARCHIVE_TABLES = ['parallel_rates', 'official_rates', 'metal_rates'] as const;
const PAGE_SIZE = 500;

export async function archiveOldRateHistory(client: any, now = new Date()) {
  const rawCutoff = getPriceHistoryCutoff(now), archiveCutoff = getPriceHistoryCutoff(now, 'six-months');
  const archiveDate = getLibyaDateString(new Date(archiveCutoff));
  const signal = AbortSignal.timeout(90000);
  const summaries: any[] = [];
  const candidates = new Map<string, any[]>();
  const latestTimes = new Map<string, string>();

  for (const table of ARCHIVE_TABLES) {
    const rows: any[] = [];
    for (let offset = 0; offset < 20000; offset += PAGE_SIZE) {
      const fields = table === 'metal_rates' ? 'id, recorded_at, rates' : 'id, recorded_at, usd, rates';
      const result = await client.from(table).select(fields).gte('recorded_at', archiveCutoff).lt('recorded_at', rawCutoff)
        .order('recorded_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1).abortSignal(signal);
      if (result.error || !Array.isArray(result.data)) throw new Error(`History archive read failed: ${table}`);
      rows.push(...result.data);
      if (result.data.length < PAGE_SIZE) break;
      if (offset + PAGE_SIZE >= 20000) throw new Error(`History archive exceeded the safe limit: ${table}`);
    }

    const latest = await client.from(table).select('recorded_at').order('recorded_at', { ascending: false }).limit(1).abortSignal(signal);
    if (latest.error || !Array.isArray(latest.data)) throw new Error(`Latest price boundary unavailable: ${table}`);
    if (latest.data.length) {
      if (!Number.isFinite(Date.parse(latest.data[0].recorded_at))) throw new Error(`Invalid latest price boundary: ${table}`);
      latestTimes.set(table, latest.data[0].recorded_at);
    }
    candidates.set(table, rows);

    const days = new Map<string, any[]>();
    for (const row of rows) {
      const time = Date.parse(row.recorded_at);
      if (!Number.isFinite(time)) throw new Error(`Invalid history timestamp: ${table}`);
      if (row.id === undefined || row.id === null) throw new Error(`Missing history record id: ${table}`);
      const day = getLibyaDateString(new Date(time));
      const values = { ...(row.rates || {}) };
      if (table !== 'metal_rates' && Number.isFinite(row.usd) && row.usd > 0) values.USD = row.usd;
      const valid = Object.fromEntries(Object.entries(values).filter(([, value]) => Number.isFinite(value) && (value as number) > 0));
      if (Object.keys(valid).length) days.set(day, [...(days.get(day) || []), { at: row.recorded_at, values: valid }]);
    }

    for (const [day, points] of days) {
      const keys = new Set(points.flatMap(point => Object.keys(point.values)));
      const mean: Record<string, number> = {}, low: Record<string, number> = {}, high: Record<string, number> = {};
      for (const key of keys) {
        const values = points.map(point => point.values[key]).filter((value: unknown): value is number => typeof value === 'number');
        if (!values.length) continue;
        mean[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
        low[key] = Math.min(...values); high[key] = Math.max(...values);
      }
      const last = points[points.length - 1];
      const lastRates = Object.assign({}, ...points.map(point => point.values));
      const weekday = new Date(`${day}T12:00:00+02:00`).getUTCDay();
      summaries.push({ source_table: table, local_date: day, mean_rates: mean, low_rates: low, high_rates: high,
        last_rates: lastRates, weekly_close_rates: weekday === 5 ? lastRates : null,
        observations: points.length, first_at: points[0].at, last_at: last.at });
    }
  }

  for (let offset = 0; offset < summaries.length; offset += PAGE_SIZE) {
    const result = await client.from('rate_history_daily').upsert(summaries.slice(offset, offset + PAGE_SIZE), { onConflict: 'source_table,local_date', ignoreDuplicates: true }).abortSignal(signal);
    if (result.error) throw new Error('Daily history summary save failed; raw readings were retained.');
  }

  // Another cleanup may already have archived a full day; never overwrite it with a partial read.
  for (const table of ARCHIVE_TABLES) {
    const expected = summaries.filter(row => row.source_table === table);
    if (!expected.length) continue;
    const saved = await client.from('rate_history_daily').select('*').eq('source_table', table)
      .gte('local_date', archiveDate).lt('local_date', getLibyaDateString(new Date(rawCutoff))).limit(200).abortSignal(signal);
    if (saved.error || !Array.isArray(saved.data)) throw new Error(`Archive verification failed: ${table}`);
    for (const row of expected) {
      const actual = saved.data.find((entry: any) => entry.local_date === row.local_date);
      const mapsEqual = (a: any, b: any) => a && Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(key => a[key] === b[key]);
      if (!actual || actual.observations !== row.observations || Date.parse(actual.first_at) !== Date.parse(row.first_at) || Date.parse(actual.last_at) !== Date.parse(row.last_at) ||
          !['mean_rates', 'low_rates', 'high_rates', 'last_rates'].every(key => mapsEqual(actual[key], row[key]))) {
        throw new Error(`Archive differs from remaining readings; retained raw prices for review: ${table}/${row.local_date}`);
      }
    }
  }

  const expired = await client.from('rate_history_daily').delete().lt('local_date', archiveDate).abortSignal(signal);
  if (expired.error) throw new Error('Expired daily history cleanup failed; raw readings were retained.');

  const removed: Record<string, number> = {};
  for (const table of ARCHIVE_TABLES) {
    removed[table] = 0;
    const latest = latestTimes.get(table);
    if (!latest) continue;
    const rows = (candidates.get(table) || []).filter(row => Date.parse(row.recorded_at) < Date.parse(latest));
    for (let offset = 0; offset < rows.length; offset += 100) {
      const result = await client.from(table).delete({ count: 'exact' }).in('id', rows.slice(offset, offset + 100).map(row => row.id)).abortSignal(signal);
      if (result.error) throw new Error(`Archived price cleanup failed: ${table}`);
      removed[table] += result.count || 0;
    }
    const old = await client.from(table).delete({ count: 'exact' }).lt('recorded_at', archiveCutoff).lt('recorded_at', latest).abortSignal(signal);
    if (old.error) throw new Error(`Expired price cleanup failed: ${table}`);
    removed[table] += old.count || 0;
  }
  return { summarized_days: summaries.length, removed, archive_cutoff: archiveCutoff, raw_cutoff: rawCutoff };
}
