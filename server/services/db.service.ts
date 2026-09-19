import { db, supabase, supabaseAnonKey } from '../db';
import { rates, history } from '../state';
import { appConfig } from '../config';
import { HistoryPoint, PriceChangeLog, RateMap, AppConfig } from '../types';
import { isSignificantChange } from '../utils/helpers';
import { updateStats } from './reporting.service';

export let lastRatesFetchTime = 0;
export const RATES_CACHE_TTL = 30 * 1000; // 30 seconds

export let lastHistoryFetchTime = 0;
export const HISTORY_CACHE_TTL = 60 * 1000; // 1 minute
export let cachedHistory: HistoryPoint[] | null = null;

export const recentChangesLog: PriceChangeLog[] = [];

export function clearDbCache() {
  cachedHistory = null;
  lastHistoryFetchTime = 0;
  lastRatesFetchTime = 0;
}

const METAL_IDS = [
  "GOLD", 
  "GOLD_EXT_18", 
  "GOLD_EXT_21", 
  "GOLD_SCRAP_18", 
  "GOLD_SCRAP_21", 
  "GOLD_CAST_18", 
  "GOLD_CAST_24", 
  "GOLD_LIRA_8G", 
  "GOLD_MUJARA_14G", 
  "SILVER_CAST_1000"
];

export async function logErrorArabic(message: string, context = "النظام", stack?: string, url?: string) {
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

export async function loadLatestRatesFromSupabase() {
  if (!supabase) return;
  
  try {
    console.log("[Startup] Loading latest rates from Supabase to ensure latest prices...");
    
    // Load parallel rates
    const { data: parallelData, error: parallelError } = await supabase
      .from('parallel_rates')
      .select('usd, rates, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(1);
      
    if (parallelData && parallelData.length > 0) {
      const latest = parallelData[0];
      rates.parallel = { ...rates.parallel, ...latest.rates, USD: latest.usd };
      rates.lastUpdated = latest.recorded_at;
      console.log("[Startup] Successfully loaded latest parallel rates from", latest.recorded_at);
      await syncCheckRates("بدء تشغيل السيرفر");
    }
    
    // Load official rates
    const { data: officialData, error: officialError } = await supabase
      .from('official_rates')
      .select('usd, rates, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(1);
      
    if (officialData && officialData.length > 0) {
      const latest = officialData[0];
      rates.official = { ...rates.official, ...latest.rates, USD: latest.usd };
      console.log("[Startup] Successfully loaded latest official rates from", latest.recorded_at);
    }
  } catch (err) {
    console.error("[Startup] Failed to load latest rates from Supabase:", err);
  }
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
        if (latestRow.rates_parallel) rates.parallel = { ...rates.parallel, ...latestRow.rates_parallel };
        if (latestRow.rates_official) rates.official = { ...rates.official, ...latestRow.rates_official };
        if (latestRow.last_changed) {
          rates.lastChanged = {
            official: { ...rates.lastChanged.official, ...(latestRow.last_changed.official || {}) },
            parallel: { ...rates.lastChanged.parallel, ...(latestRow.last_changed.parallel || {}) }
          };
        }
        rates.lastUpdated = latestRow.recorded_at || new Date().toISOString();
        
        const findPrev = (curr: RateMap, isP: boolean) => {
          const prev: RateMap = { ...curr };
          for (const code in curr) {
            const diff = data.find((row: any) => {
              const r = isP ? row.rates_parallel : row.rates_official;
              return r && isSignificantChange(r[code], curr[code]);
            });
            if (diff) {
              const r = isP ? (diff as any).rates_parallel : (diff as any).rates_official;
              prev[code] = r[code];
            }
          }
          return prev;
        };
        rates.previousParallel = findPrev(rates.parallel, true);
        rates.previousOfficial = findPrev(rates.official, false);
      }
    } else {
      if (parallelData && parallelData.length > 0) {
        const latest = parallelData[0];
        if (latest.rates) rates.parallel = { ...rates.parallel, ...latest.rates };
        if (latest.last_changed) rates.lastChanged.parallel = { ...rates.lastChanged.parallel, ...latest.last_changed };
        rates.lastUpdated = latest.recorded_at;
        
        for (const code in rates.parallel) {
          const diff = parallelData.find(r => r.rates && isSignificantChange(r.rates[code], rates.parallel[code]));
          if (diff) rates.previousParallel[code] = diff.rates[code];
        }
      }

      if (officialData && officialData.length > 0) {
        const latest = officialData[0];
        if (latest.rates) rates.official = { ...rates.official, ...latest.rates };
        for (const code in rates.official) {
          const diff = officialData.find(r => r.rates && isSignificantChange(r.rates[code], rates.official[code]));
          if (diff) rates.previousOfficial[code] = diff.rates[code];
        }
        if (new Date(latest.recorded_at) > new Date(rates.lastUpdated)) {
           rates.lastUpdated = latest.recorded_at;
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
        previous_parallel: rates.previousParallel,
        previous_official: rates.previousOfficial,
        last_changed: rates.lastChanged,
        recorded_at: rates.lastUpdated || now
      };
      results.push(supabase.from('exchange_rates').insert([legacyRecord]));
    }

    const settled = await Promise.allSettled(results);
    
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff30 = thirtyDaysAgo.toISOString();
    
    await Promise.allSettled([
      supabase.from('parallel_rates').delete().lt('recorded_at', cutoff30),
      supabase.from('official_rates').delete().lt('recorded_at', cutoff30),
      supabase.from('exchange_rates').delete().lt('recorded_at', cutoff30),
      supabase.from('metal_rates').delete().lt('recorded_at', cutoff30)
    ]);
        
    clearDbCache();
    
    const typeLabel = type === 'parallel' ? 'سوق موازي' : type === 'official' ? 'رسمي' : 'متكامل';
    console.log(`[DB] Successfully saved ${typeLabel} rates to database`);
  } catch (err) {
    console.error("Supabase unified save error:", err);
    await logErrorArabic(`فشل حفظ البيانات في قاعدة البيانات: ${type === 'parallel' ? 'موازي' : 'رسمي'}`, "حفظ البيانات", String(err));
  }
}

export async function fetchHistoryFromSupabase() {
  if (cachedHistory && Date.now() - lastHistoryFetchTime < HISTORY_CACHE_TTL) {
    return cachedHistory;
  }

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return history;
  
  try {
    const [parallelRes, officialRes, metalRes] = await Promise.all([
      supabase.from('parallel_rates').select('recorded_at, usd, rates').order('recorded_at', { ascending: false }).limit(3000),
      supabase.from('official_rates').select('recorded_at, usd, rates').order('recorded_at', { ascending: false }).limit(3000),
      supabase.from('metal_rates').select('recorded_at, rates').order('recorded_at', { ascending: false }).limit(3000)
    ]);

    if (parallelRes.error?.message.includes('relation "parallel_rates" does not exist') || 
        officialRes.error?.message.includes('relation "official_rates" does not exist')) {
        
        const { data, error } = await supabase.from('exchange_rates').select('*').order('recorded_at', { ascending: false }).limit(3000);
        if (!error && data) {
           cachedHistory = data.reverse().map((row: any) => ({
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

    const parallelData = parallelRes.data || [];
    const officialData = officialRes.data || [];
    const metalData = metalRes.data || [];

    const timelineMap = new Map<string, Partial<HistoryPoint>>();

    parallelData.forEach((row: any) => {
      const time = new Date(row.recorded_at).toISOString();
      timelineMap.set(time, {
        time,
        usdParallel: row.usd,
        ratesParallel: row.rates || { USD: row.usd }
      });
    });

    officialData.forEach((row: any) => {
      const time = new Date(row.recorded_at).toISOString();
      if (timelineMap.has(time)) {
        const existing = timelineMap.get(time)!;
        existing.usdOfficial = row.usd;
        existing.ratesOfficial = row.rates || { USD: row.usd };
      } else {
        timelineMap.set(time, {
          time,
          usdOfficial: row.usd,
          ratesOfficial: row.rates || { USD: row.usd }
        });
      }
    });

    metalData.forEach((row: any) => {
      const time = new Date(row.recorded_at).toISOString();
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

    let lastParallelRates: any = { ...rates.parallel };
    let lastOfficialRates: any = { ...rates.official };
    let lastUsdParallel = rates.parallel.USD || 0;
    let lastUsdOfficial = rates.official.USD || 0;
    
    const completedHistory = sortedPoints.map(p => {
      if (p.usdParallel !== undefined) lastUsdParallel = p.usdParallel;
      if (p.usdOfficial !== undefined) lastUsdOfficial = p.usdOfficial;
      if (p.ratesParallel) lastParallelRates = { ...lastParallelRates, ...p.ratesParallel };
      if (p.ratesOfficial) lastOfficialRates = { ...lastOfficialRates, ...p.ratesOfficial };
      
      return {
        time: p.time!,
        usdParallel: lastUsdParallel,
        usdOfficial: lastUsdOfficial,
        ratesParallel: { ...lastParallelRates },
        ratesOfficial: { ...lastOfficialRates }
      };
    }) as HistoryPoint[];

    if (completedHistory.length > 0) {
      cachedHistory = completedHistory;
      lastHistoryFetchTime = Date.now();
      return cachedHistory;
    }
  } catch (err) {
    console.error("Error fetching history from separated tables:", err);
  }
  return history;
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

export async function downsampleTable(tableName: string) {
  try {
    if (!supabase) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    const { data, error } = await supabase
      .from(tableName)
      .select('id, recorded_at, usd')
      .lt('recorded_at', cutoff)
      .order('recorded_at', { ascending: true })
      .limit(10000);

    if (error || !data || data.length === 0) return;

    const groupedByDay: Record<string, any[]> = {};
    for (const row of data) {
      if (!row.recorded_at) continue;
      const day = row.recorded_at.split('T')[0];
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(row);
    }

    let idsToDelete: any[] = [];
    for (const day in groupedByDay) {
      const records = groupedByDay[day];
      if (records.length <= 3) continue;

      let highId = records[0].id;
      let lowId = records[0].id;
      let highUsd = records[0].usd || 0;
      let lowUsd = records[0].usd || 999999;
      const closeId = records[records.length - 1].id;

      for (const row of records) {
        const usd = row.usd || 0;
        if (usd > highUsd) { highUsd = usd; highId = row.id; }
        if (usd < lowUsd) { lowUsd = usd; lowId = row.id; }
      }

      const keepIds = new Set([highId, lowId, closeId]);
      for (const row of records) {
        if (!keepIds.has(row.id)) idsToDelete.push(row.id);
      }
    }

    const chunkSize = 200;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      await supabase.from(tableName).delete().in('id', chunk);
    }
    
    if (idsToDelete.length > 0) {
      console.log(`[Cleanup] Downsampled ${tableName}: deleted ${idsToDelete.length} redundant historical records.`);
    }
  } catch (err) {
    console.error(`[Cleanup] Error downsampling ${tableName}:`, err);
  }
}

export const cleanupOldData = async (onUserLogsCleanup?: () => void) => {
  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return;
  
  try {
    console.log("Running scheduled database cleanup...");
    
    await downsampleTable('parallel_rates');
    await downsampleTable('official_rates');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff30 = thirtyDaysAgo.toISOString();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cutoff1 = oneDayAgo.toISOString();

    const [legacyRes, parallelRes, officialRes, metalRes, logsRes, changesRes] = await Promise.all([
      supabase.from('exchange_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
      supabase.from('parallel_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
      supabase.from('official_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
      supabase.from('metal_rates').delete({ count: 'exact' }).lt('recorded_at', cutoff30),
      supabase.from('error_logs').delete({ count: 'exact' }).lt('created_at', cutoff1),
      supabase.from('price_changes_log').delete({ count: 'exact' }).lt('created_at', cutoff1)
    ]);

    const removedRates = (legacyRes.count || 0) + (parallelRes.count || 0) + (officialRes.count || 0) + (metalRes.count || 0);
    const removedLogs = logsRes.count || 0;
    const removedChanges = changesRes.count || 0;

    const errors = [legacyRes.error, parallelRes.error, officialRes.error, metalRes.error, logsRes.error, changesRes.error]
      .filter(err => err && err.code !== '42P01');

    if (errors.length > 0) {
      console.error("Cleanup partial error:", { 
        legacy: legacyRes.error?.message, 
        parallel: parallelRes.error?.message, 
        official: officialRes.error?.message, 
        metal: metalRes.error?.message,
        logs: logsRes.error?.message,
        changes: changesRes.error?.message
      });
    }

    console.log(`Database cleanup completed. Removed ${removedRates} rates (older than 30 days), ${removedLogs} logs, and ${removedChanges} price changes (older than 1 day).`);
    
    if (onUserLogsCleanup) {
      onUserLogsCleanup();
    }
  } catch (error) {
    console.error("Failed to run database cleanup:", error);
  }
};

