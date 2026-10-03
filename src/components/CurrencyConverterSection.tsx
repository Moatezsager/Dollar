import React from "react";
import { motion } from "motion/react";
import { ArrowLeftRight, ArrowUpDown, RefreshCw, ChevronDown, Coins } from "lucide-react";
import { METAL_IDS } from "../types/rates";

interface CurrencyConverterSectionProps {
  activeTab: string;
  configTerms: any[];
  convCurrency: string;
  setConvCurrency: (currency: string) => void;
  convActiveField: 'top' | 'parallel' | 'official';
  setConvActiveField: (field: 'top' | 'parallel' | 'official') => void;
  convInputValue: string;
  setConvInputValue: (val: string) => void;
  topAmount: number;
  parallelAmount: number;
  officialAmount: number;
  triggerHaptic: (pattern?: number | number[]) => void;
}

export const CurrencyConverterSection: React.FC<CurrencyConverterSectionProps> = ({
  activeTab,
  configTerms,
  convCurrency,
  setConvCurrency,
  convActiveField,
  setConvActiveField,
  convInputValue,
  setConvInputValue,
  topAmount,
  parallelAmount,
  officialAmount,
  triggerHaptic,
}) => {
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

  return (
    <section id="currency-converter-section" className={`mt-16 ${activeTab === 'converter' ? '' : 'hidden md:block'}`}>
      <div className="relative max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner ring-1 ring-blue-500/20">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">المحول الذكي</h3>
            <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-mono font-bold">Premium Exchange Calculator</p>
          </div>
        </div>

        <div className="relative flex flex-col gap-2 z-10">
          {/* TOP CARD: Foreign Currency */}
          <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-700/60 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden group focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <RefreshCw className="w-40 h-40 text-blue-400 rotate-12" />
            </div>
            
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="w-full sm:w-1/3">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">
                  اختر العملة
                </label>
                <div className="relative">
                  <select 
                    value={convCurrency}
                    onChange={(e) => {
                      setConvCurrency(e.target.value);
                      if (convActiveField !== 'top') {
                        setConvActiveField('top');
                        setConvInputValue(topAmount.toString());
                      }
                    }}
                    className="w-full bg-[#1e293b]/80 border border-slate-600/50 rounded-2xl py-4 pl-4 pr-10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-[#1e293b] transition-colors"
                  >
                    {configTerms.filter(t => !METAL_IDS.includes(t.id) && t.id !== "OFFICIAL_USD").map(t => (
                      <option key={t.id} value={t.id} className="bg-[#0f172a]">{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex-1 w-full text-left" dir="ltr">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block text-right sm:text-left" dir="rtl">
                  المبلغ بالعملة الأجنبية
                </label>
                <motion.input 
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  type="text"
                  value={convActiveField === 'top' ? convInputValue : (topAmount ? (topAmount % 1 === 0 ? topAmount : topAmount.toFixed(2)) : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConvActiveField('top');
                    setConvInputValue(val);
                    const detected = detectCurrency(val);
                    if (detected && detected !== 'LYD') {
                      setConvCurrency(detected);
                    }
                  }}
                  className="w-full bg-transparent text-white font-mono text-5xl sm:text-6xl tracking-tighter font-light focus:outline-none appearance-none text-right sm:text-left placeholder-slate-700"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* FLOATING SWAP BUTTON */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9, rotate: -180 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                triggerHaptic(10);
                setConvActiveField('parallel');
              }}
              className="w-14 h-14 rounded-full bg-blue-600 border-4 border-[#09090b] shadow-[0_10px_30px_rgba(37,99,235,0.5)] flex items-center justify-center text-white outline-none focus:outline-none group"
            >
              <ArrowUpDown className="w-6 h-6" />
            </motion.button>
          </div>

          {/* BOTTOM CARD: Local Currency (LYD) */}
          <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-700/60 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
            <div className="absolute bottom-0 left-0 p-8 opacity-5">
              <Coins className="w-40 h-40 text-emerald-400 -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <label className="text-xs text-emerald-400/80 font-bold uppercase tracking-widest">
                  القيمة بالدينار الليبي (LYD)
                </label>
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  العملة المحلية
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Parallel Market */}
                <div className="bg-white/5 border border-slate-700/50 rounded-2xl p-4 focus-within:bg-emerald-500/10 focus-within:border-emerald-500/30 transition-colors">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">السوق الموازي</span>
                  <div className="flex items-center gap-2" dir="ltr">
                    <span className="text-emerald-400 font-bold">LYD</span>
                    <motion.input
                      whileFocus={{ scale: 1.05, x: 10 }}
                      type="number"
                      value={convActiveField === 'parallel' ? convInputValue : (parallelAmount ? (parallelAmount % 1 === 0 ? parallelAmount : parallelAmount.toFixed(2)) : '')}
                      onChange={(e) => {
                        setConvActiveField('parallel');
                        setConvInputValue(e.target.value);
                      }}
                      className="w-full bg-transparent text-3xl font-mono tracking-tighter text-white focus:outline-none appearance-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Official Market */}
                <div className="bg-white/5 border border-slate-700/50 rounded-2xl p-4 focus-within:bg-indigo-500/10 focus-within:border-indigo-500/30 transition-colors">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">السعر الرسمي</span>
                  <div className="flex items-center gap-2" dir="ltr">
                    <span className="text-indigo-400 font-bold">LYD</span>
                    <motion.input
                      whileFocus={{ scale: 1.05, x: 10 }}
                      type="number"
                      value={convActiveField === 'official' ? convInputValue : (officialAmount ? (officialAmount % 1 === 0 ? officialAmount : officialAmount.toFixed(2)) : '')}
                      onChange={(e) => {
                        setConvActiveField('official');
                        setConvInputValue(e.target.value);
                      }}
                      className="w-full bg-transparent text-3xl font-mono tracking-tighter text-white focus:outline-none appearance-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
