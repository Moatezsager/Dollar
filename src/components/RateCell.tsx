import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
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

export const RateCell = ({ term, rate, prevRate, trend, lastChangedDate, fallbackType = "coins", decimals = 2, onClick, onShare }: RateCellProps) => {
  const flash = usePriceFlash(rate);
  const isUp = rate > prevRate;
  const isDown = rate < prevRate;

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col group p-2.5 rounded-2xl transition-colors -m-2.5 cursor-pointer relative ${
        flash === 'up' ? 'bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : flash === 'down' ? 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <FlagIcon flagCode={term.flag} name={term.name} fallbackType={fallbackType} />
          <span className="text-[11px] font-medium text-zinc-400">{term.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
              trend > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
          {onShare && (
            <button 
              onClick={onShare}
              className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition-colors"
              title="مشاركة الصورة"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
          )}
        </div>
        
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-2xl font-light font-mono tracking-tight transition-colors ${
          flash === 'up' ? 'text-rose-400 font-bold drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' : flash === 'down' ? 'text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-white group-hover:text-emerald-400'
        }`}>{rate.toFixed(decimals)}</span>
        {isUp ? <ArrowUpRight className="w-3 h-3 text-rose-400" /> : isDown ? <ArrowDownRight className="w-3 h-3 text-emerald-400" /> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-zinc-700 font-mono" dir="ltr">السابق: {prevRate.toFixed(decimals)}</span>
        {lastChangedDate && <div className="text-[9px] text-zinc-600 bg-white/5 rounded px-1.5 py-0.5 whitespace-nowrap">
          {(() => {
            try {
              return formatDistanceToNow(new Date(lastChangedDate), { addSuffix: true, locale: ar });
            } catch (e) {
              return lastChangedDate;
            }
          })()}
        </div>}
      </div>
    </div>
  );
};
