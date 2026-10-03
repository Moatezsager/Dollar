import React from "react";
import { Coins } from "lucide-react";
import { Rates, METAL_IDS } from "../../types/rates";
import { RateCell } from "../RateCell";
import { RateSkeleton } from "../ui/RateSkeleton";

interface GoldMetalsSectionProps {
  activeTab: string;
  rates: Rates | null;
  configTerms: any[];
  staleCurrencies: Set<string>;
  trends24h: Record<string, { parallel?: number; official?: number }>;
  setSelectedRate: (rate: { code: string; name: string; market: 'official' | 'parallel' } | null) => void;
}

export const GoldMetalsSection: React.FC<GoldMetalsSectionProps> = ({
  activeTab,
  rates,
  configTerms,
  staleCurrencies,
  trends24h,
  setSelectedRate,
}) => {
  return (
    <div className={activeTab === 'gold' ? 'block space-y-8 md:space-y-16' : 'hidden md:block md:space-y-16'}>
      {/* Mobile Gold Header */}
      <div className="flex items-center gap-4 mb-2 md:hidden">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Coins className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">المعادن الثمينة</h2>
          <p className="text-xs text-slate-400 mt-0.5">أسعار الذهب والفضة لحظياً</p>
        </div>
      </div>

      <section id="metals-grid">
        <div className="flex items-center justify-between mb-6 group hidden md:flex">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gradient tracking-wide">المعادن الثمينة</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">أسعار الذهب والفضة</p>
            </div>
          </div>
        </div>
        {/* Precious Metals Grid (2 cards per row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          {(!rates || configTerms.length === 0) ? (
            Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
          ) : (
            configTerms.filter(t => METAL_IDS.includes(t.id) && !staleCurrencies.has(t.id))
              .map(term => {
              const rate = rates?.parallel[term.id] || 0;
              const prevRate = rates?.previousParallel?.[term.id] || rate;
              const isSilver = term.id.includes('SILVER');

              return (
                <RateCell
                  key={`parallel-${term.id}`}
                  term={term}
                  rate={rate}
                  prevRate={prevRate}
                  trend={trends24h[term.id]?.parallel}
                  lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                  decimals={isSilver ? 2 : 0}
                  onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
