import React from 'react';
import { ArrowDownRight, ArrowUpRight, Share2 } from 'lucide-react';
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
  onClick: () => void;
  onShare?: (e: React.MouseEvent) => void;
}

export const RateCell = ({ 
  term, 
  rate, 
  prevRate, 
  trend, 
  lastChangedDate, 
  fallbackType = "coins", 
  decimals = 2, 
  onClick, 
  onShare 
}: RateCellProps) => {
  const flash = usePriceFlash(rate);
  const isUp = rate > prevRate;
  const isDown = rate < prevRate;

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col group p-4 rounded-3xl transition-all duration-300 cursor-pointer relative overflow-hidden ${
        flash === 'up' 
          ? 'bg-gradient-to-br from-rose-500/20 to-rose-900/10 shadow-[0_0_30px_rgba(244,63,94,0.3)] border border-rose-500/30' 
          : flash === 'down' 
          ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30' 
          : 'glass-panel hover-lift premium-border'
      }`}
    >
      {/* Decorative ambient light */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/5 rounded-full blur-[30px] group-hover:bg-emerald-500/10 transition-colors duration-500 pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <FlagIcon flagCode={term.flag} name={term.name} fallbackType={fallbackType} />
          <span className="text-[13px] font-semibold text-zinc-300 drop-shadow-sm">{term.name}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {trend !== undefined && (
            <span className={`text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
              trend > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
          {onShare && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onShare(e);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30 flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-all duration-300"
              title="مشاركة الصورة"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-end gap-2 mb-2 relative z-10">
        <span className={`text-2xl sm:text-3xl font-light font-mono tracking-tighter transition-colors ${
          flash === 'up' ? 'text-rose-400 font-bold drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]' : flash === 'down' ? 'text-emerald-400 font-bold drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'text-white group-hover:text-emerald-400'
        }`}>{rate.toFixed(decimals)}</span>
        <div className="pb-1 sm:pb-1.5 flex items-center">
          {isUp ? <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 drop-shadow-sm" /> : isDown ? <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 drop-shadow-sm" /> : null}
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-white/5 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">السابق:</span>
          <span className="text-[11px] sm:text-[12px] text-zinc-400 font-mono tracking-wide" dir="ltr">{prevRate.toFixed(decimals)}</span>
        </div>
        {lastChangedDate && (
          <div className="text-[9px] sm:text-[10px] text-zinc-400 bg-white/5 border border-white/5 rounded-md px-2 py-0.5 whitespace-nowrap">
            {(() => {
              try {
                return formatDistanceToNow(new Date(lastChangedDate), { addSuffix: true, locale: ar });
              } catch (e) {
                return lastChangedDate;
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
