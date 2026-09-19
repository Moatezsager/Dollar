import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Plus, Send, Trash2, Zap, Search, ChevronDown, Save } from 'lucide-react';

interface AdminConfigProps {
  config: any;
  setConfig: (config: any) => void;
  handleSave: () => void;
  loading: boolean;
}

export function AdminConfig({ config, setConfig, handleSave, loading }: AdminConfigProps) {
  const [searchPath, setSearchPath] = useState("");
  const [expandedTermIdx, setExpandedTermIdx] = useState<number | null>(null);
  const [testTexts, setTestTexts] = useState<Record<number, string>>({});

  const filteredTerms = useMemo(() => {
    if (!config?.terms) return [];
    if (!searchPath) return config.terms;
    return config.terms.filter((t: any) => 
      t.name.toLowerCase().includes(searchPath.toLowerCase()) || 
      t.id.toLowerCase().includes(searchPath.toLowerCase())
    );
  }, [config, searchPath]);

  return (
    <motion.div 
      key="config"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 md:space-y-8 pb-24"
    >
      {/* Data Sources Section */}
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg md:text-xl font-black flex items-center gap-3 text-blue-400">
            <Globe className="w-5 h-5 md:w-6 md:h-6" />
            مصادر البيانات (Data Sources)
          </h2>
          <button 
            onClick={() => setConfig({...config, channels: [...config.channels, '']})}
            className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.channels.map((ch: string, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-slate-800/60 group hover:bg-white/[0.05] transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <input 
                value={ch}
                onChange={(e) => {
                  const newChannels = [...config.channels];
                  newChannels[i] = e.target.value;
                  setConfig({...config, channels: newChannels});
                }}
                placeholder="اسم القناة (بدون @)"
                className="flex-1 bg-transparent border-none focus:ring-0 text-white font-bold text-sm"
                dir="ltr"
              />
              <button 
                onClick={() => {
                  const newChannels = config.channels.filter((_: any, idx: number) => idx !== i);
                  setConfig({...config, channels: newChannels});
                }}
                className="p-2 text-zinc-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-slate-800/60">
            <span className="text-sm font-bold text-slate-400">تفعيل الكاشط التقليدي (احتياطي)</span>
            <button 
              onClick={() => setConfig({...config, enableHttpScraper: !config.enableHttpScraper})}
              className={`w-14 h-8 rounded-full transition-colors ${config.enableHttpScraper ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-6 h-6 rounded-full bg-white transition-transform ${config.enableHttpScraper ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-slate-800/60">
            <span className="text-sm font-bold text-slate-400">تفعيل تتبع الأجهزة المتصلة (Online Tracking)</span>
            <button 
              onClick={() => setConfig({...config, enableUserTracking: !config.enableUserTracking})}
              className={`w-14 h-8 rounded-full transition-colors ${config.enableUserTracking ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-6 h-6 rounded-full bg-white transition-transform ${config.enableUserTracking ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Intelligent Recognition System */}
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-lg md:text-xl font-black flex items-center gap-3 text-emerald-400">
              <Zap className="w-5 h-5 md:w-6 md:h-6" />
              نظام التعرف الذكي (Smart Extraction)
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium">تحديد القواعد والكلمات المفتاحية لاستخراج الأسعار آلياً</p>
          </div>
          <button 
            onClick={() => setConfig({
              ...config,
              terms: [...config.terms, { id: "NEW", name: "عملة جديدة", regex: "(?:كلمة|أخرى)\\s*[=:]?\\s*(\\d{1,2}(?:[\\.,]\\d+)?)", min: 0.1, max: 100, isInverse: false, flag: "" }]
            })}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all font-black text-sm shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            إضافة عملة جديدة
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-8 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-400 transition-colors" />
          <input 
            type="text" 
            placeholder="ابحث عن عملة أو معرف..."
            value={searchPath}
            onChange={(e) => setSearchPath(e.target.value)}
            className="w-full bg-white/[0.03] border border-slate-700/50 rounded-2xl pr-12 pl-4 py-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all focus:bg-white/5"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredTerms.map((term: any, originalIdx: number) => {
            const idx = config.terms.findIndex((t: any) => t === term);
            const isExpanded = expandedTermIdx === idx;
            const testText = testTexts[idx] || "";
            let testResult: string | null = null;
            
            if (testText && term.regex) {
              try {
                const regex = new RegExp(term.regex, 'i');
                const match = testText.match(regex);
                if (match && match[1]) {
                  let val = parseFloat(match[1].replace(',', '.'));
                  
                  // Smart TND logic for preview (Ensure 1 TND = X LYD format)
                  if (term.id === 'TND') {
                    if (val > 300) {
                      val = val / 1000;
                    }
                    if (val > 100) {
                      val = val / 100;
                    }
                  } else if (term.id === 'TRY') {
                    if (val > 100) {
                      val = val / 100;
                    }
                  } else if (term.id === 'EGP') {
                    if (val > 1000) val = val / 1000;
                    else if (val > 100) val = val / 100;
                  }

                  if (term.isInverse && val > 0) {
                    val = 1 / val;
                  }

                  if (val >= term.min && val <= term.max) {
                    testResult = `✅ تطابق! القيمة المستخرجة: ${val.toFixed(3)}`;
                  } else {
                    testResult = `❌ تطابق مع الرقم ${val} ولكنه خارج النطاق (${term.min} - ${term.max})`;
                  }
                } else {
                  testResult = "❌ لا يوجد تطابق مع النص المكتوب";
                }
              } catch (e) {
                testResult = "❌ خطأ في كتابة التعبير النمطي (Regex)";
              }
            }

            return (
              <div key={idx} className="bg-white/[0.02] border border-slate-800/60 rounded-[1.5rem] overflow-hidden transition-all duration-300">
                <div 
                  onClick={() => setExpandedTermIdx(isExpanded ? null : idx)}
                  className={`p-4 md:p-6 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.02]' : 'hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-4">
                    {term.icon ? (
                      <img src={term.icon} className="w-10 h-10 rounded-full bg-black/50 p-1" alt={term.id} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-500">
                        {term.id.substring(0,2)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white text-base md:text-lg">{term.name}</h3>
                      <p className="text-[10px] md:text-xs text-slate-500 font-mono mt-0.5 tracking-wider">{term.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {!isExpanded && (
                      <div className="hidden md:flex gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="bg-black/30 px-2 py-1 rounded">Min: {term.min}</span>
                        <span className="bg-black/30 px-2 py-1 rounded">Max: {term.max}</span>
                      </div>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 md:p-6 pt-0 border-t border-slate-800/60">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 tracking-wider">الاسم (Display Name)</label>
                            <input 
                              value={term.name}
                              onChange={(e) => {
                                const newTerms = [...config.terms];
                                newTerms[idx].name = e.target.value;
                                setConfig({...config, terms: newTerms});
                              }}
                              className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 tracking-wider">المعرف (ID - إنجليزي)</label>
                            <input 
                              value={term.id}
                              onChange={(e) => {
                                const newTerms = [...config.terms];
                                newTerms[idx].id = e.target.value;
                                setConfig({...config, terms: newTerms});
                              }}
                              className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:border-emerald-500/50 outline-none transition-all"
                              dir="ltr"
                            />
                          </div>
                          
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 tracking-wider">
                              التعبير النمطي (Regex - مجموعة مطابقة واحدة للسعر)
                            </label>
                            <div className="relative">
                              <input 
                                value={term.regex}
                                onChange={(e) => {
                                  const newTerms = [...config.terms];
                                  newTerms[idx].regex = e.target.value;
                                  setConfig({...config, terms: newTerms});
                                }}
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:border-emerald-500/50 outline-none transition-all"
                                dir="ltr"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 md:col-span-2">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 tracking-wider">الحد الأدنى للمنطقية</label>
                              <input 
                                type="number"
                                step="0.1"
                                value={term.min}
                                onChange={(e) => {
                                  const newTerms = [...config.terms];
                                  newTerms[idx].min = parseFloat(e.target.value) || 0;
                                  setConfig({...config, terms: newTerms});
                                }}
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-center font-mono text-white focus:border-emerald-500/50 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 tracking-wider">الحد الأقصى للمنطقية</label>
                              <input 
                                type="number"
                                step="0.1"
                                value={term.max}
                                onChange={(e) => {
                                  const newTerms = [...config.terms];
                                  newTerms[idx].max = parseFloat(e.target.value) || 100;
                                  setConfig({...config, terms: newTerms});
                                }}
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-center font-mono text-white focus:border-emerald-500/50 outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Extra config fields (isInverse, icon URL, flag) */}
                          <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-800/40">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-slate-800/60">
                              <span className="text-[11px] font-bold text-slate-400">نظام القلب العكسي (1/x)</span>
                              <button 
                                onClick={() => {
                                  const newTerms = [...config.terms];
                                  newTerms[idx].isInverse = !term.isInverse;
                                  setConfig({...config, terms: newTerms});
                                }}
                                className={`w-10 h-5 rounded-full transition-colors ${term.isInverse ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${term.isInverse ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 tracking-wider">رابط الأيقونة (اختياري)</label>
                                <input 
                                  value={term.icon || ""}
                                  onChange={(e) => {
                                    const newTerms = [...config.terms];
                                    newTerms[idx].icon = e.target.value;
                                    setConfig({...config, terms: newTerms});
                                  }}
                                  placeholder="https://..."
                                  className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 focus:border-emerald-500/50 outline-none"
                                  dir="ltr"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 tracking-wider">العلم / الرمز (اختياري)</label>
                                <input 
                                  value={term.flag || ""}
                                  onChange={(e) => {
                                    const newTerms = [...config.terms];
                                    newTerms[idx].flag = e.target.value;
                                    setConfig({...config, terms: newTerms});
                                  }}
                                  className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2 text-xs text-center text-slate-300 focus:border-emerald-500/50 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-2 pt-4 border-t border-slate-800/40">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-emerald-500/70 tracking-wider">تجربة التعبير النمطي الحية</label>
                              <div className="flex flex-col gap-2">
                                <input 
                                  type="text" 
                                  placeholder="أدخل نصًا للتجربة..."
                                  value={testText}
                                  onChange={(e) => setTestTexts({ ...testTexts, [idx]: e.target.value })}
                                  className="w-full bg-white/5 border border-slate-800/60 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500/30 text-white"
                                />
                                {testText && (
                                  <div className={`px-4 py-2 rounded-xl text-xs font-bold font-mono text-right transition-colors ${
                                    testResult?.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {testResult}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end mt-6 pt-4 border-t border-slate-800/40">
                          <button 
                            onClick={() => {
                              if(window.confirm('هل أنت متأكد من حذف هذه العملة؟')) {
                                const newTerms = config.terms.filter((_: any, i: number) => i !== idx);
                                setConfig({...config, terms: newTerms});
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف هذه العملة
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          
          {filteredTerms.length === 0 && (
            <div className="text-center py-12 bg-white/[0.01] border border-slate-800/60 rounded-3xl border-dashed">
              <p className="text-slate-500 text-sm">لا يوجد نتائج مطابقة للبحث</p>
            </div>
          )}
        </div>
      </section>

      {/* Mobile Save Button */}
      <div className="sticky bottom-4 z-40">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>حفظ جميع التغييرات</span>
        </button>
      </div>
    </motion.div>
  );
}
