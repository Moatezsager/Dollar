import { useState, useMemo } from "react";
import { Rates, HistoryPoint, CURRENCIES, METAL_IDS } from "../types/rates";
import { SearchableItem } from "../utils/smartSearch";
import { usePriceFlash } from "./usePriceFlash";
import { Minus, Activity, TrendingUp } from "lucide-react";

interface UseRatesCalculationsProps {
  rates: Rates | null;
  history: HistoryPoint[];
  configTerms: any[];
  selectedRate: { code: string; name: string; market: 'official' | 'parallel' } | null;
}

export function useRatesCalculations({
  rates,
  history,
  configTerms,
  selectedRate,
}: UseRatesCalculationsProps) {
  const [chartRange, setChartRange] = useState<'24h' | '7d' | 'all'>('7d');

  // Derive dynamic currencies from configTerms to support user-added currencies
  const dynamicCurrencies = useMemo(() => {
    if (configTerms.length === 0) return CURRENCIES;
    return configTerms
      .filter(t => t.id !== "OFFICIAL_USD" && !t.id.startsWith("USD_") && !METAL_IDS.includes(t.id))
      .map(t => ({ code: t.id, name: t.name, flag: t.flag }));
  }, [configTerms]);

  // Comprehensive official currency list
  const officialCurrencyList = useMemo(() => {
    const list = [...CURRENCIES];
    dynamicCurrencies.forEach(dc => {
      if (!list.some(item => item.code === dc.code)) {
        list.push({ code: dc.code, name: dc.name, flag: dc.flag });
      }
    });
    return list;
  }, [dynamicCurrencies]);

  const filteredHistory = useMemo(() => {
    if (!history.length) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    
    if (chartRange === '24h') {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (chartRange === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    if (!cutoff) return history;
    return history.filter(h => new Date(h.time) >= cutoff!);
  }, [history, chartRange]);

  const chartData = useMemo(() => {
    const targetRate = selectedRate || { code: 'USD', name: 'دولار أمريكي', market: 'parallel' as const };
    if (!filteredHistory.length) return [];
    
    const data = filteredHistory.map(h => {
      const rateObj = targetRate.market === 'parallel' ? h.ratesParallel : h.ratesOfficial;
      let value = 0;
      
      if (rateObj && rateObj[targetRate.code] !== undefined && rateObj[targetRate.code] !== null) {
        value = Number(rateObj[targetRate.code]);
      } 
      
      if (value === 0 && targetRate.code === 'USD') {
        value = targetRate.market === 'parallel' ? h.usdParallel : h.usdOfficial;
      }
      
      return {
        time: h.time,
        value: value
      };
    }).filter(d => d.value > 0);

    const sorted = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    if (sorted.length === 1) {
      return [
        { ...sorted[0], time: new Date(new Date(sorted[0].time).getTime() - 60000).toISOString() },
        sorted[0]
      ];
    }
    
    return sorted;
  }, [selectedRate, filteredHistory]);

  const chartStats = useMemo(() => {
    if (!chartData.length) return { max: 0, min: 0, avg: 0, isUp: true, change: 0, changePercent: 0 };
    const values = chartData.map(d => d.value);
    const first = values[0];
    const last = values[values.length - 1];
    const isUp = last >= first;
    const change = last - first;
    const changePercent = first !== 0 ? (change / first) * 100 : 0;
    return {
      max: Math.max(...values),
      min: Math.min(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      isUp,
      change,
      changePercent
    };
  }, [chartData]);

  const advancedStats = useMemo(() => {
    const targetRate = selectedRate || { code: 'USD', name: 'دولار أمريكي', market: 'parallel' as const };
    if (!history.length) return { ma30: 0, support: 0, resistance: 0 };
    
    const now = new Date();
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const elements30d = history.filter(h => new Date(h.time) >= cutoff30d).map(h => {
      const rateObj = targetRate.market === 'parallel' ? h.ratesParallel : h.ratesOfficial;
      let value = 0;
      if (rateObj && rateObj[targetRate.code] !== undefined && rateObj[targetRate.code] !== null) {
        value = Number(rateObj[targetRate.code]);
      } 
      if (value === 0 && targetRate.code === 'USD') {
        value = targetRate.market === 'parallel' ? h.usdParallel : h.usdOfficial;
      }
      return value;
    }).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    
    if (elements30d.length === 0) return { ma30: 0, support: 0, resistance: 0 };
    
    const sum = elements30d.reduce((a, b) => a + b, 0);
    const avg = sum / elements30d.length;
    const support = Math.min(...elements30d);
    const resistance = Math.max(...elements30d);
    
    return {
      ma30: avg,
      support,
      resistance
    };
  }, [history, selectedRate]);

  // 24h Trends
  const trends24h = useMemo(() => {
    if (!history.length || !rates) return {};
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const record24h = history.find(h => new Date(h.time) >= oneDayAgo) || history[0];
    if (!record24h) return {};

    const trends: Record<string, { parallel?: number, official?: number }> = {};

    Object.keys(rates.parallel).forEach(code => {
      const current = rates.parallel[code];
      const previous = record24h.ratesParallel?.[code] || (code === 'USD' ? record24h.usdParallel : null);
      if (current && previous) {
        trends[code] = { ...trends[code], parallel: ((current - previous) / previous) * 100 };
      }
    });

    dynamicCurrencies.forEach(curr => {
      const current = rates.official[curr.code];
      const previous = record24h.ratesOfficial?.[curr.code] || (curr.code === 'USD' ? record24h.usdOfficial : null);
      if (current && previous) {
        trends[curr.code] = { ...trends[curr.code], official: ((current - previous) / previous) * 100 };
      }
    });

    return trends;
  }, [history, rates, dynamicCurrencies]);

  // Stale currencies (> 7 days)
  const staleCurrencies = useMemo(() => {
    const result = new Set<string>();
    if (!history.length || configTerms.length === 0) return result;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    configTerms.forEach(term => {
      if (term.id === "USD" || term.id === "OFFICIAL_USD") return;

      const termPoints = history.map(h => ({
        time: new Date(h.time),
        value: h.ratesParallel ? (h.ratesParallel[term.id] || 0) : 0
      })).filter(h => h.value > 0);
      
      if (termPoints.length === 0) {
        result.add(term.id);
        return;
      }
      
      termPoints.sort((a, b) => a.time.getTime() - b.time.getTime());
      
      const latestValue = termPoints[termPoints.length - 1].value;
      const latestTime = termPoints[termPoints.length - 1].time;
      
      if (latestTime.getTime() < sevenDaysAgo.getTime()) {
        result.add(term.id);
        return;
      }
      
      let lastDifferentTime = null;
      for (let i = termPoints.length - 2; i >= 0; i--) {
        if (termPoints[i].value !== latestValue) {
          lastDifferentTime = termPoints[i].time;
          break;
        }
      }
      
      if (!lastDifferentTime) {
         if (termPoints[0].time.getTime() < sevenDaysAgo.getTime()) {
             result.add(term.id);
         }
      } else {
         if (lastDifferentTime.getTime() < sevenDaysAgo.getTime()) {
             result.add(term.id);
         }
      }
    });

    return result;
  }, [history, configTerms]);

  const marketStatus = useMemo(() => {
    const usdTrend = trends24h['USD']?.parallel || 0;
    const absChange = Math.abs(usdTrend);
    
    if (absChange < 0.5) {
      return { 
        label: 'مستقر', 
        description: 'السوق يشهد استقراراً نسبياً',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: Minus
      };
    } else if (absChange <= 2) {
      return { 
        label: 'متذبذب', 
        description: 'تغيرات ملحوظة في أسعار الصرف',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: Activity
      };
    } else {
      return { 
        label: 'شديد التقلب', 
        description: 'تقلبات حادة في السوق اليوم',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        icon: TrendingUp
      };
    }
  }, [trends24h]);

  // Converter State & Logic
  const [convActiveField, setConvActiveField] = useState<'top' | 'parallel' | 'official'>('top');
  const [convInputValue, setConvInputValue] = useState<string>('100');
  const [convCurrency, setConvCurrency] = useState<string>('USD');

  const detectCurrency = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('$') || lower.includes('usd') || lower.includes('دولار')) return 'USD';
    if (lower.includes('€') || lower.includes('eur') || lower.includes('يورو')) return 'EUR';
    if (lower.includes('£') || lower.includes('gbp') || lower.includes('باوند') || lower.includes('استرليني')) return 'GBP';
    if (lower.includes('tnd') || lower.includes('تونسي')) return 'TND';
    if (lower.includes('egp') || lower.includes('جنيه') || lower.includes('مصر')) return 'EGP';
    if (lower.includes('try') || lower.includes('₺') || lower.includes('ليرة') || lower.includes('تركي')) return 'TRY';
    if (lower.includes('cad') || lower.includes('كندي')) return 'CAD';
    if (lower.includes('aed') || lower.includes('درهم') || lower.includes('اماراتي')) return 'AED';
    if (lower.includes('sar') || lower.includes('ريال') || lower.includes('سعودي')) return 'SAR';
    if (lower.includes('lyd') || lower.includes('د.ل') || lower.includes('دينار') || lower.includes('ليبي')) return 'LYD';
    return null;
  };

  const extractNumber = (text: string) => {
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const { topAmount, parallelAmount, officialAmount } = useMemo(() => {
    if (!rates) return { topAmount: 0, parallelAmount: 0, officialAmount: 0 };
    
    const parallelRate = rates.parallel[convCurrency] || 1;
    const officialRate = rates.official[convCurrency] || 1;
    
    let top = 0;
    let parallel = 0;
    let official = 0;
    
    const parsedInput = extractNumber(convInputValue);
    const detected = detectCurrency(convInputValue);

    if (convActiveField === 'top') {
      if (detected === 'LYD') {
        parallel = parsedInput;
        top = parallelRate ? parallel / parallelRate : 0;
        official = top * officialRate;
      } else {
        top = parsedInput;
        parallel = top * parallelRate;
        official = top * officialRate;
      }
    } else if (convActiveField === 'parallel') {
      parallel = parsedInput;
      top = parallelRate ? parallel / parallelRate : 0;
      official = top * officialRate;
    } else if (convActiveField === 'official') {
      official = parsedInput;
      top = officialRate ? official / officialRate : 0;
      parallel = top * parallelRate;
    }
    
    return { topAmount: top, parallelAmount: parallel, officialAmount: official };
  }, [convActiveField, convInputValue, convCurrency, rates]);

  // Flagship USD calculations
  const usdRate = rates?.parallel["USD"] || 0;
  const usdFlash = usePriceFlash(usdRate);
  const prevUsdRate = rates?.previousParallel?.["USD"] || usdRate;
  const usdIsUp = usdRate > prevUsdRate;
  const usdIsDown = usdRate < prevUsdRate;
  const usdChange = Math.abs(usdRate - prevUsdRate);

  const usdChecksRate = rates?.parallel["USD_JBANK"] || rates?.parallel["USD_NCB"] || rates?.parallel["USD_CHECKS"] || 0;
  const prevUsdChecksRate = rates?.previousParallel?.["USD_JBANK"] || rates?.previousParallel?.["USD_NCB"] || rates?.previousParallel?.["USD_CHECKS"] || usdChecksRate;
  const usdChecksIsUp = usdChecksRate > prevUsdChecksRate;
  const usdChecksIsDown = usdChecksRate < prevUsdChecksRate;
  const usdChecksFlash = usePriceFlash(usdChecksRate);
  const usdChecksChange = Math.abs(usdChecksRate - prevUsdChecksRate);
  const usdChecksSpread = usdChecksRate - usdRate;
  const usdChecksLastChanged = rates?.lastChanged?.parallel?.["USD_JBANK"] || rates?.lastChanged?.parallel?.["USD_NCB"] || rates?.lastChanged?.parallel?.["USD_CHECKS"] || rates?.lastUpdated;
  const usdLastChanged = rates?.lastChanged?.parallel?.["USD"] || rates?.lastUpdated;

  const officialUsdRate = rates?.official?.["USD"] || 0;
  const prevOfficialUsdRate = rates?.previousOfficial?.["USD"] || officialUsdRate;
  const officialUsdFlash = usePriceFlash(officialUsdRate);
  const officialUsdLastChanged = rates?.lastChanged?.official?.["USD"] || rates?.lastUpdated;

  const usd24hStats = useMemo(() => {
    const defaultVal = {
      high: usdRate || 9.55,
      low: prevUsdRate > 0 ? Math.min(usdRate, prevUsdRate) : (usdRate > 0 ? usdRate - 0.05 : 9.50),
      avg: usdRate || 9.55,
      changePercent: prevUsdRate > 0 && usdRate > 0 ? ((usdRate - prevUsdRate) / prevUsdRate) * 100 : 0.84
    };
    if (!history || !history.length) return defaultVal;

    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const points24h = history
      .filter(h => new Date(h.time).getTime() >= cutoff24h)
      .map(h => h.usdParallel || (h.ratesParallel?.USD) || 0)
      .filter(v => typeof v === 'number' && v > 0);

    if (usdRate > 0) points24h.push(usdRate);
    if (prevUsdRate > 0) points24h.push(prevUsdRate);

    if (points24h.length === 0) return defaultVal;

    const high = Math.max(...points24h);
    const low = Math.min(...points24h);
    const avg = points24h.reduce((a, b) => a + b, 0) / points24h.length;
    const change = prevUsdRate > 0 ? ((usdRate - prevUsdRate) / prevUsdRate) * 100 : 0;

    return {
      high,
      low,
      avg,
      changePercent: change
    };
  }, [history, usdRate, prevUsdRate]);

  const usdSparklineData = useMemo(() => {
    if (!history || !history.length) {
      const base = usdRate || 9.55;
      return [
        { time: '1', value: base - 0.08 },
        { time: '2', value: base - 0.06 },
        { time: '3', value: base - 0.04 },
        { time: '4', value: base - 0.01 },
        { time: '5', value: base - 0.03 },
        { time: '6', value: base + 0.02 },
        { time: '7', value: base },
        { time: '8', value: base + 0.03 },
        { time: '9', value: base + 0.05 },
      ];
    }
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const pts = history
      .filter(h => new Date(h.time).getTime() >= cutoff24h)
      .map(h => ({
        time: h.time,
        value: h.usdParallel || (h.ratesParallel?.USD) || usdRate
      }))
      .filter(p => p.value > 0);

    if (pts.length < 3) {
      const base = usdRate || 9.55;
      return [
        { time: '1', value: prevUsdRate || base - 0.04 },
        { time: '2', value: base - 0.02 },
        { time: '3', value: base }
      ];
    }
    return pts;
  }, [history, usdRate, prevUsdRate]);

  // Smart Search All Items
  const allSearchableItems: SearchableItem[] = useMemo(() => {
    if (!rates) return [];
    const list: SearchableItem[] = [];

    // 1. Parallel USD Cash
    list.push({
      id: 'USD',
      code: 'USD',
      name: 'دولار أمريكي (كاش)',
      category: 'parallel',
      categoryLabel: 'سوق موازي • كاش',
      flag: 'us',
      aliases: ['دولار', 'دولر', 'كاش', 'امريكي', 'dollar', 'usd', 'نقدي', 'ورق', 'طرابلس', 'بنغازي'],
      rate: usdRate,
      prevRate: prevUsdRate,
      trend: trends24h['USD']?.parallel,
      lastChangedDate: rates?.lastChanged?.parallel?.['USD'],
      decimals: 2
    });

    // 2. Parallel USD Checks Master
    list.push({
      id: 'USD_CHECKS',
      code: 'USD_CHECKS',
      name: 'دولار أمريكي (صكوك المصارف)',
      category: 'checks',
      categoryLabel: 'صكوك مصرفية',
      flag: 'building',
      aliases: ['صكوك', 'شكوك', 'شيك', 'شيكات', 'صك', 'صكوك المصارف', 'check', 'checks', 'دولار صكوك'],
      rate: usdChecksRate,
      prevRate: prevUsdChecksRate,
      trend: trends24h['USD_CHECKS']?.parallel,
      lastChangedDate: usdChecksLastChanged,
      decimals: 2
    });

    // 3. Foreign Currencies, Bank Checks, Transfers & Metals from configTerms
    configTerms.forEach(term => {
      if (term.id === 'USD' || term.id === 'OFFICIAL_USD') return;

      const isMetal = METAL_IDS.includes(term.id);
      const isCheck = term.id.startsWith('USD_') && !['USD_TR', 'USD_AE', 'USD_CN'].includes(term.id);
      const isTransfer = ['USD_TR', 'USD_AE', 'USD_CN'].includes(term.id);
      const isSilver = term.id.includes('SILVER');

      let category: SearchableItem['category'] = 'parallel';
      let categoryLabel = 'سوق موازي';

      if (isMetal) {
        category = 'metals';
        categoryLabel = isSilver ? 'فضة' : 'ذهب';
      } else if (isCheck) {
        category = 'checks';
        categoryLabel = 'صكوك مصرفية';
      } else if (isTransfer) {
        category = 'transfers';
        categoryLabel = 'حوالات خارجية';
      }

      const rate = rates.parallel?.[term.id] || 0;
      const prevRate = rates.previousParallel?.[term.id] || rate;

      list.push({
        id: term.id,
        code: term.id,
        name: term.name,
        category,
        categoryLabel,
        flag: term.flag || (isMetal ? (isSilver ? 'silver' : 'gold') : 'coins'),
        aliases: [],
        rate,
        prevRate,
        trend: trends24h[term.id]?.parallel,
        lastChangedDate: rates.lastChanged?.parallel?.[term.id],
        decimals: isSilver ? 2 : (isMetal ? 0 : 2)
      });
    });

    // 4. Official Central Bank Currencies
    dynamicCurrencies.forEach(curr => {
      const rate = rates.official?.[curr.code] || 0;
      const prevRate = rates.previousOfficial?.[curr.code] || rate;

      list.push({
        id: 'OFFICIAL_' + curr.code,
        code: curr.code,
        name: `${curr.name} (رسمي)`,
        category: 'official',
        categoryLabel: 'سعر رسمي • المركزي',
        flag: curr.flag,
        aliases: [curr.code, curr.name, 'رسمي', 'مركزي', 'مصرف ليبيا المركزي'],
        rate,
        prevRate,
        trend: trends24h[curr.code]?.official,
        lastChangedDate: rates.lastChanged?.official?.[curr.code],
        decimals: 4
      });
    });

    return list;
  }, [rates, configTerms, dynamicCurrencies, trends24h, usdRate, prevUsdRate, usdChecksRate, prevUsdChecksRate, usdChecksLastChanged]);

  return {
    chartRange,
    setChartRange,
    dynamicCurrencies,
    officialCurrencyList,
    filteredHistory,
    chartData,
    chartStats,
    advancedStats,
    trends24h,
    staleCurrencies,
    marketStatus,
    convActiveField,
    setConvActiveField,
    convInputValue,
    setConvInputValue,
    convCurrency,
    setConvCurrency,
    topAmount,
    parallelAmount,
    officialAmount,
    usdRate,
    prevUsdRate,
    usdIsUp,
    usdIsDown,
    usdChange,
    usdFlash,
    usdChecksRate,
    prevUsdChecksRate,
    usdChecksIsUp,
    usdChecksIsDown,
    usdChecksFlash,
    usdChecksChange,
    usdChecksSpread,
    usdChecksLastChanged,
    usdLastChanged,
    officialUsdRate,
    prevOfficialUsdRate,
    officialUsdFlash,
    officialUsdLastChanged,
    usd24hStats,
    usdSparklineData,
    allSearchableItems,
  };
}
