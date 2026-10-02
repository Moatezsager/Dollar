import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Printer, X, CheckCircle2, Coins } from "lucide-react";
import { Rates, CurrencyItem, METAL_IDS } from "../../types/rates";

interface PdfExportModalProps {
  showCurrencyModal: boolean;
  setShowCurrencyModal: (show: boolean) => void;
  configTerms: any[];
  staleCurrencies: Set<string>;
  officialCurrencyList: CurrencyItem[];
  selectedCurrencies: string[];
  setSelectedCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOfficialCurrencies: string[];
  setSelectedOfficialCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  rates: Rates | null;
  triggerHaptic: (pattern?: number | number[]) => void;
  generatePDF: (parallelList?: string[], officialList?: string[]) => void;
}

export const PdfFlagIcon = ({ flagCode, size = 24 }: { flagCode?: string, size?: number }) => {
  const code = flagCode?.trim().toLowerCase();
  
  if (code === 'gold') {
    return (
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#fef08a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eab308', flexShrink: 0, fontSize: `${size * 0.6}px` }}>
        ✨
      </div>
    );
  }
  
  if (code === 'silver') {
    return (
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #94a3b8', flexShrink: 0, fontSize: `${size * 0.6}px` }}>
        🪙
      </div>
    );
  }

  if (!code || code === "undefined" || code === "null") {
    return (
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', flexShrink: 0 }}>
        <Coins size={size * 0.6} color="#94a3b8" />
      </div>
    );
  }
  
  let objectPosition = "center";
  if (["ae", "us", "jo", "ps", "dz", "kw", "om", "qa"].includes(code)) {
    objectPosition = "left center";
  }

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
      <img 
        src={`https://flagcdn.com/w160/${code}.png`} 
        alt="flag"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, transform: 'scale(1.05)' }}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  showCurrencyModal,
  setShowCurrencyModal,
  configTerms,
  staleCurrencies,
  officialCurrencyList,
  selectedCurrencies,
  setSelectedCurrencies,
  selectedOfficialCurrencies,
  setSelectedOfficialCurrencies,
  rates,
  triggerHaptic,
  generatePDF,
}) => {
  const [pdfCategoryTab, setPdfCategoryTab] = useState<'all' | 'parallel' | 'metals' | 'official'>('all');

  return (
    <AnimatePresence>
      {showCurrencyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="glass-panel border border-slate-700/60 rounded-3xl p-5 sm:p-7 w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">تخصيص وطباعة نشرة الأسعار (PDF)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">اختر العملات والأصناف المطلوب تضمينها — يدعم الموازي والمعادن والسوق الرسمي</p>
                </div>
              </div>
              <button
                onClick={() => setShowCurrencyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Actions Bar */}
            <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-800/60 shrink-0">
              <span className="text-xs text-slate-400 font-bold ml-1">تحديد سريع:</span>
              <button
                onClick={() => {
                  const allParallelAndMetals = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id)).map(c => c.id);
                  const allOfficial = officialCurrencyList.map(c => c.code);
                  setSelectedCurrencies(allParallelAndMetals);
                  setSelectedOfficialCurrencies(allOfficial);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                تحديد الكل ({configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id)).length + officialCurrencyList.length})
              </button>
              <button
                onClick={() => {
                  const parallelOnly = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id)).map(c => c.id);
                  setSelectedCurrencies(parallelOnly);
                  setSelectedOfficialCurrencies([]);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
              >
                السوق الموازي فقط
              </button>
              <button
                onClick={() => {
                  const metalsOnly = configTerms.filter(c => METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id)).map(c => c.id);
                  setSelectedCurrencies(metalsOnly);
                  setSelectedOfficialCurrencies([]);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
              >
                الذهب والمعادن فقط
              </button>
              <button
                onClick={() => {
                  setSelectedCurrencies([]);
                  setSelectedOfficialCurrencies(officialCurrencyList.map(c => c.code));
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
              >
                السوق الرسمي (المركزي) فقط
              </button>
              <button
                onClick={() => {
                  setSelectedCurrencies([]);
                  setSelectedOfficialCurrencies([]);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors mr-auto"
              >
                إلغاء التحديد
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 py-3 shrink-0 overflow-x-auto">
              <button
                onClick={() => setPdfCategoryTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pdfCategoryTab === 'all'
                    ? 'bg-white text-black'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>الكل</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                  {selectedCurrencies.length + selectedOfficialCurrencies.length}
                </span>
              </button>

              <button
                onClick={() => setPdfCategoryTab('parallel')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pdfCategoryTab === 'parallel'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>السوق الموازي</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                  {configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length}
                </span>
              </button>

              <button
                onClick={() => setPdfCategoryTab('metals')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pdfCategoryTab === 'metals'
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>الذهب والمعادن</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                  {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length}
                </span>
              </button>

              <button
                onClick={() => setPdfCategoryTab('official')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pdfCategoryTab === 'official'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>السوق الرسمي (المركزي)</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                  {selectedOfficialCurrencies.length}
                </span>
              </button>
            </div>

            {/* Currencies & Items Selection Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-2 max-h-[360px] custom-scrollbar">
              {/* 1. Parallel Market Currencies */}
              {(pdfCategoryTab === 'all' || pdfCategoryTab === 'parallel') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      عملات السوق الموازي (الكاش والصكوك)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} محدد
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {configTerms
                      .filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id))
                      .map(c => {
                        const isSelected = selectedCurrencies.includes(c.id);
                        const rate = rates?.parallel[c.id] || 0;
                        return (
                          <button
                            key={`modal-par-${c.id}`}
                            onClick={() => {
                              triggerHaptic(8);
                              setSelectedCurrencies(prev => 
                                isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500/60 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <PdfFlagIcon flagCode={c.flag} size={22} />
                              <div className="text-right truncate">
                                <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}</p>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-700 bg-transparent'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 2. Gold & Precious Metals */}
              {(pdfCategoryTab === 'all' || pdfCategoryTab === 'metals') && (
                <div>
                  <div className="flex items-center justify-between mb-2 mt-4">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      الذهب والمعادن الثمينة (سوق الصاغة)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} محدد
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {configTerms
                      .filter(c => METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id))
                      .map(c => {
                        const isSelected = selectedCurrencies.includes(c.id);
                        const rate = rates?.parallel[c.id] || 0;
                        return (
                          <button
                            key={`modal-metal-${c.id}`}
                            onClick={() => {
                              triggerHaptic(8);
                              setSelectedCurrencies(prev => 
                                isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <PdfFlagIcon flagCode={c.flag} size={22} />
                              <div className="text-right truncate">
                                <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                                <p className="text-[10px] text-amber-500/80 font-mono">{rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}</p>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-700 bg-transparent'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 3. Official Central Bank Currencies */}
              {(pdfCategoryTab === 'all' || pdfCategoryTab === 'official') && (
                <div>
                  <div className="flex items-center justify-between mb-2 mt-4">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      أسعار الصرف الرسمية (مصرف ليبيا المركزي)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedOfficialCurrencies.length} محدد
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {officialCurrencyList.map(c => {
                      const isSelected = selectedOfficialCurrencies.includes(c.code);
                      const rate = rates?.official[c.code] || 0;
                      return (
                        <button
                          key={`modal-off-${c.code}`}
                          onClick={() => {
                            triggerHaptic(8);
                            setSelectedOfficialCurrencies(prev => 
                              isSelected ? prev.filter(code => code !== c.code) : [...prev, c.code]
                            );
                          }}
                          className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-blue-500/15 border-blue-500/60 text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                              : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <PdfFlagIcon flagCode={c.flag} size={22} />
                            <div className="text-right truncate">
                              <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                              <p className="text-[10px] text-blue-400/80 font-mono">{rate > 0 ? `${rate.toFixed(3)} د.ل` : c.code}</p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700 bg-transparent'
                          }`}>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 text-right w-full sm:w-auto">
                <span>تم تحديد: </span>
                <span className="text-white font-bold font-mono">
                  {selectedCurrencies.length + selectedOfficialCurrencies.length}
                </span>
                <span> صنف </span>
                <span className="text-slate-500 text-[11px]">
                  ({configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} موازي، {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} معادن، {selectedOfficialCurrencies.length} رسمي)
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => setShowCurrencyModal(false)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => generatePDF(selectedCurrencies, selectedOfficialCurrencies)}
                  disabled={selectedCurrencies.length === 0 && selectedOfficialCurrencies.length === 0}
                  className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                    selectedCurrencies.length === 0 && selectedOfficialCurrencies.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة النشرة الرسمية ({selectedCurrencies.length + selectedOfficialCurrencies.length})</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
