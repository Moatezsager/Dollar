import React from 'react';
import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import { FlagIcon } from './FlagIcon';
import { usePriceFlash } from '../hooks/usePriceFlash';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RateCellProps {
  key?: string | number | null;
  term: { id: string; name: string; flag: string };
  rate: number;
  prevRate: number;
  trend?: number;
  lastChangedDate?: string;
  fallbackType?: "coins" | "building" | "send";
  decimals?: number;
  variant?: "card" | "horizontal";
  onClick: () => void;
  onShare?: (e: React.MouseEvent) => void;
}

const cleanArabicDistance = (rawStr: string) => {
  if (!rawStr) return 'منذ قليل';
  let cleaned = rawStr.replace(/تقريباً|تقريبا|حوالي/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned && !cleaned.startsWith('منذ')) {
    cleaned = `منذ ${cleaned}`;
  }
  return cleaned || 'منذ قليل';
};

const getSubLabel = (id: string, name: string) => {
  if (id.includes('GOLD_SCRAP_18')) return 'عيار 18 كسر';
  if (id.includes('GOLD_SCRAP_21')) return 'عيار 21 كسر';
  if (id.includes('GOLD_SCRAP_24')) return 'عيار 24 كسر';
  if (id.includes('GOLD_INGOT')) return 'سبيكة ذهب';
  if (id.includes('GOLD_LIRA')) return 'وزن 8 جرام';
  if (id.includes('SILVER')) return 'فضة نقية';
  if (id === 'USD') return 'دولار أمريكي';
  if (id === 'EUR') return 'يورو أوروبي';
  if (id === 'GBP') return 'جنيه إسترليني';
  if (id === 'TRY') return 'ليرة تركية';
  if (id === 'EGP') return 'جنيه مصري';
  if (id === 'TND') return 'دينار تونسي';
  if (id === 'AED') return 'درهم إماراتي';
  if (id === 'SAR') return 'ريال سعودي';
  if (id === 'CHF') return 'فرنك سويسري';
  if (id === 'CAD') return 'دولار كندي';
  if (id === 'JOD') return 'دينار أردني';
  return id.replace(/_/g, ' ');
};

export const RateCell = ({ 
  term, 
  rate, 
  prevRate, 
  trend, 
  lastChangedDate, 
  fallbackType = "coins", 
  decimals = 2, 
  onClick 
}: RateCellProps) => {
  const flash = usePriceFlash(rate);
  const rawDiff = rate - prevRate;
  const isUp = rawDiff >= 0.005;
  const isDown = rawDiff <= -0.005;
  const changePercent = prevRate > 0 && Math.abs(rawDiff) >= 0.005 
    ? ((rawDiff / prevRate) * 100) 
    : (trend ?? 0);
  const isTrendUp = changePercent >= 0.01 || isUp;
  const isTrendDown = changePercent <= -0.01 || isDown;
  const isChange = isTrendUp || isTrendDown;

  const priceColor = flash === 'up'
    ? 'text-emerald-400 font-bold'
    : flash === 'down'
    ? 'text-rose-400 font-bold'
    : isTrendUp
    ? 'text-emerald-400'
    : isTrendDown
    ? 'text-rose-400'
    : 'text-white';

  const subLabel = getSubLabel(term.id, term.name);
  const isGoldOrSilver = term.id.includes('GOLD') || term.id.includes('SILVER') || term.id.includes('METAL');

  return (
    <div 
      onClick={onClick}
      className={`bg-[#0c1322] hover:bg-[#101a2e] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 min-h-[160px] sm:min-h-[190px] flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg active:scale-[0.98] select-none relative group overflow-hidden ${
        flash === 'up' 
          ? 'shadow-[0_0_20px_rgba(16,185,129,0.25)] border-emerald-500/40 bg-emerald-500/10' 
          : flash === 'down' 
          ? 'shadow-[0_0_20px_rgba(244,63,94,0.25)] border-rose-500/40 bg-rose-500/10' 
          : ''
      }`}
    >
      {/* Top Bar: Icon + Name & Sublabel + Change Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
            <FlagIcon flagCode={term.flag || term.id} name={term.name} fallbackType={fallbackType} className="w-full h-full" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <span className="text-sm sm:text-base font-black text-white tracking-tight leading-snug break-normal">
              {term.name}
            </span>
            <span className="text-xs text-slate-400 font-semibold leading-tight mt-0.5 truncate">
              {subLabel}
            </span>
          </div>
        </div>

        {/* Change indicator badge */}
        <div className="shrink-0 pt-0.5">
          {isChange ? (
            <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 sm:px-2.5 py-1 rounded-lg border shadow-sm ${
              isTrendUp 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
            }`}>
              {isTrendUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span dir="ltr">{isTrendUp ? '+' : ''}{changePercent.toFixed(2)}%</span>
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-mono font-semibold text-slate-200 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">
              مستقر
            </span>
          )}
        </div>
      </div>

      {/* Main Rate Value (Hero Centerpiece with balanced spacing) */}
      <div className="my-auto py-2.5 sm:py-3.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className={`text-2xl sm:text-3xl lg:text-[2.25rem] font-black font-mono tracking-tight tabular-nums ${priceColor}`}>
            {rate.toFixed(decimals)}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded-md border border-white/5 shadow-inner">
            د.ل
          </span>
        </div>
      </div>

      {/* Footer: Previous Rate + Last Changed */}
      <div className="pt-2.5 sm:pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400 font-mono gap-1">
        <div className="flex items-center gap-1 truncate">
          <span className="text-slate-400 font-sans">السابق:</span>
          <span dir="ltr" className="text-slate-200 font-bold">{prevRate.toFixed(decimals)}</span>
        </div>
        {lastChangedDate && (
          <div className="flex items-center gap-1.5 text-slate-400 font-sans truncate text-[11px] sm:text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{cleanArabicDistance(formatDistanceToNow(new Date(lastChangedDate), { addSuffix: true, locale: ar }))}</span>
          </div>
        )}
      </div>
    </div>
  );
};
