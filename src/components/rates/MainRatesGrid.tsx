import React from "react";
import {
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  FileText,
  ArrowLeftRight,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Rates, CurrencyItem, METAL_IDS } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";
import { RateCell } from "../RateCell";
import { RateSkeleton } from "../ui/RateSkeleton";

interface MainRatesGridProps {
  activeTab: string;
  rates: Rates | null;
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

  return (
    <div className={activeTab === 'main' ? 'space-y-3 sm:space-y-5' : 'hidden md:block md:space-y-8'}>
      {/* Sub-Header: Minimalist Modern Financial Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
          </span>
          <h2 className="text-xs sm:text-sm font-black text-white tracking-wide">
            سعر الدولار
          </h2>
          <span className="text-white/20 text-xs">|</span>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-400 font-medium truncate">
            <Clock className="w-3 h-3 text-emerald-400/90 shrink-0" />
            <span className="text-slate-400">آخر تحديث:</span>
            <span className="text-slate-200 font-bold">{rates?.lastUpdated ? cleanArabicDistance(formatDistanceToNow(new Date(rates.lastUpdated), { addSuffix: true, locale: ar })) : 'منذ قليل'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shadow-sm">
            مباشر
          </span>
        </div>
      </div>

      {/* 3 Dollar Cards Grid (Side-by-Side in 3 Columns) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {/* 1. كرت الموازي (كاش) */}
        {(() => {
          const rawDiff = usdRate - prevUsdRate;
          const isUp = rawDiff >= 0.005;
          const isDown = rawDiff <= -0.005;
          const isChange = isUp || isDown;
          const priceColor = usdFlash === 'up' ? 'text-emerald-300' : usdFlash === 'down' ? 'text-rose-300' : isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-white';

          return (
            <div 
              onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (كاش موازي)', market: 'parallel' })}
              className={`bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
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
              <div className="my-auto py-1.5 flex flex-col gap-1 sm:gap-1.5">
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight tabular-nums ${priceColor}`}>
                    {usdRate > 0 ? usdRate.toFixed(2) : '9.55'}
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
                  <span dir="ltr" className="text-slate-300 font-bold">{prevUsdRate > 0 ? prevUsdRate.toFixed(2) : '9.53'}</span>
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
              onClick={() => setSelectedRate({ code: 'USD_CHECKS', name: 'دولار أمريكي (صكوك)', market: 'parallel' })}
              className={`bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
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
                    {usdChecksRate > 0 ? usdChecksRate.toFixed(2) : '9.78'}
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
                  <span dir="ltr" className="text-slate-300 font-bold">{prevUsdChecksRate > 0 ? prevUsdChecksRate.toFixed(2) : '9.80'}</span>
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
          const rawDiff = officialUsdRate - prevOfficialUsdRate;
          const isUp = rawDiff >= 0.005;
          const isDown = rawDiff <= -0.005;
          const isChange = isUp || isDown;
          const priceColor = officialUsdFlash === 'up' ? 'text-emerald-300' : officialUsdFlash === 'down' ? 'text-rose-300' : isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-white';

          return (
            <div 
              onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (رسمي)', market: 'official' })}
              className={`bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 sm:p-3.5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
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
                    {officialUsdRate > 0 ? officialUsdRate.toFixed(2) : '6.41'}
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
                  <span dir="ltr" className="text-slate-300 font-bold">{prevOfficialUsdRate > 0 ? prevOfficialUsdRate.toFixed(2) : '6.41'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-sans text-[8px] sm:text-[10px]">
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 shrink-0" />
                    <span>تحديث:</span>
                  </span>
                  <span className="text-slate-400 truncate">{getShortTimeAgo(officialUsdLastChanged)}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Unified 24-Hour Movement & Analytics Card */}
      <div className="bg-[#0c1322] border border-slate-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
              <FlagIcon flagCode="us" name="US" className="w-full h-full" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-wide">حركة الدولار (24 ساعة)</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-white/5">USD/LYD</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">سوق النقد الموازي · تحديث فوري</span>
            </div>
          </div>
        </div>

        {/* Sparkline Interactive Chart */}
        <div className="h-28 sm:h-36 w-full opacity-95 my-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usdSparklineData} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="figmaSparkline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={usdRate < prevUsdRate ? "#f43f5e" : "#10b981"} stopOpacity={0.35}/>
                  <stop offset="95%" stopColor={usdRate < prevUsdRate ? "#f43f5e" : "#10b981"} stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <YAxis domain={['dataMin - 0.02', 'dataMax + 0.02']} hide />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: "#070c18", 
                  border: "1px solid rgba(255,255,255,0.12)", 
                  borderRadius: "12px", 
                  color: "#fff", 
                  padding: "8px 12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)" 
                }}
                itemStyle={{ color: usdRate < prevUsdRate ? "#f43f5e" : "#10b981", fontFamily: "monospace", fontSize: "14px", fontWeight: "bold" }}
                labelStyle={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}
                labelFormatter={(label) => {
                  try {
                    return format(new Date(label as any), "dd MMM - HH:mm", { locale: ar });
                  } catch (e) {
                    return String(label);
                  }
                }}
                formatter={(val: number) => [`${val.toFixed(2)} د.ل`, 'سعر الدولار']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={usdRate < prevUsdRate ? "#f43f5e" : "#10b981"} 
                strokeWidth={2.5} 
                fill="url(#figmaSparkline)" 
                isAnimationActive={false}
                activeDot={{ r: 4, fill: "#070c18", stroke: usdRate < prevUsdRate ? "#f43f5e" : "#10b981", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom 4 Key Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-white/[0.06] text-center">
          <div className="p-2 rounded-xl bg-slate-900/40 border border-white/[0.03]">
            <span className="block text-[11px] text-slate-400 font-medium mb-0.5">أعلى سعر اليوم</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400 tabular-nums">
              {usd24hStats.high.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">د.ل</span>
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-white/[0.03]">
            <span className="block text-[11px] text-slate-400 font-medium mb-0.5">أدنى سعر اليوم</span>
            <span className="text-base sm:text-lg font-black font-mono text-rose-400 tabular-nums">
              {usd24hStats.low.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">د.ل</span>
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-white/[0.03]">
            <span className="block text-[11px] text-slate-400 font-medium mb-0.5">متوسط التداول</span>
            <span className="text-base sm:text-lg font-black font-mono text-slate-200 tabular-nums">
              {usd24hStats.avg.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">د.ل</span>
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-white/[0.03]">
            <span className="block text-[11px] text-slate-400 font-medium mb-0.5">الإغلاق السابق</span>
            <span className="text-base sm:text-lg font-black font-mono text-slate-400 tabular-nums">
              {prevUsdRate > 0 ? prevUsdRate.toFixed(2) : '9.53'} <span className="text-[10px] text-slate-400 font-sans">د.ل</span>
            </span>
          </div>
        </div>
      </div>

      {/* Section: أسعار السوق الموازي */}
      <div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          {(!rates || configTerms.length === 0) ? (
            Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
          ) : (
            configTerms.filter(t => t.id !== "USD" && t.id !== "OFFICIAL_USD" && !t.id.startsWith("USD_") && !METAL_IDS.includes(t.id) && !staleCurrencies.has(t.id))
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
      <section id="main-rates-grid" className="space-y-6 pt-4 border-t border-slate-800/60">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
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
      <section id="official-rates-grid">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
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
