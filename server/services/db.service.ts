import { db, supabase, supabaseAnonKey } from '../db';
import { rates, history } from '../state';
import { appConfig } from '../config';
import { HistoryPoint, PriceChangeLog, RateMap, AppConfig } from '../types';
import { isSignificantChange, METAL_IDS } from '../utils/helpers';
import { updateStats } from './reporting.service';
import { broadcastRatesUpdate } from '../socket/socket.service';

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
  return await syncLatestRatesFromDB("بدء تشغيل السيرفر");
}

function cleanLastChangedMap(raw: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, val] of Object.entries(raw)) {
      if (!/^\d+$/.test(key) && typeof val === 'string' && !isNaN(new Date(val).getTime())) {
        result[key] = val;
      }
    }
  }
  return result;
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Synchronizes the in-memory rates with the latest rates stored in Supabase.
 * Returns true if new or changed rates were detected and loaded.
 */
export async function syncLatestRatesFromDB(triggerSource = "DB-Sync"): Promise<boolean> {
  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
    return false;
  }

  try {
    const emptyRes = { data: null, error: null } as any;
    const [parallelRes, officialRes, metalRes] = await Promise.all([
      withTimeout(
        supabase
          .from('parallel_rates')
          .select('usd, rates, last_changed, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(100),
        8000,
        emptyRes
      ),
      withTimeout(
        supabase
          .from('official_rates')
          .select('usd, rates, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(100),
        8000,
        emptyRes
      ),
      withTimeout(
        supabase
          .from('metal_rates')
          .select('rates, last_changed, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(100),
        8000,
        emptyRes
      )
    ]);

    const isParallelTableMissing = parallelRes.error && parallelRes.error.message.includes('relation "parallel_rates" does not exist');
    const isOfficialTableMissing = officialRes.error && officialRes.error.message.includes('relation "official_rates" does not exist');

    if (isParallelTableMissing || isOfficialTableMissing) {
      console.warn("[DB] Modern rates tables missing, falling back to legacy exchange_rates table");
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
            official: { ...rates.lastChanged.official, ...(cleanLastChangedMap(latestRow.last_changed.official) || {}) },
            parallel: { ...rates.lastChanged.parallel, ...(cleanLastChangedMap(latestRow.last_changed.parallel) || {}) }
          };
        }
        if (latestRow.recorded_at) {
          rates.lastUpdated = latestRow.recorded_at;
        }
        return true;
      }
      return false;
    }

    let changed = false;
    let newestRecordedAt = rates.lastUpdated || '';

    const parallelData = parallelRes.data || [];
    const officialData = officialRes.data || [];
    const metalData = metalRes.data || [];

    // 1. Process Parallel Rates
    if (parallelData.length > 0) {
      const latestParallel = parallelData[0];
      const prevParallel = parallelData[1];

      if (latestParallel.usd && isSignificantChange(latestParallel.usd, rates.parallel.USD)) {
        rates.previousParallel.USD = rates.parallel.USD || (prevParallel ? prevParallel.usd : latestParallel.usd);
        rates.parallel.USD = latestParallel.usd;
        changed = true;
      }

      if (latestParallel.rates && typeof latestParallel.rates === 'object') {
        for (const [code, val] of Object.entries(latestParallel.rates)) {
          if (typeof val === 'number' && val > 0) {
            if (isSignificantChange(val, rates.parallel[code])) {
              rates.previousParallel[code] = rates.parallel[code] || (prevParallel?.rates?.[code] ?? val);
              rates.parallel[code] = val;
              changed = true;
            } else if (rates.parallel[code] === undefined) {
              rates.parallel[code] = val;
            }
          }
        }
      }

      // Merge cleaned last_changed from latest record
      const cleanPChanged = cleanLastChangedMap(latestParallel.last_changed);
      Object.assign(rates.lastChanged.parallel, cleanPChanged);

      // Clean existing junk numeric keys
      Object.keys(rates.lastChanged.parallel).forEach(k => {
        if (/^\d+$/.test(k)) delete rates.lastChanged.parallel[k];
      });

      // Ensure every currency in rates.parallel has a verified change date
      for (const code of Object.keys(rates.parallel)) {
        const existing = rates.lastChanged.parallel[code];
        const isDateValid = existing && typeof existing === 'string' && !isNaN(new Date(existing).getTime());
        if (!isDateValid) {
          const currentVal = rates.parallel[code];
          const diffIdx = parallelData.findIndex(r => r.rates && typeof r.rates[code] === 'number' && isSignificantChange(r.rates[code], currentVal));
          if (diffIdx > 0) {
            rates.lastChanged.parallel[code] = parallelData[diffIdx - 1].recorded_at;
          } else if (diffIdx === 0) {
            rates.lastChanged.parallel[code] = latestParallel.recorded_at;
          } else {
            rates.lastChanged.parallel[code] = parallelData[parallelData.length - 1]?.recorded_at || latestParallel.recorded_at;
          }
        }

        // Previous rate resolution from history
        if (!rates.previousParallel[code] || rates.previousParallel[code] === rates.parallel[code]) {
          const diffRow = parallelData.find(r => r.rates && typeof r.rates[code] === 'number' && isSignificantChange(r.rates[code], rates.parallel[code]));
          if (diffRow && typeof diffRow.rates[code] === 'number') {
            rates.previousParallel[code] = diffRow.rates[code];
          }
        }
      }

      if (latestParallel.recorded_at) {
        if (!newestRecordedAt || new Date(latestParallel.recorded_at).getTime() > new Date(newestRecordedAt).getTime()) {
          newestRecordedAt = latestParallel.recorded_at;
        }
      }
    }

    // 2. Process Metal Rates
    if (metalData.length > 0) {
      const latestMetal = metalData[0];
      if (latestMetal.rates && typeof latestMetal.rates === 'object') {
        for (const [code, val] of Object.entries(latestMetal.rates)) {
          if (typeof val === 'number' && val > 0) {
            if (isSignificantChange(val, rates.parallel[code])) {
              rates.previousParallel[code] = rates.parallel[code] || val;
              rates.parallel[code] = val;
              changed = true;
            } else if (rates.parallel[code] === undefined) {
              rates.parallel[code] = val;
            }
          }
        }
      }

      const cleanMChanged = cleanLastChangedMap(latestMetal.last_changed);
      Object.assign(rates.lastChanged.parallel, cleanMChanged);

      for (const id of METAL_IDS) {
        if (rates.parallel[id]) {
          const existing = rates.lastChanged.parallel[id];
          const isDateValid = existing && typeof existing === 'string' && !isNaN(new Date(existing).getTime());
          if (!isDateValid) {
            const currentVal = rates.parallel[id];
            const diffIdx = metalData.findIndex(r => r.rates && typeof r.rates[id] === 'number' && isSignificantChange(r.rates[id], currentVal));
            if (diffIdx > 0) {
              rates.lastChanged.parallel[id] = metalData[diffIdx - 1].recorded_at;
            } else {
              rates.lastChanged.parallel[id] = metalData[metalData.length - 1]?.recorded_at || latestMetal.recorded_at;
            }
          }
        }
      }

      if (latestMetal.recorded_at) {
        if (!newestRecordedAt || new Date(latestMetal.recorded_at).getTime() > new Date(newestRecordedAt).getTime()) {
          newestRecordedAt = latestMetal.recorded_at;
        }
      }
    }

    // 3. Process Official Rates
    if (officialData.length > 0) {
      const latestOfficial = officialData[0];
      const prevOfficial = officialData[1];

      if (latestOfficial.usd && isSignificantChange(latestOfficial.usd, rates.official.USD)) {
        rates.previousOfficial.USD = rates.official.USD || (prevOfficial ? prevOfficial.usd : latestOfficial.usd);
        rates.official.USD = latestOfficial.usd;
        changed = true;
      }

      if (latestOfficial.rates && typeof latestOfficial.rates === 'object') {
        for (const [code, val] of Object.entries(latestOfficial.rates)) {
          if (typeof val === 'number' && val > 0) {
            if (isSignificantChange(val, rates.official[code])) {
              rates.previousOfficial[code] = rates.official[code] || (prevOfficial?.rates?.[code] ?? val);
              rates.official[code] = val;
              changed = true;
            } else if (rates.official[code] === undefined) {
              rates.official[code] = val;
            }
          }
        }
      }

      // Compute lastChanged for each official currency from history
      for (const code of Object.keys(rates.official)) {
        const currentVal = rates.official[code];
        const diffIdx = officialData.findIndex(r => r.rates && typeof r.rates[code] === 'number' && isSignificantChange(r.rates[code], currentVal));
        if (diffIdx > 0) {
          rates.lastChanged.official[code] = officialData[diffIdx - 1].recorded_at;
        } else {
          rates.lastChanged.official[code] = officialData[officialData.length - 1]?.recorded_at || latestOfficial.recorded_at;
        }

        if (!rates.previousOfficial[code] || rates.previousOfficial[code] === rates.official[code]) {
          const diffRow = officialData.find(r => r.rates && typeof r.rates[code] === 'number' && isSignificantChange(r.rates[code], rates.official[code]));
          if (diffRow && typeof diffRow.rates[code] === 'number') {
            rates.previousOfficial[code] = diffRow.rates[code];
          }
        }
      }

      // Official USD change date
      const usdDiffIdx = officialData.findIndex(r => r.usd && isSignificantChange(r.usd, rates.official.USD));
      if (usdDiffIdx > 0) {
        rates.lastChanged.official.USD = officialData[usdDiffIdx - 1].recorded_at;
        rates.previousOfficial.USD = officialData[usdDiffIdx].usd;
      } else {
        rates.lastChanged.official.USD = latestOfficial.recorded_at;
      }

      if (latestOfficial.recorded_at) {
        if (!newestRecordedAt || new Date(latestOfficial.recorded_at).getTime() > new Date(newestRecordedAt).getTime()) {
          newestRecordedAt = latestOfficial.recorded_at;
        }
      }
    }

    if (newestRecordedAt && rates.lastUpdated !== newestRecordedAt) {
      rates.lastUpdated = newestRecordedAt;
      changed = true;
    }

    lastRatesFetchTime = Date.now();

    if (changed) {
      clearDbCache();
      broadcastRatesUpdate(rates);
      console.log(`[DB-Sync] (${triggerSource}) Rates synchronized (Parallel USD: ${rates.parallel.USD}, Official USD: ${rates.official.USD}, LastUpdated: ${rates.lastUpdated})`);
    }

    return changed;
  } catch (err) {
    console.error(`[DB-Sync] Failed to sync rates from DB:`, err);
    return false;
  }
}

export async function initializeRatesFromDB(force = false) {
  if (!force && lastRatesFetchTime > 0 && (Date.now() - lastRatesFetchTime < RATES_CACHE_TTL)) {
    return;
  }

  console.log(`[DB] Initializing rates from Supabase (force=${force})...`);
  await syncLatestRatesFromDB(force ? "Manual Refresh" : "Init Rates");
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

