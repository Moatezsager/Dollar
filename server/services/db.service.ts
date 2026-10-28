import { db, supabase, supabaseAnonKey } from '../db';
import { rates, history } from '../state';
import { appConfig } from '../config';
import { HistoryPoint, PriceChangeLog, RateMap, AppConfig } from '../types';
import { isSignificantChange, METAL_IDS, getPriceHistoryCutoff, getLibyaDateString } from '../utils/helpers';
import { updateStats } from './reporting.service';
import { archiveOldRateHistory } from './rate-history-archive.service';

// Half of one four-decimal unit avoids losing a 0.0001 change to floating-point noise.
const OFFICIAL_CHANGE_THRESHOLD = 0.00005;

export let lastRatesFetchTime = 0;
export const RATES_CACHE_TTL = 30 * 1000; // 30 seconds

export let lastHistoryFetchTime = 0;
export const HISTORY_CACHE_TTL = 60 * 1000; // 1 minute
export let cachedHistory: HistoryPoint[] | null = null;
let historyGeneration = 0;

export const recentChangesLog: PriceChangeLog[] = [];

export function clearDbCache() {
  historyGeneration++;
  cachedHistory = null;
  lastHistoryFetchTime = 0;
  lastRatesFetchTime = 0;
}

import { checkAndAlertIfCritical } from './alert.service';

export async function logErrorArabic(message: string, context = "النظام", stack?: string, url?: string, alertSource: 'server' | 'client' = 'server') {
  // Fire background alert for critical system issues
  checkAndAlertIfCritical(message, context, { stack, url, source: alertSource }).catch(() => {});

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
    console.error(`[ArabicLog] ${context}: ${message}`);
    return;
  }
  
  try {
    const { error } = await supabase.from('error_logs').insert([{
      message: message,
      context: context,
      stack: stack,
      url: url,
      created_at: new Date().toISOString()
    }]);
    
    if (error) console.error("Failed to save Arabic error log:", error.message);
  } catch (err) {
    console.error("Critical error in logErrorArabic:", err);
  }
}

let latestLoad: Promise<void> | null = null;
const loadedAt = { parallel: 0, official: 0 };
export function getParallelUpdatedAt() {
  return loadedAt.parallel > 0 ? new Date(loadedAt.parallel).toISOString() : null;
}
export function loadLatestRatesFromSupabase(): Promise<void> {
  if (latestLoad) return latestLoad;
  latestLoad = (async () => {
    if (!supabase) throw new Error('Database unavailable for rates synchronization');
    const [parallel, official] = await Promise.all([
      supabase.from('parallel_rates').select('usd, rates, recorded_at, last_changed')
        .order('recorded_at', { ascending: false }).limit(1),
      supabase.from('official_rates').select('usd, rates, recorded_at')
        .order('recorded_at', { ascending: false }).limit(1)
    ]);
    if (parallel.error || official.error) throw parallel.error || official.error;
    for (const market of ['parallel', 'official'] as const) {
      const row = (market === 'parallel' ? parallel : official).data?.[0];
      const timestamp = Date.parse(row?.recorded_at || '');
      if (!row || !Number.isFinite(timestamp) || timestamp < loadedAt[market]) continue;
      const current = rates[market];
      const previous = market === 'parallel' ? rates.previousParallel : rates.previousOfficial;
      for (const [code, value] of Object.entries({ ...row.rates, USD: row.usd })) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || code.toUpperCase() === 'OFFICIAL_USD') continue;
        const sourceTime = market === 'parallel' ? row.last_changed?.[code] : null;
        if (Date.parse(sourceTime || row.recorded_at) < Date.parse(rates.lastChanged[market][code] || '')) continue;
        const changed = isSignificantChange(current[code], value, market === 'official' ? OFFICIAL_CHANGE_THRESHOLD : undefined);
        if (changed) previous[code] = current[code] || value;
        current[code] = value;
        if (sourceTime && Number.isFinite(Date.parse(sourceTime))) rates.lastChanged[market][code] = sourceTime;
        else if (changed || !rates.lastChanged[market][code]) rates.lastChanged[market][code] = row.recorded_at;
      }
      loadedAt[market] = timestamp;
      if (timestamp > (Date.parse(rates.lastUpdated) || 0)) rates.lastUpdated = row.recorded_at;
    }
    await syncCheckRates("مزامنة Worker");
    clearDbCache();
    lastRatesFetchTime = Date.now();
  })().finally(() => { latestLoad = null; });
  return latestLoad;
}

export async function logPriceChange(change: PriceChangeLog) {
  recentChangesLog.unshift(change);
  if (recentChangesLog.length > 200) recentChangesLog.pop();

  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    try {
      await supabase.from('price_changes_log').insert([{
        id: change.id,
        currency_code: change.currencyCode,
        currency_name: change.currencyName,
        old_price: change.oldPrice,
        new_price: change.newPrice,
        source: change.source,
        created_at: change.timestamp
      }]);
    } catch (e) {
      console.error("Failed to insert price change log to Supabase", e);
    }
  }
}


export async function initializeRatesFromDB(force = false) {
  if (!force && lastRatesFetchTime > 0 && (Date.now() - lastRatesFetchTime < RATES_CACHE_TTL)) {
    return; 
  }

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return;
  
  try {
    console.log(`[DB] Initializing rates from Supabase (force=${force})...`);
    const { data: parallelData, error: parallelError } = await supabase
      .from('parallel_rates')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1000);

    const { data: officialData, error: officialError } = await supabase
      .from('official_rates')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1000);

    const isParallelTableMissing = parallelError && parallelError.message.includes('relation "parallel_rates" does not exist');
    const isOfficialTableMissing = officialError && officialError.message.includes('relation "official_rates" does not exist');

    if (isParallelTableMissing || isOfficialTableMissing) {
      console.warn("[DB] New tables missing, falling back to legacy exchange_rates table");
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);
        
      if (!error && data && data.length > 0) {
        const latestRow = data[0];
        if (latestRow.rates_parallel && Number.isFinite(Date.parse(latestRow.recorded_at))) loadedAt.parallel = Date.parse(latestRow.recorded_at);
        if (latestRow.rates_parallel) rates.parallel = { ...rates.parallel, ...latestRow.rates_parallel };
        if (latestRow.rates_official) rates.official = { ...rates.official, ...latestRow.rates_official };
        if (latestRow.last_changed) {
          rates.lastChanged = {
            official: { ...rates.lastChanged.official, ...(latestRow.last_changed.official || {}) },
            parallel: { ...rates.lastChanged.parallel, ...(latestRow.last_changed.parallel || {}) }
          };
        }
        if (latestRow.recorded_at && (!rates.lastUpdated || new Date(latestRow.recorded_at) > new Date(rates.lastUpdated))) {
          rates.lastUpdated = latestRow.recorded_at;
        }
        
        const findPrevAndLastChanged = (curr: RateMap, isP: boolean) => {
          const prev: RateMap = { ...curr };
          for (const code in curr) {
            const currentVal = curr[code];
            let diffRow: any = null;
            let earliestRowWithCurrentVal: any = latestRow;

            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              const r = isP ? row.rates_parallel : row.rates_official;
              const rowVal = r ? r[code] : undefined;
              if (rowVal !== undefined && isSignificantChange(rowVal, currentVal, isP ? undefined : OFFICIAL_CHANGE_THRESHOLD)) {
                diffRow = row;
                break;
              }
              if (row.recorded_at) {
                earliestRowWithCurrentVal = row;
              }
            }

            if (diffRow) {
              const r = isP ? diffRow.rates_parallel : diffRow.rates_official;
              if (r && r[code] !== undefined) prev[code] = r[code];
            }

            const targetMap = isP ? rates.lastChanged.parallel : rates.lastChanged.official;
            if (!targetMap[code] && earliestRowWithCurrentVal?.recorded_at) {
              targetMap[code] = earliestRowWithCurrentVal.recorded_at;
            }
          }
          return prev;
        };
        rates.previousParallel = findPrevAndLastChanged(rates.parallel, true);
        rates.previousOfficial = findPrevAndLastChanged(rates.official, false);
      }
    } else {
      if (parallelData && parallelData.length > 0) {
        const latest = parallelData[0];
        if (Number.isFinite(Date.parse(latest.recorded_at))) loadedAt.parallel = Date.parse(latest.recorded_at);
        if (latest.rates) rates.parallel = { ...rates.parallel, ...latest.rates };
        if (latest.usd) rates.parallel.USD = latest.usd;
        if (latest.last_changed && typeof latest.last_changed === 'object') {
          rates.lastChanged.parallel = { ...rates.lastChanged.parallel, ...latest.last_changed };
        }
        if (latest.recorded_at && (!rates.lastUpdated || new Date(latest.recorded_at) > new Date(rates.lastUpdated))) {
          rates.lastUpdated = latest.recorded_at;
        }
        
        for (const code in rates.parallel) {
          const currentVal = rates.parallel[code];
          let prevDiffRow: any = null;
          let earliestRowWithCurrentVal: any = latest;

          for (let i = 0; i < parallelData.length; i++) {
            const row = parallelData[i];
            const rowVal = row.rates ? row.rates[code] : (code === 'USD' ? row.usd : undefined);
            if (rowVal !== undefined && isSignificantChange(rowVal, currentVal)) {
              prevDiffRow = row;
              break;
            }
            if (row.recorded_at) {
              earliestRowWithCurrentVal = row;
            }
          }

          if (prevDiffRow) {
            const prevVal = prevDiffRow.rates ? prevDiffRow.rates[code] : (code === 'USD' ? prevDiffRow.usd : undefined);
            if (prevVal !== undefined) rates.previousParallel[code] = prevVal;
          }

          if (!rates.lastChanged.parallel[code] && earliestRowWithCurrentVal?.recorded_at) {
            rates.lastChanged.parallel[code] = earliestRowWithCurrentVal.recorded_at;
          }
        }
      }

      if (officialData && officialData.length > 0) {
        const latest = officialData[0];
        if (latest.rates) rates.official = { ...rates.official, ...latest.rates };
        if (latest.usd) rates.official.USD = latest.usd;
        if (latest.last_changed && typeof latest.last_changed === 'object') {
          rates.lastChanged.official = { ...rates.lastChanged.official, ...latest.last_changed };
        }
        if (latest.recorded_at && (!rates.lastUpdated || new Date(latest.recorded_at) > new Date(rates.lastUpdated))) {
          rates.lastUpdated = latest.recorded_at;
        }

        for (const code in rates.official) {
          const currentVal = rates.official[code];
          let prevDiffRow: any = null;
          let earliestRowWithCurrentVal: any = latest;

          for (let i = 0; i < officialData.length; i++) {
            const row = officialData[i];
            const rowVal = row.rates ? row.rates[code] : (code === 'USD' ? row.usd : undefined);
            if (rowVal !== undefined && isSignificantChange(rowVal, currentVal, OFFICIAL_CHANGE_THRESHOLD)) {
              prevDiffRow = row;
              break;
            }
            if (row.recorded_at) {
              earliestRowWithCurrentVal = row;
            }
          }

          if (prevDiffRow) {
            const prevVal = prevDiffRow.rates ? prevDiffRow.rates[code] : (code === 'USD' ? prevDiffRow.usd : undefined);
            if (prevVal !== undefined) rates.previousOfficial[code] = prevVal;
          }

          if (!rates.lastChanged.official[code] && earliestRowWithCurrentVal?.recorded_at) {
            rates.lastChanged.official[code] = earliestRowWithCurrentVal.recorded_at;
          }
        }
      }
    }
    
    lastRatesFetchTime = Date.now();
    console.log(`[DB] Successfully loaded state from separated tables (Parallel USD: ${rates.parallel.USD})`);
  } catch (err) {
    console.error("Error initializing rates from DB:", err);
  }
}

export async function saveToSupabase(type: 'parallel' | 'official' | 'both' = 'both') {
  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
    console.warn("[DB] Supabase not initialized or using dummy key. Skipping save.");
    return; 
  }
  
  try {
    const results = [];
    const now = new Date().toISOString();
    
    if (type === 'parallel' || type === 'both') {
      if (rates.parallel.USD >= 5.5) {
        console.log(`[DB] Saving parallel rates to Supabase (USD: ${rates.parallel.USD})...`);
        results.push(supabase.from('parallel_rates').insert([{
          usd: rates.parallel.USD,
          rates: rates.parallel,
          last_changed: rates.lastChanged.parallel,
          recorded_at: rates.lastUpdated || now
        }]));
      }
    }
    
    if (type === 'official' || type === 'both') {
      if (rates.official.USD > 0) {
        console.log(`[DB] Saving official rates to Supabase (USD: ${rates.official.USD})...`);
        results.push(supabase.from('official_rates').insert([{
          usd: rates.official.USD,
          rates: rates.official,
          recorded_at: now
        }]));
      }
    }

    if (type === 'parallel' || type === 'both') {
      const metalRates: Record<string, number> = {};
      const metalChanges: Record<string, string> = {};
      let hasMetals = false;
      
      METAL_IDS.forEach(id => {
        if (rates.parallel[id]) {
          metalRates[id] = rates.parallel[id];
          metalChanges[id] = rates.lastChanged.parallel[id];
          hasMetals = true;
        }
      });

      if (hasMetals) {
        results.push(supabase.from('metal_rates').insert([{
          rates: metalRates,
          last_changed: metalChanges,
          recorded_at: rates.lastUpdated || now
        }]));
      }
    }

    if (rates.parallel.USD > 0 && rates.official.USD > 0) {
      const legacyRecord = { 
        usd_parallel: rates.parallel.USD, 
        usd_official: rates.official.USD,
        rates_parallel: rates.parallel,
        rates_official: rates.official,
        last_changed: rates.lastChanged,
        recorded_at: rates.lastUpdated || now
      };
      results.push(supabase.from('exchange_rates').insert([legacyRecord]));
    }

    const settled = await Promise.allSettled(results);
    if ((type === 'parallel' || type === 'both') && rates.parallel.USD >= 5.5 &&
        settled[0]?.status === 'fulfilled' && !(settled[0].value as any)?.error) {
      const savedAt = Date.parse(rates.lastUpdated || now);
      if (Number.isFinite(savedAt)) loadedAt.parallel = savedAt;
    }
    
    settled.forEach((res, i) => {
      if (res.status === 'rejected') {
        console.error(`[DB] Save error for source ${i}:`, res.reason);
      } else {
        const val = res.value as any;
        if (val && val.error) {
          console.error(`[DB] Supabase error in source ${i}:`, val.error.message);
        } else {
          console.log(`[DB] Successfully saved source ${i} to Supabase.`);
        }
      }
    });

    // Price retention belongs to the shared cleanup path, never each manual price save.
    clearDbCache();
    
    const typeLabel = type === 'parallel' ? 'سوق موازي' : type === 'official' ? 'رسمي' : 'متكامل';
    console.log(`[DB] Successfully saved ${typeLabel} rates to database`);
  } catch (err) {
    console.error("Supabase unified save error:", err);
    await logErrorArabic(`فشل حفظ البيانات في قاعدة البيانات: ${type === 'parallel' ? 'موازي' : 'رسمي'}`, "حفظ البيانات", String(err));
  }
}

let historyRead: { generation: number; promise: Promise<HistoryPoint[]> } | null = null;

export function fetchHistoryFromSupabase(strict = false): Promise<HistoryPoint[]> {
  if (cachedHistory && Date.now() - lastHistoryFetchTime < HISTORY_CACHE_TTL) return Promise.resolve(cachedHistory);
  if (!historyRead || historyRead.generation !== historyGeneration) {
    const pending = { generation: historyGeneration, promise: readHistoryFromSupabase() };
    historyRead = pending;
    pending.promise = pending.promise.finally(() => { if (historyRead === pending) historyRead = null; });
  }
  return strict ? historyRead.promise : historyRead.promise.catch(() => history);
}

async function readHistoryRows(table: string, fields: string, cutoff: string, until: string, signal: AbortSignal) {
  const rows: any[] = [];
  // shortcut: cap each monthly market read at 10,000 rows; add stored daily aggregates if this is exceeded.
  const pageSize = 500, maxRows = 10000;
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const result = await supabase!.from(table).select(fields).gte('recorded_at', cutoff).lte('recorded_at', until)
      .order('recorded_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + (offset === maxRows ? 0 : pageSize - 1)).abortSignal(signal);
    if (result.error) return result;
    if (!Array.isArray(result.data)) throw new Error(`History read failed: ${table}`);
    if (offset === maxRows && result.data.length) throw new Error(`Monthly history exceeds safe read limit: ${table}`);
    rows.push(...result.data);
    if (result.data.length < pageSize) return { data: rows, error: null };
  }
  throw new Error('Incomplete monthly history');
}

async function readHistoryFromSupabase() {
  const generation = historyGeneration;
  if (cachedHistory && Date.now() - lastHistoryFetchTime < HISTORY_CACHE_TTL) {
    return cachedHistory;
  }

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
    throw new Error('History database unavailable');
  }
  
  try {
    const cutoff = getPriceHistoryCutoff(), archiveCutoff = getPriceHistoryCutoff(new Date(), 'six-months'), until = new Date().toISOString(), signal = AbortSignal.timeout(15000);
    const [parallelRes, officialRes, metalRes] = await Promise.all([
      readHistoryRows('parallel_rates', 'recorded_at, usd, rates', cutoff, until, signal),
      readHistoryRows('official_rates', 'recorded_at, usd, rates', cutoff, until, signal),
      readHistoryRows('metal_rates', 'recorded_at, rates', cutoff, until, signal)
    ]);
    const archiveStart = getLibyaDateString(new Date(Date.parse(archiveCutoff))), rawStart = getLibyaDateString(new Date(Date.parse(cutoff)));
    const archiveResults = await Promise.all(['parallel_rates', 'official_rates', 'metal_rates'].map(source_table =>
      supabase!.from('rate_history_daily').select('source_table, local_date, mean_rates, low_rates, high_rates, last_rates, weekly_close_rates, observations')
        .eq('source_table', source_table).gte('local_date', archiveStart).lt('local_date', rawStart)
        .order('local_date', { ascending: true }).limit(200).abortSignal(signal)));
    const archiveUnavailable = archiveResults.some(result => ['42P01', 'PGRST205'].includes(result.error?.code));
    if (archiveResults.some(result => result.error && !['42P01', 'PGRST205'].includes(result.error.code))) throw new Error('Daily history archive read failed');
    const archivedRows = archiveUnavailable ? [] : archiveResults.flatMap(result => result.data || []);

    if (parallelRes.error?.message.includes('relation "parallel_rates" does not exist') || 
        officialRes.error?.message.includes('relation "official_rates" does not exist')) {
        
        const { data, error } = await readHistoryRows('exchange_rates', '*', cutoff, until, signal);
        if (error || !data) throw new Error('History read failed');
        if (generation !== historyGeneration) throw new Error('History changed during read');
        if (!error && data) {
           cachedHistory = data.map((row: any) => ({
              time: row.recorded_at,
              usdParallel: row.usd_parallel || (row.rates_parallel ? row.rates_parallel.USD : 0),
              usdOfficial: row.usd_official || (row.rates_official ? row.rates_official.USD : 0),
              ratesParallel: row.rates_parallel || { USD: row.usd_parallel },
              ratesOfficial: row.rates_official || { USD: row.usd_official },
              previousParallel: row.previous_parallel,
              previousOfficial: row.previous_official
           })).filter((item: any) => item.usdParallel > 5.5 || item.usdOfficial > 0);
           lastHistoryFetchTime = Date.now();
           return cachedHistory;
        }
        return history;
    }

    if ([parallelRes, officialRes, metalRes].some(result => result.error || !result.data)) throw new Error('Incomplete history read');
    if (generation !== historyGeneration) throw new Error('History changed during read');
    const parallelData = parallelRes.data || [];
    const officialData = officialRes.data || [];
    const metalData = metalRes.data || [];

    const timelineMap = new Map<string, Partial<HistoryPoint>>();

    for (const row of archivedRows as any[]) {
      const time = new Date(`${row.local_date}T12:00:00+02:00`).toISOString();
      if (row.source_table === 'parallel_rates') timelineMap.set(time, { time, aggregation: 'daily', usdParallel: row.mean_rates?.USD, ratesParallel: row.mean_rates });
      else if (row.source_table === 'official_rates') {
        const point = timelineMap.get(time) || { time, aggregation: 'daily' as const };
        point.usdOfficial = row.last_rates?.USD; point.ratesOfficial = row.last_rates; timelineMap.set(time, point);
      } else {
        const point = timelineMap.get(time) || { time, aggregation: 'daily' as const };
        point.ratesParallel = { ...(point.ratesParallel || {}), ...(row.mean_rates || {}) }; timelineMap.set(time, point);
      }
    }

    parallelData.forEach((row: any) => {
      const timestamp = Date.parse(row.recorded_at);
      if (!Number.isFinite(timestamp)) return;
      const time = new Date(timestamp).toISOString();
      timelineMap.set(time, {
        time,
        usdParallel: row.rates?.USD ?? row.usd,
        ratesParallel: row.rates || { USD: row.usd }
      });
    });

    officialData.forEach((row: any) => {
      const timestamp = Date.parse(row.recorded_at);
      if (!Number.isFinite(timestamp)) return;
      const time = new Date(timestamp).toISOString();
      if (timelineMap.has(time)) {
        const existing = timelineMap.get(time)!;
        existing.usdOfficial = row.rates?.USD ?? row.usd;
        existing.ratesOfficial = row.rates || { USD: row.usd };
      } else {
        timelineMap.set(time, {
          time,
          usdOfficial: row.rates?.USD ?? row.usd,
          ratesOfficial: row.rates || { USD: row.usd }
        });
      }
    });

    metalData.forEach((row: any) => {
      const timestamp = Date.parse(row.recorded_at);
      if (!Number.isFinite(timestamp)) return;
      const time = new Date(timestamp).toISOString();
      if (timelineMap.has(time)) {
        const existing = timelineMap.get(time)!;
        existing.ratesParallel = { ...(existing.ratesParallel || {}), ...(row.rates || {}) };
      } else {
        timelineMap.set(time, {
          time,
          ratesParallel: row.rates || {}
        });
      }
    });

    const sortedPoints = Array.from(timelineMap.values()).sort((a, b) => 
      new Date(a.time!).getTime() - new Date(b.time!).getTime()
    );

    // Carry observations forward only; today's prices must never fill earlier gaps.
    let lastParallelRates: RateMap = {};
    let lastOfficialRates: RateMap = {};
    let lastUsdParallel = 0;
    let lastUsdOfficial = 0;
    
    const completedHistory = sortedPoints.map(p => {
      const observed = { parallel: Object.keys(p.ratesParallel || {}), official: Object.keys(p.ratesOfficial || {}) };
      if (p.usdParallel !== undefined && p.usdParallel > 0 && !observed.parallel.includes('USD')) observed.parallel.push('USD');
      if (p.usdOfficial !== undefined && p.usdOfficial > 0 && !observed.official.includes('USD')) observed.official.push('USD');
      if (p.usdParallel !== undefined) lastUsdParallel = p.usdParallel;
      if (p.usdOfficial !== undefined) lastUsdOfficial = p.usdOfficial;
      if (p.ratesParallel) lastParallelRates = { ...lastParallelRates, ...p.ratesParallel };
      if (p.ratesOfficial) lastOfficialRates = { ...lastOfficialRates, ...p.ratesOfficial };
      
      return {
        time: p.time!,
        ...(p.aggregation ? { aggregation: p.aggregation } : {}),
        observed,
        usdParallel: lastUsdParallel,
        usdOfficial: lastUsdOfficial,
        ratesParallel: { ...lastParallelRates },
        ratesOfficial: { ...lastOfficialRates }
      };
    }) as HistoryPoint[];

    cachedHistory = completedHistory;
    lastHistoryFetchTime = Date.now();
    return cachedHistory;
  } catch (err) {
    console.error("Error fetching history from separated tables:", err);
    throw err;
  }
}

export const CHECK_TRIO = ["USD_CHECKS", "USD_JBANK", "USD_NCB"] as const;

export async function syncCheckRates(source: string = "تزامن تلقائي", explicitPrice?: number) {
  let targetPrice = explicitPrice || 0;
  let latestCheckTime = 0;

  if (targetPrice <= 0) {
    // العثور على أحدث سعر تم تعديله بين الثلاثي (دولار صكوك، صكوك تجاري، صكوك جمهورية)
    for (const id of CHECK_TRIO) {
      const lastChanged = rates.lastChanged.parallel[id];
      const p = rates.parallel[id] || 0;
      if (p > 0) {
        if (lastChanged) {
          const time = new Date(lastChanged).getTime();
          if (time > latestCheckTime) {
            latestCheckTime = time;
            targetPrice = p;
          }
        } else if (targetPrice <= 0) {
          targetPrice = p;
        }
      }
    }
  }

  // 🛡️ حماية صارمة: سعر الصكوك في السوق الليبي يختلف جذرياً عن سعر الكاش
  // لا يجوز إطلاقاً مزامنة الصكوك إذا كان السعر المستهدف مطابقاً لسعر الدولار كاش
  const usdCash = rates.parallel['USD'] || 0;
  if (targetPrice > 0 && usdCash > 0 && Math.abs(targetPrice - usdCash) < 0.05) {
    console.warn(`[Sync] ⚠️ تم رفض مزامنة الصكوك: السعر المستهدف (${targetPrice}) مطابق لسعر الدولار كاش (${usdCash}). الصكوك والكاش منفصلان تماماً.`);
    return false;
  }

  if (targetPrice > 0) {
    let anyChanged = false;
    const nowIso = latestCheckTime > 0 ? new Date(latestCheckTime).toISOString() : new Date().toISOString();

    for (const id of CHECK_TRIO) {
      if (rates.parallel[id] !== targetPrice) {
        const oldVal = rates.parallel[id] || targetPrice;
        
        rates.previousParallel[id] = oldVal;
        rates.parallel[id] = targetPrice;
        rates.lastChanged.parallel[id] = nowIso;
        anyChanged = true;
        
        const term = appConfig.terms.find(t => t.id === id);
        const termName = term ? term.name : (id === 'USD_CHECKS' ? 'دولار أمريكي (صكوك)' : id);
        const changeLog = {
          id: Math.random().toString(36).substring(2, 9),
          currencyCode: id,
          currencyName: termName,
          oldPrice: oldVal,
          newPrice: targetPrice,
          source: `${source} (مزامنة الصكوك)`,
          timestamp: new Date().toISOString()
        };
        await logPriceChange(changeLog);
        try {
          updateStats(id, targetPrice);
        } catch (e) {}
        console.log(`[Sync] Synced ${id} to ${targetPrice} from check trio. Source: ${source}`);
      }
    }
    return anyChanged;
  }
  return false;
}

let cleanupRun: Promise<Record<string, number | string>> | null = null;

export function cleanupOldData(onUserLogsCleanup?: () => void): Promise<Record<string, number | string>> {
  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return Promise.reject(new Error('Cleanup database unavailable'));
  if (!cleanupRun) cleanupRun = (async () => {
    const cutoff30 = getPriceHistoryCutoff();
    const cutoff1 = new Date(Date.now() - 86400000).toISOString();
    const removed: Record<string, number> = { exchange_rates: 0, parallel_rates: 0, official_rates: 0, metal_rates: 0, error_logs: 0, price_changes_log: 0 };
    const tables = ['exchange_rates', 'parallel_rates', 'official_rates', 'metal_rates', 'error_logs', 'price_changes_log'];
    const failures: string[] = [];
    let archive: Awaited<ReturnType<typeof archiveOldRateHistory>> | null = null;
    try { archive = await archiveOldRateHistory(supabase, new Date()); Object.assign(removed, archive.removed); }
    catch (error: any) { failures.push('rate_history_daily'); console.error('[Cleanup] Daily history archive failed; price rows retained:', error?.message || 'Database request failed'); }
    const signal = AbortSignal.timeout(10000);
    for (const table of tables) {
      const priceTable = table.endsWith('_rates');
      if (['parallel_rates', 'official_rates', 'metal_rates'].includes(table)) continue;
      let cutoff = priceTable ? cutoff30 : cutoff1;
      try {
        if (priceTable) {
          const latest = await supabase!.from(table).select('recorded_at').lt('recorded_at', cutoff)
            .order('recorded_at', { ascending: false }).limit(1).abortSignal(signal);
          if (latest.error) throw latest.error;
          if (!Array.isArray(latest.data)) throw new Error('Missing cleanup boundary');
          if (!latest.data.length) { removed[table] = 0; continue; }
          const boundary = Date.parse(latest.data[0].recorded_at);
          if (!Number.isFinite(boundary) || boundary >= Date.parse(cutoff)) throw new Error('Invalid cleanup boundary');
          // Retain the last pre-month observation; never delete the only/latest quote.
          cutoff = new Date(boundary).toISOString();
        }
        const result = await supabase!.from(table).delete({ count: 'exact' })
          .lt(priceTable ? 'recorded_at' : 'created_at', cutoff).abortSignal(signal);
        if (result.error) throw result.error;
        removed[table] = result.count || 0;
      } catch (error: any) {
        if (['42P01', 'PGRST205'].includes(error?.code) && !['parallel_rates', 'official_rates'].includes(table)) {
          removed[table] = 0;
        } else {
          failures.push(table);
          console.error(`[Cleanup] ${table} failed:`, error?.message || 'Database request failed');
        }
      }
    }
    clearDbCache();
    if (failures.length) {
      throw new Error(`Cleanup incomplete: ${failures.join(', ')}`);
    }
    const details = {
      removed_exchange_rates: removed.exchange_rates, removed_parallel_rates: removed.parallel_rates,
      removed_official_rates: removed.official_rates, removed_metal_rates: removed.metal_rates,
      total_removed_rates: removed.exchange_rates + removed.parallel_rates + removed.official_rates + removed.metal_rates,
      summarized_days: archive?.summarized_days || 0,
      removed_logs: removed.error_logs, removed_changes: removed.price_changes_log,
      cutoff_rates_date: cutoff30, cutoff_logs_date: cutoff1
    };
    console.log('[Cleanup] Completed; monthly observations and boundary quotes preserved.', details);
    return details;
  })().finally(() => { cleanupRun = null; });
  return cleanupRun.then(details => { onUserLogsCleanup?.(); return details; });
}

