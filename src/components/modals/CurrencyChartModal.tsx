import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Calculator,
  CheckCircle2,
  Copy,
  Share2,
  TrendingUp
} from "lucide-react";
import { Rates, CURRENCIES } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";

interface CurrencyChartModalProps {
  selectedRate: { code: string; name: string; market: 'official' | 'parallel' } | null;
  setSelectedRate: (rate: { code: string; name: string; market: 'official' | 'parallel' } | null) => void;
  rates: Rates | null;
  configTerms: any[];
  chartData: { time: string; value: number }[];
  chartStats: {
    max: number;
    min: number;
    avg: number;
    isUp: boolean;
    change: number;
    changePercent: number;
  };
  advancedStats: {
    ma30: number;
    support: number;
    resistance: number;
  };
  chartRange: '24h' | '7d' | 'all';
  setChartRange: (range: '24h' | '7d' | 'all') => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  handleShareCardImage: (code: string, name: string, price: number, isGold?: boolean) => void;
}

export const CurrencyChartModal: React.FC<CurrencyChartModalProps> = ({
  selectedRate,
  setSelectedRate,
  rates,
  configTerms,
  chartData,
  chartStats,
  advancedStats,
  chartRange,
  setChartRange,
  triggerHaptic,
  handleShareCardImage,
}) => {
  const [modalCalcAmount, setModalCalcAmount] = useState<number>(100);
  const [copiedModalRate, setCopiedModalRate] = useState(false);

  return (
    <AnimatePresence>
      {selectedRate && (() => {
        const currentRate = (selectedRate.market === 'parallel' ? rates?.parallel[selectedRate.code] : rates?.official[selectedRate.code]) || 0;
        const decimals = selectedRate.market === 'official' ? 4 : (selectedRate.code === 'EGP' || selectedRate.code === 'TRY' ? 3 : 2);
        const spreadDiff = Math.max(0, chartStats.max - chartStats.min);

        const handleCopyRate = () => {
          triggerHaptic(8);
          const textToCopy = `${selectedRate.name} (${selectedRate.market === 'parallel' ? 'السوق الموازي' : 'السوق الرسمي'}): ${currentRate.toFixed(decimals)} د.ل`;
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(textToCopy).catch(() => {});
          }
          setCopiedModalRate(true);
          setTimeout(() => setCopiedModalRate(false), 2000);
        };

        return (
          <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRate(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 25 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-4xl bg-[#090e1a]/98 border-t sm:border border-slate-800/90 rounded-t-[1.75rem] sm:rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col max-h-[92dvh] sm:max-h-[88vh] z-10"
            >
              {/* Mobile Pull Bar */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-slate-900/60 shrink-0">
                <div className="w-12 h-1.5 bg-slate-700/60 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl">
                <div className={`absolute inset-0 opacity-15 pointer-events-none ${chartStats.isUp ? 'bg-gradient-to-r from-emerald-500/20 via-transparent to-transparent' : 'bg-gradient-to-r from-rose-500/20 via-transparent to-transparent'}`}></div>
                <div className="flex items-center gap-3 sm:gap-3.5 relative z-10 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center">
                    <FlagIcon 
                      flagCode={configTerms.find(t => t.id === selectedRate.code)?.flag || CURRENCIES.find(c => c.code === selectedRate.code)?.flag} 
                      name={selectedRate.name} 
                      className="w-full h-full" 
                      fallbackType="coins" 
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-xl font-black text-white tracking-tight leading-tight truncate">
                        {selectedRate.name}
                      </h3>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded-md border border-white/10">
                        {selectedRate.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${
                        selectedRate.market === 'parallel' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                      }`}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedRate.market === 'parallel' ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${selectedRate.market === 'parallel' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                        </span>
                        {selectedRate.market === 'parallel' ? 'السوق الموازي (الكاش)' : 'المصرف المركزي (الرسمي)'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 relative z-10 shrink-0">
                  <button 
                    onClick={() => {
                      triggerHaptic(6);
                      setSelectedRate(null);
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0"
                    title="إغلاق (Esc)"
                    aria-label="إغلاق"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-3.5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4 sm:space-y-5">
                {/* Price & Range Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-white/[0.06]">
                  <div className="flex flex-col">
                    <span className="text-[11px] sm:text-xs text-slate-400 font-semibold mb-0.5">سعر الصرف اللحظي</span>
                    <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-mono font-black text-white tracking-tight tabular-nums">
                        {currentRate.toFixed(decimals)}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-white/10 shadow-inner">د.ل</span>
                      {chartStats.change !== 0 && (
                        <span className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm ${
                          chartStats.isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {chartStats.isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span dir="ltr">{chartStats.isUp ? '+' : ''}{chartStats.change.toFixed(decimals)} ({chartStats.isUp ? '+' : ''}{chartStats.changePercent.toFixed(2)}%)</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Range Tabs */}
                  <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/[0.08] shrink-0 self-start sm:self-auto shadow-sm">
                    {(['24h', '7d', 'all'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setChartRange(range);
                          triggerHaptic(5);
                        }}
                        className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          chartRange === range 
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_2px_10px_rgba(16,185,129,0.35)]' 
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        {range === '24h' ? '24 ساعة' : range === '7d' ? '7 أيام' : 'الكل'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Chart */}
                <div className="w-full h-44 sm:h-60 md:h-72 min-h-[176px] sm:min-h-[240px] shrink-0 relative my-1">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" key={selectedRate.code}>
                      <AreaChart data={chartData} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                        <defs>
                          <linearGradient id="modalChartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartStats.isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.35}/>
                            <stop offset="95%" stopColor={chartStats.isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          vertical={false} 
                          stroke="rgba(255,255,255,0.04)" 
                          strokeDasharray="3 3" 
                        />
                        <XAxis 
                          dataKey="time" 
                          hide 
                        />
                        <YAxis 
                          domain={[(dataMin: number) => dataMin - (dataMin * 0.005), (dataMax: number) => dataMax + (dataMax * 0.005)]} 
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => val.toFixed(decimals)}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: "#070c18", 
                            border: "1px solid rgba(255,255,255,0.12)", 
                            borderRadius: "14px", 
                            color: "#fff", 
                            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.6)",
                            padding: "8px 12px"
                          }}
                          itemStyle={{ color: chartStats.isUp ? "#10b981" : "#f43f5e", fontFamily: "monospace", fontSize: "14px", fontWeight: "bold" }}
                          labelStyle={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label as any), "eeee، dd MMMM - HH:mm", { locale: ar });
                            } catch (e) {
                              return String(label);
                            }
                          }}
                          formatter={(value: number) => [`${value.toFixed(decimals)} د.ل`, 'السعر']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={chartStats.isUp ? "#10b981" : "#f43f5e"}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#modalChartGradient)"
                          isAnimationActive={false}
                          dot={false}
                          activeDot={{ r: 5, fill: "#070c18", stroke: chartStats.isUp ? "#10b981" : "#f43f5e", strokeWidth: 2.5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2 opacity-30 text-slate-400">
                        <TrendingUp className="w-8 h-8" />
                        <p className="text-xs font-mono">لا توجد بيانات تاريخية كافية لهذه الفترة</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Period Performance Summary Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-semibold px-1">
                    <span>ملخص حركة الفترة المحددة</span>
                    <span className="text-[10px] text-slate-500 font-normal">بيانات حسابية دقيقة</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/15 flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-emerald-400/90 font-medium mb-0.5">أعلى سعر</span>
                      <span className="text-sm sm:text-lg font-mono font-black text-emerald-400 tabular-nums">
                        {chartStats.max.toFixed(decimals)} <span className="text-[9px] sm:text-[10px] text-slate-400 font-sans">د.ل</span>
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-500/[0.04] border border-rose-500/15 flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-rose-400/90 font-medium mb-0.5">أدنى سعر</span>
                      <span className="text-sm sm:text-lg font-mono font-black text-rose-400 tabular-nums">
                        {chartStats.min.toFixed(decimals)} <span className="text-[9px] sm:text-[10px] text-slate-400 font-sans">د.ل</span>
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-white/[0.07] flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-slate-300 font-medium mb-0.5">متوسط السعر</span>
                      <span className="text-sm sm:text-lg font-mono font-black text-slate-200 tabular-nums">
                        {chartStats.avg.toFixed(decimals)} <span className="text-[9px] sm:text-[10px] text-slate-400 font-sans">د.ل</span>
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-fuchsia-500/[0.04] border border-fuchsia-500/15 flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-fuchsia-300 font-medium mb-0.5">مدى التذبذب</span>
                      <span className="text-sm sm:text-lg font-mono font-black text-fuchsia-400 tabular-nums">
                        {spreadDiff.toFixed(decimals)} <span className="text-[9px] sm:text-[10px] text-slate-400 font-sans">د.ل</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Technical Analysis (30 Days) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-semibold px-1">
                    <span>المؤشرات الفنية (30 يوم)</span>
                    <span className="text-[10px] text-slate-500 font-normal">تحليل فني آلي</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-emerald-400/80 font-medium mb-0.5 truncate max-w-full">مستوى المقاومة</span>
                      <span className="text-sm sm:text-base font-mono font-black text-emerald-400 tabular-nums">
                        {advancedStats.resistance > 0 ? advancedStats.resistance.toFixed(3) : '-'}
                      </span>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-500/5 border border-rose-500/15 flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-rose-400/80 font-medium mb-0.5 truncate max-w-full">مستوى الدعم</span>
                      <span className="text-sm sm:text-base font-mono font-black text-rose-400 tabular-nums">
                        {advancedStats.support > 0 ? advancedStats.support.toFixed(3) : '-'}
                      </span>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col items-center text-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-medium mb-0.5 truncate max-w-full">متوسط MA30</span>
                      <span className="text-sm sm:text-base font-mono font-black text-white tabular-nums">
                        {advancedStats.ma30 > 0 ? advancedStats.ma30.toFixed(3) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Quick Currency Converter */}
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/70 border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold mb-1">
                      <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تحويل سريع مقابل الدينار الليبي</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[50, 100, 500, 1000, 5000].map(amount => (
                        <button
                          key={amount}
                          onClick={() => {
                            triggerHaptic(4);
                            setModalCalcAmount(amount);
                          }}
                          className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all ${
                            modalCalcAmount === amount
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                              : 'bg-white/5 text-slate-400 hover:text-white border-white/5'
                          }`}
                        >
                          {amount.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:text-left text-right bg-black/40 px-3.5 py-2 rounded-xl border border-white/5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      القيمة الإجمالية المقابلة
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-emerald-400 tabular-nums">
                      {(modalCalcAmount * currentRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs text-slate-400 font-sans mr-1"> د.ل</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900/70 border-t border-white/[0.08] flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="truncate">تحديث لحظي مباشر من السوق المالي</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyRate}
                    className="px-3 sm:px-4 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center gap-1.5 shadow-sm"
                    title="نسخ السعر"
                  >
                    {copiedModalRate ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedModalRate ? 'تم النسخ!' : 'نسخ'}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic(8);
                      handleShareCardImage(selectedRate.code, selectedRate.name, currentRate || 0, selectedRate.market === 'official');
                    }}
                    className="px-3 sm:px-4 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center gap-1.5 shadow-sm"
                    title="مشاركة بطاقة السعر"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">مشاركة</span>
                  </button>
                  <button 
                    onClick={() => {
                      triggerHaptic(6);
                      setSelectedRate(null);
                    }}
                    className="px-4 sm:px-5 py-1.5 bg-white text-slate-950 hover:bg-slate-200 active:scale-95 text-xs font-extrabold rounded-xl transition-all shadow-sm"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
};
