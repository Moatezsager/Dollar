import React, { useId, useMemo, useState } from "react";
import {
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  FileText,
  ArrowLeftRight,
  Building2,
  Maximize2,
  ChartNoAxesCombined,
  WifiOff,
} from "lucide-react";
import {
  AreaChart,
  Area,
  YAxis,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Rates, CurrencyItem, HistoryPoint, METAL_IDS } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";
import { RateCell } from "../RateCell";
import { formatLibyaDate } from '../../utils/rateHistory';
import { RateSkeleton } from "../ui/RateSkeleton";
import { CashChecksSpreadSummary } from './CashChecksSpreadSummary';
import { PriceChartTooltip } from '../charts/PriceChartTooltip';

const chartClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

interface MainRatesGridProps {
  activeTab: string;
  rates: Rates | null;
  history: HistoryPoint[];
  isOffline: boolean;
  onOpenSpread: () => void;
  configTerms: any[];
  dynamicCurrencies: CurrencyItem[];
  staleCurrencies: Set<string>;
  trends24h: Record<string, { parallel?: number; official?: number }>;
  usdRate: number;
  prevUsdRate: number;
  usdFlash: 'up' | 'down' | null;
  usdLastChanged?: string;
  usdChecksRate: number;
  prevUsdChecksRate: number;
  usdChecksFlash: 'up' | 'down' | null;
  usdChecksLastChanged?: string;
  officialUsdRate: number;
  prevOfficialUsdRate: number;
  officialUsdFlash: 'up' | 'down' | null;
  officialUsdLastChanged?: string;
  usd24hStats: {
    high: number;
    low: number;
    avg: number;
    changePercent: number;
  };
  usdSparklineData: { time: string; value: number }[];
  expandedSections: Record<string, boolean>;
  toggleSection: (sectionId: string) => void;
  setSelectedRate: (rate: { code: string; name: string; market: 'official' | 'parallel' } | null) => void;
}

export const MainRatesGrid: React.FC<MainRatesGridProps> = ({
  activeTab,
  rates,
  history,
  isOffline,
  onOpenSpread,
  configTerms,
  dynamicCurrencies,
  staleCurrencies,
  trends24h,
  usdRate,
  prevUsdRate,
  usdFlash,
  usdLastChanged,
  usdChecksRate,
  prevUsdChecksRate,
  usdChecksFlash,
  usdChecksLastChanged,
  officialUsdRate,
  prevOfficialUsdRate,
  officialUsdFlash,
  officialUsdLastChanged,
  usd24hStats,
  usdSparklineData,
  expandedSections,
  toggleSection,
  setSelectedRate,
}) => {
  const [chartTimeframe, setChartTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const fillId = useId();

  const cleanArabicDistance = (rawStr: string) => {
    if (!rawStr) return 'منذ قليل';
    let cleaned = rawStr.replace(/تقريباً|تقريبا|حوالي/g, '').replace(/\s+/g, ' ').trim();
    if (cleaned && !cleaned.startsWith('منذ')) {
      cleaned = `منذ ${cleaned}`;
    }
    return cleaned || 'منذ قليل';
  };

  const getShortTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'منذ ثوانٍ';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'منذ ثوانٍ';
      const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
      if (diffSec < 45) return `منذ ${diffSec < 5 ? 'ثوانٍ' : `${diffSec} ث`}`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin === 1) return 'منذ دقيقة';
      if (diffMin === 2) return 'منذ دقيقتين';
      if (diffMin < 60) return `منذ ${diffMin} د`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours === 1) return 'منذ ساعة';
      if (diffHours === 2) return 'منذ ساعتين';
      if (diffHours < 24) return `منذ ${diffHours} س`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'منذ يوم';
      if (diffDays === 2) return 'منذ يومين';
      return `منذ ${diffDays} ي`;
    } catch {
      return 'منذ ثوانٍ';
    }
  };

  // Dynamic Chart Data and Statistics based on selected timeframe
  const { filteredChartData, filteredChartStats } = useMemo(() => {
    const now = Date.now();
    let cutoffMs = now - 24 * 60 * 60 * 1000;
    if (chartTimeframe === 'week') {
      cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    } else if (chartTimeframe === 'month') {
      cutoffMs = now - 30 * 24 * 60 * 60 * 1000;
    }

    const rawPoints = (history || [])
      .filter((h) => {
        if (!h.time) return false;
        const t = new Date(h.time).getTime();
        return !isNaN(t) && t >= cutoffMs;
      })
      .map((h) => ({
        time: new Date(h.time).toISOString(),
        value: Number(h.usdParallel || h.ratesParallel?.USD || 0)
      }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0);

    rawPoints.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const points = rawPoints;
    if (points.length < 2) {
      return { filteredChartData: [], filteredChartStats: { high: 0, low: 0, avg: 0, changeVal: 0, changePercent: 0, prevVal: 0 } };
    }

    const values = points.map((p) => p.value);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const firstVal = points[0].value;
    const lastVal = points[points.length - 1].value;
    const changeVal = lastVal - firstVal;
    const changePercent = firstVal > 0 ? (changeVal / firstVal) * 100 : 0;

    return {
      filteredChartData: points,
      filteredChartStats: { high, low, avg, changeVal, changePercent, prevVal: firstVal }
    };
  }, [history, chartTimeframe, usdRate, prevUsdRate]);
  const chartLast = filteredChartData[filteredChartData.length - 1];
  const chartColor = filteredChartStats.changeVal > 0 ? 'var(--positive)' : filteredChartStats.changeVal < 0 ? 'var(--negative)' : 'var(--official)';
  const ChartTrendIcon = filteredChartStats.changeVal > 0 ? ArrowUpRight : filteredChartStats.changeVal < 0 ? ArrowDownRight : Minus;
  const chartPeriod = chartTimeframe === 'today' ? 'آخر 24 ساعة' : chartTimeframe === 'week' ? 'آخر 7 أيام' : 'آخر 30 يومًا';
  const chartSpan = Math.max(filteredChartStats.high - filteredChartStats.low, 0.04);
  return (
    <div id="rates-section" className={`rates-dashboard ${activeTab === 'main' ? 'space-y-4 sm:space-y-5' : 'hidden md:block md:space-y-8'}`}>
      {/* Sub-Header: Minimalist Modern Financial Bar */}
      <div className="rates-meta flex flex-wrap items-center justify-between gap-2 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
          </span>
          <h2 className="text-xs sm:text-sm font-black text-white tracking-wide">
            أسعار العملات
          </h2>
          <span className="text-white/20 text-xs">|</span>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-400 font-medium truncate">
            <Clock className="w-3 h-3 text-emerald-400/90 shrink-0" />
            <span className="text-slate-400">آخر تحديث:</span>
            <span className="text-slate-200 font-bold">{rates?.lastUpdated ? cleanArabicDistance(formatDistanceToNow(new Date(rates.lastUpdated), { addSuffix: true, locale: ar })) : 'منذ قليل'}</span>
          </div>
        </div>

        {!rates?.lastUpdated && <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shadow-sm">
            بانتظار البيانات
          </span>
        </div>}
      </div>

      {/* 3 Dollar Cards Grid (Side-by-Side in 3 Columns) */}
      <div className="primary-rates dollar-cards grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* 1. كرت الموازي (كاش) */}
        {(() => {
          const rawDiff = usdRate - prevUsdRate;
          const isUp = rawDiff >= 0.005;
          const isDown = rawDiff <= -0.005;
          const isChange = isUp || isDown;
          const priceColor = usdFlash === 'up' ? 'text-emerald-300' : usdFlash === 'down' ? 'text-rose-300' : isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-white';

          return (
            <div 
              role="button"
              tabIndex={0}
              aria-label="عرض تفاصيل الدولار النقدي في السوق الموازي"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
              onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (كاش موازي)', market: 'parallel' })}
              className={`primary-rate-card bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
                usdFlash === 'up' ? 'ring-2 ring-emerald-500/40 bg-emerald-500/5' : usdFlash === 'down' ? 'ring-2 ring-rose-500/40 bg-rose-500/5' : ''
              }`}
            >
              {/* Top Bar: Flag + Title + Subtitle */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <FlagIcon flagCode="us" name="US" className="w-full h-full" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] sm:text-sm font-black text-white tracking-tight leading-tight">دولار</span>
                  <span className="text-[9px] sm:text-[11px] text-slate-400 font-medium leading-tight">كاش</span>
                </div>
              </div>

              {/* Price & Change Badge Row */}
              <div data-tour="primary-price" className="my-auto py-1.5 flex flex-col gap-1 sm:gap-1.5">
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight tabular-nums ${priceColor}`}>
                    {usdRate > 0 ? usdRate.toFixed(2) : '—'}
                  </span>
                  <span className="text-[9px] sm:text-xs font-bold text-slate-400">د.ل</span>
                </div>

                <div className="min-h-[22px] sm:min-h-[26px] flex items-center">
                  {isChange ? (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md border shadow-sm ${
                      isUp 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}>
                      {isUp ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      <span dir="ltr">{isUp ? '+' : ''}{rawDiff.toFixed(2)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-medium text-slate-300 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                      <Minus className="w-2.5 h-2.5 text-slate-400" />
                      <span>مستقر</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-1.5 sm:pt-2 border-t border-white/[0.07] flex flex-col gap-0.5 text-[9px] sm:text-xs text-slate-400 mt-auto">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500 font-sans text-[8.5px] sm:text-[10.5px]">السابق:</span>
                  <span dir="ltr" className="text-slate-300 font-bold">{prevUsdRate > 0 ? prevUsdRate.toFixed(2) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-sans text-[8px] sm:text-[10px]">
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 shrink-0" />
                    <span>تحديث:</span>
                  </span>
                  <span className="text-slate-400 truncate">{getShortTimeAgo(usdLastChanged)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. كرت المصارف (صكوك) */}
        {(() => {
          const rawDiff = usdChecksRate - prevUsdChecksRate;
          const isUp = rawDiff >= 0.005;
          const isDown = rawDiff <= -0.005;
          const isChange = isUp || isDown;
          const priceColor = usdChecksFlash === 'up' ? 'text-emerald-300' : usdChecksFlash === 'down' ? 'text-rose-300' : isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-white';

          return (
            <div 
              role="button"
              tabIndex={0}
              aria-label="عرض تفاصيل الدولار بالصكوك"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
              onClick={() => setSelectedRate({ code: 'USD_CHECKS', name: 'دولار أمريكي (صكوك)', market: 'parallel' })}
              className={`primary-rate-card bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
                usdChecksFlash === 'up' ? 'ring-2 ring-emerald-500/40 bg-emerald-500/5' : usdChecksFlash === 'down' ? 'ring-2 ring-rose-500/40 bg-rose-500/5' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <FlagIcon flagCode="us" name="US" fallbackType="building" className="w-full h-full" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] sm:text-sm font-black text-white tracking-tight leading-tight">دولار</span>
                  <span className="text-[9px] sm:text-[11px] text-slate-400 font-medium leading-tight">صكوك</span>
                </div>
              </div>

              <div className="my-auto py-1.5 flex flex-col gap-1 sm:gap-1.5">
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight tabular-nums ${priceColor}`}>
                    {usdChecksRate > 0 ? usdChecksRate.toFixed(2) : '—'}
                  </span>
                  <span className="text-[9px] sm:text-xs font-bold text-slate-400">د.ل</span>
                </div>

                <div className="min-h-[22px] sm:min-h-[26px] flex items-center">
                  {isChange ? (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md border shadow-sm ${
                      isUp 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}>
                      {isUp ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      <span dir="ltr">{isUp ? '+' : ''}{rawDiff.toFixed(2)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-medium text-slate-300 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                      <Minus className="w-2.5 h-2.5 text-slate-400" />
                      <span>مستقر</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-1.5 sm:pt-2 border-t border-white/[0.07] flex flex-col gap-0.5 text-[9px] sm:text-xs text-slate-400 mt-auto">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500 font-sans text-[8.5px] sm:text-[10.5px]">السابق:</span>
                  <span dir="ltr" className="text-slate-300 font-bold">{prevUsdChecksRate > 0 ? prevUsdChecksRate.toFixed(2) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-sans text-[8px] sm:text-[10px]">
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 shrink-0" />
                    <span>تحديث:</span>
                  </span>
                  <span className="text-slate-400 truncate">{getShortTimeAgo(usdChecksLastChanged)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. كرت المركزي (رسمي) */}
        {(() => {
          const rawDiff = (Math.round(officialUsdRate * 10000) - Math.round(prevOfficialUsdRate * 10000)) / 10000;
          const isUp = rawDiff > 0;
          const isDown = rawDiff < 0;
          const isChange = isUp || isDown;
          const priceColor = officialUsdFlash === 'up' ? 'text-emerald-300' : officialUsdFlash === 'down' ? 'text-rose-300' : isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-white';

          return (
            <div 
              role="button"
              tabIndex={0}
              aria-label="عرض تفاصيل الدولار الرسمي"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
              onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (رسمي)', market: 'official' })}
              className={`primary-rate-card bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
                officialUsdFlash === 'up' ? 'ring-2 ring-emerald-500/40 bg-emerald-500/5' : officialUsdFlash === 'down' ? 'ring-2 ring-rose-500/40 bg-rose-500/5' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <FlagIcon flagCode="us" name="US" className="w-full h-full" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] sm:text-sm font-black text-white tracking-tight leading-tight">دولار</span>
                  <span className="text-[9px] sm:text-[11px] text-slate-400 font-medium leading-tight">رسمي</span>
                </div>
              </div>

              <div className="my-auto py-1.5 flex flex-col gap-1 sm:gap-1.5">
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight tabular-nums ${priceColor}`}>
                    {officialUsdRate > 0 ? officialUsdRate.toFixed(4) : '—'}
                  </span>
                  <span className="text-[9px] sm:text-xs font-bold text-slate-400">د.ل</span>
                </div>

                <div className="min-h-[22px] sm:min-h-[26px] flex items-center">
                  {isChange ? (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md border shadow-sm ${
                      isUp 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}>
                      {isUp ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      <span dir="ltr">{isUp ? '+' : ''}{rawDiff.toFixed(4)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-mono font-medium text-slate-300 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                      <Minus className="w-2.5 h-2.5 text-slate-400" />
                      <span>مستقر</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-1.5 sm:pt-2 border-t border-white/[0.07] flex flex-col gap-0.5 text-[9px] sm:text-xs text-slate-400 mt-auto">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500 font-sans text-[8.5px] sm:text-[10.5px]">السابق:</span>
                  <span dir="ltr" className="text-slate-300 font-bold">{prevOfficialUsdRate > 0 ? prevOfficialUsdRate.toFixed(4) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-sans text-[8px] sm:text-[10px]">
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 shrink-0" />
                    <span>آخر تغير:</span>
                  </span>
                  <span className="text-slate-400 truncate">{formatLibyaDate(officialUsdLastChanged || '')}</span>
                </div>
              </div>
            </div>
          );
        })()}
        {rates && configTerms.find(term => term.id === 'EUR' && !staleCurrencies.has(term.id)) && (() => {
          const euro = configTerms.find(term => term.id === 'EUR')!;
          return (
            <div className="eur-feature" key="parallel-EUR">
              <RateCell
                term={euro}
                rate={rates.parallel?.EUR || 0}
                prevRate={rates.previousParallel?.EUR || rates.parallel?.EUR || 0}
                trend={trends24h.EUR?.parallel}
                lastChangedDate={rates.lastChanged?.parallel?.EUR || rates.lastUpdated}
                onClick={() => setSelectedRate({ code: 'EUR', name: euro.name, market: 'parallel' })}
              />
            </div>
          );
        })()}
      </div>

      <CashChecksSpreadSummary history={history} rates={rates} isOffline={isOffline} onOpenDetails={onOpenSpread} />

      <section className="usd-chart" aria-labelledby={`${fillId}-title`} style={{ '--chart-color': chartColor } as React.CSSProperties}>
        <header className="usd-chart-header">
          <div className="usd-chart-title"><FlagIcon flagCode="us" name="الدولار الأمريكي" className="usd-chart-flag" />
            <div><h3 id={`${fillId}-title`}>حركة الدولار</h3><p>كاش · السوق الموازي <span dir="ltr">USD / LYD</span></p></div>
          </div>
          <button type="button" className="usd-chart-expand" aria-label="عرض تفاصيل حركة الدولار" title="عرض تفاصيل حركة الدولار"
            onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (كاش موازي)', market: 'parallel' })}><Maximize2 size={18} aria-hidden="true" /></button>
        </header>
        <div className="usd-chart-overview">
          <div className="usd-chart-quote"><span>آخر رصد في الفترة</span><div><strong dir="ltr">{chartLast ? chartLast.value.toFixed(2) : '—'}</strong><span>د.ل</span></div></div>
          <div className="usd-chart-performance">
            <span className="usd-chart-change"><ChartTrendIcon size={17} aria-hidden="true" /><b dir="ltr">{chartLast ? `${filteredChartStats.changePercent > 0 ? '+' : ''}${filteredChartStats.changePercent.toFixed(2)}%` : '—'}</b></span>
            <span>{chartPeriod}</span>
          </div>
        </div>
        <div className="usd-chart-toolbar">
          <div className="usd-chart-ranges" role="group" aria-label="فترة حركة الدولار">
            {([{ value: 'today', label: '24 ساعة' }, { value: 'week', label: '7 أيام' }, { value: 'month', label: '30 يومًا' }] as const).map(item =>
              <button type="button" key={item.value} aria-pressed={chartTimeframe === item.value} onClick={() => setChartTimeframe(item.value)}>{item.label}</button>)}
          </div>
          <span className="usd-chart-unit">دينار لكل دولار</span>
        </div>
        <div className="market-chart usd-chart-plot" role="group" aria-label="حركة سعر الدولار مقابل الدينار الليبي" aria-describedby={chartLast ? `${fillId}-summary` : undefined}>
          {filteredChartData.length < 2 ? (
            <div role="status" className="usd-chart-empty"><ChartNoAxesCombined size={28} aria-hidden="true" /><p>لا توجد بيانات تاريخية كافية لهذه الفترة</p></div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredChartData} accessibilityLayer margin={{ top: 18, right: 4, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.18}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 7" />
              <YAxis domain={[Math.max(0, filteredChartStats.low - chartSpan * 0.18), filteredChartStats.high + chartSpan * 0.18]} orientation="right" width={64} tickCount={4} tickMargin={10} axisLine={false} tickLine={false}
                tick={{ fill: 'var(--muted-ink)', fontSize: 12 }} tickFormatter={value => Math.abs(value - chartLast!.value) < chartSpan * 0.12 ? '' : value.toFixed(2)} />
              <XAxis
                dataKey={point => Date.parse(point.time)}
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-ink)', fontSize: 12 }}
                tickFormatter={time => chartTimeframe === 'today' ? chartClock.format(time) : formatLibyaDate(time).slice(0, 5)}
                minTickGap={36} tickMargin={12} padding={{ left: 8, right: 12 }}
              />
              <ReferenceLine y={chartLast!.value} stroke={chartColor} strokeOpacity={0.45} strokeDasharray="3 5" label={({ viewBox }) =>
                <g className="usd-chart-price-marker" transform={`translate(${viewBox.x + viewBox.width + 6}, ${viewBox.y})`} aria-hidden="true">
                  <rect x="0" y="-12" width="54" height="24" rx="4" fill={chartColor} /><text x="27" y="1" textAnchor="middle" dominantBaseline="middle" fill="var(--page)">{chartLast!.value.toFixed(2)}</text>
                </g>} />
              <ReferenceDot x={Date.parse(chartLast!.time)} y={chartLast!.value} r={4} fill={chartColor} stroke="var(--surface)" strokeWidth={2} />
              <Tooltip content={({ active, payload }) => <PriceChartTooltip active={active} payload={payload} caption="دولار كاش" unit="د.ل لكل دولار" color={chartColor} />} />
              <Area 
                type="monotoneX"
                dataKey="value" 
                stroke={chartColor}
                strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" connectNulls={false}
                fill={`url(#${fillId})`}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: chartColor, stroke: 'var(--surface)', strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        {chartLast && <>
          <dl className="usd-chart-stats">
            <div><dt>أعلى سعر</dt><dd dir="ltr">{filteredChartStats.high.toFixed(2)}</dd></div>
            <div><dt>أدنى سعر</dt><dd dir="ltr">{filteredChartStats.low.toFixed(2)}</dd></div>
            <div><dt>متوسط القراءات</dt><dd dir="ltr">{filteredChartStats.avg.toFixed(2)}</dd></div>
          </dl>
          <p id={`${fillId}-summary`} className="sr-only">{chartPeriod}: من {filteredChartStats.prevVal.toFixed(2)} إلى {chartLast.value.toFixed(2)} دينار للدولار. التغير {filteredChartStats.changePercent.toFixed(2)}%.</p>
          <div className="usd-chart-observation"><span>{isOffline ? <><WifiOff size={13} aria-hidden="true" />بيانات محفوظة</> : 'آخر رصد'}</span><time dateTime={chartLast.time} dir="ltr">{formatLibyaDate(chartLast.time)} · {chartClock.format(Date.parse(chartLast.time))}</time></div>
        </>}
      </section>

      {/* Section: أسعار السوق الموازي */}
      <div className="parallel-rates">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
            أسعار السوق الموازي
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleSection('foreign')}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <span>{expandedSections.foreign ? 'عرض أقل' : 'عرض الكل'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expandedSections.foreign ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Foreign Currency Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {(!rates || configTerms.length === 0) ? (
            Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
          ) : (
            configTerms.filter(t => t.id !== "USD" && t.id !== "EUR" && t.id !== "OFFICIAL_USD" && !t.id.startsWith("USD_") && !METAL_IDS.includes(t.id) && !staleCurrencies.has(t.id))
              .slice(0, expandedSections.foreign ? undefined : 6)
              .map(term => {
                const rate = rates?.parallel[term.id] || 0;
                const prevRate = rates?.previousParallel?.[term.id] || rate;
                return (
                  <RateCell
                    key={`parallel-${term.id}`}
                    term={term}
                    rate={rate}
                    prevRate={prevRate}
                    trend={trends24h[term.id]?.parallel}
                    lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                    onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                  />
                );
              })
          )}
        </div>
      </div>

      {/* Collapsible Checks & Transfers Sections */}
      <section id="main-rates-grid" className="settlement-rates space-y-6 pt-4 border-t border-slate-800/60">
        {/* Bank Checks Group */}
        <div id="checks-grid">
          <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('checks')}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-300">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gradient tracking-wide">صكوك المصارف</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">دولار أمريكي (USD)</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.checks ? 'rotate-180' : ''}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {(!rates || configTerms.length === 0) ? (
              Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
            ) : (
              configTerms.filter(t => t.id.startsWith("USD_") && !["USD_AE", "USD_TR", "USD_CN"].includes(t.id) && !staleCurrencies.has(t.id))
                .slice(0, expandedSections.checks ? undefined : 5)
                .map(term => {
                const rate = rates?.parallel[term.id] || 0;
                const prevRate = rates?.previousParallel?.[term.id] || rate;

                return (
                  <RateCell
                    key={`parallel-${term.id}`}
                    term={term}
                    rate={rate}
                    prevRate={prevRate}
                    trend={trends24h[term.id]?.parallel}
                    lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                    onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Transfers Group */}
        <div id="transfers-grid">
          <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('transfers')}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-105 transition-transform duration-300">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gradient tracking-wide">حوالات العملة</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">تحويلات خارج ليبيا</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.transfers ? 'rotate-180' : ''}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {(!rates || configTerms.length === 0) ? (
              Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
            ) : (
              configTerms.filter(t => ["USD_AE", "USD_TR", "USD_CN"].includes(t.id) && !staleCurrencies.has(t.id))
                .slice(0, expandedSections.transfers ? undefined : 5)
                .map(term => {
                const rate = rates?.parallel[term.id] || 0;
                const prevRate = rates?.previousParallel?.[term.id] || rate;

                return (
                  <RateCell
                    key={`parallel-${term.id}`}
                    term={term}
                    rate={rate}
                    prevRate={prevRate}
                    trend={trends24h[term.id]?.parallel}
                    lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                    fallbackType="send"
                    onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                  />
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Official Market Table */}
      <section id="official-rates-grid" className="official-rates">
        <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('official')}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)] group-hover:scale-105 transition-transform duration-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gradient tracking-wide">السوق الرسمي</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">مصرف ليبيا المركزي</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.official ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {(!rates || dynamicCurrencies.length === 0) ? (
            Array(6).fill(0).map((_, i) => <RateSkeleton key={i} />)
          ) : (
            dynamicCurrencies
              .slice(0, expandedSections.official ? undefined : 6)
              .map(currency => {
              const rate = rates?.official[currency.code] || 0;
              const prevRate = rates?.previousOfficial?.[currency.code] || rate;

              return (
                <RateCell
                  key={`official-${currency.code}`}
                  term={{ id: currency.code, name: currency.name || currency.code, flag: currency.flag }}
                  rate={rate}
                  prevRate={prevRate}
                  trend={trends24h[currency.code]?.official}
                  decimals={4}
                  lastChangedDate={rates?.lastChanged?.official[currency.code]}
                  onClick={() => setSelectedRate({ code: currency.code, name: currency.name, market: 'official' })}
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
