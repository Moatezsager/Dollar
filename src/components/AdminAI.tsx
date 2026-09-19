import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, 
  X, 
  RefreshCw, 
  DownloadCloud, 
  CheckCircle2, 
  Save, 
  ArrowUpRight, 
  ArrowDownRight, 
  Coins, 
  Banknote, 
  CheckSquare, 
  Square,
  Filter
} from 'lucide-react';
import { format } from "date-fns";

const GOLD_METAL_IDS = [
  "GOLD_CAST_18",
  "GOLD_EXT_18",
  "GOLD_EXT_21",
  "GOLD_SCRAP_18",
  "GOLD_SCRAP_21",
  "GOLD_CAST_24",
  "GOLD_LIRA_8G",
  "GOLD_LIRA_14G",
  "GOLD_MUJARA_14G",
  "SILVER_CAST_1000"
];

interface AdminAIProps {
  token: string;
  config: any;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  triggerRefresh: () => void;
  decodeData: (data: string) => any;
}

export function AdminAI({ token, config, setError, setSuccess, triggerRefresh, decodeData }: AdminAIProps) {
  const [aiText, setAiText] = useState("");
  const [extractedRates, setExtractedRates] = useState<Record<string, number> | null>(null);
  const [extractedDates, setExtractedDates] = useState<Record<string, string> | null>(null);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [filterTodayOnly, setFilterTodayOnly] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'text' | 'currencies' | 'gold'>('text');

  const fetchCurrentRates = async (): Promise<Record<string, number>> => {
    try {
      const res = await fetch("/api/rates");
      if (res.ok) {
        const json = await res.json();
        const data = typeof json === 'string' ? decodeData(json) : json;
        if (data && data.parallel) {
          setCurrentRates(data.parallel);
          return data.parallel;
        }
      }
    } catch (err) {
      console.error("Failed to fetch current rates", err);
    }
    return currentRates;
  };

  const processExtractedData = (rates: Record<string, number>, dates: Record<string, string> | undefined) => {
    // If user disabled date filter OR if extracted rates don't have explicit date stamps (like manual text paste)
    const hasAnyExplicitDate = dates && Object.values(dates).some(d => Boolean(d));
    if (!filterTodayOnly || !hasAnyExplicitDate) {
      setExtractedRates(rates);
      if (dates) setExtractedDates(dates);
      return true;
    }

    const filteredRates: Record<string, number> = {};
    const filteredDates: Record<string, string> = {};
    let hasAny = false;
    const today = new Date();
    
    Object.keys(rates).forEach(key => {
      const dateStr = dates?.[key];
      if (dateStr) {
        const date = new Date(dateStr);
        if (date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()) {
          filteredRates[key] = rates[key];
          filteredDates[key] = dateStr;
          hasAny = true;
        }
      } else {
        // If an item has no date, retain it
        filteredRates[key] = rates[key];
        hasAny = true;
      }
    });
    
    if (!hasAny) {
      return false;
    }
    setExtractedRates(filteredRates);
    setExtractedDates(filteredDates);
    return true;
  };

  const handleAIExtract = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setError("");
    setSuccess("");
    try {
      await fetchCurrentRates();
      const res = await fetch("/api/admin/extract", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: aiText })
      });
      const data = await res.json();
      if (data.success && data.extractedRates) {
        const hasData = processExtractedData(data.extractedRates, data.extractedDates);
        if (hasData) {
          setActiveCategory('text');
          setSuccess(`تم استخراج ${Object.keys(data.extractedRates).length} سعر بنجاح`);
        } else {
          setError("لم يتم العثور على أسعار مطابقة");
        }
      } else {
        setError(data.message || "فشل استخراج الأسعار");
      }
    } catch (err) {
      setError("خطأ في الاتصال بخادم الاستخراج");
    }
    setAiLoading(false);
  };

  const handleEssaleExtract = async () => {
    setAiLoading(true);
    setError("");
    setSuccess("");
    try {
      await fetchCurrentRates();
      const res = await fetch("/api/admin/fetch-essale", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.extractedRates) {
        const hasData = processExtractedData(data.extractedRates, data.extractedDates);
        if (hasData) {
          setActiveCategory('text');
          setSuccess("تم جلب الأسعار من تطبيق الصراف بنجاح");
        } else {
          setError("لم يتم العثور على أسعار بتاريخ اليوم");
        }
      } else {
        setError(data.message || "فشل جلب الأسعار");
      }
    } catch (err) {
      setError("خطأ في الاتصال بخادم الصراف");
    }
    setAiLoading(false);
  };

  // Load All Parallel Currencies for fast manual updating
  const handleLoadCurrencies = async () => {
    setAiLoading(true);
    setError("");
    setSuccess("");
    try {
      const liveRates = await fetchCurrentRates();
      const termsList = config?.terms || [];
      const newRates: Record<string, number> = {};

      termsList.forEach((t: any) => {
        const isMetal = t.id === "GOLD" || t.id.startsWith("GOLD_") || t.id.startsWith("SILVER_") || t.flag === "gold" || t.flag === "silver";
        if (!isMetal && t.id !== "OFFICIAL_USD") {
          newRates[t.id] = liveRates[t.id] ?? currentRates[t.id] ?? 0;
        }
      });

      if (Object.keys(newRates).length === 0) {
        const defaultCodes = [
          "USD", "EUR", "GBP", "TND", "TRY", "EGP", 
          "USD_CHECKS", "USD_JBANK", "USD_BCD", "USD_NCB", "USD_AB", "USD_WB",
          "USD_TR", "USD_AE", "USD_CN", "AED", "SAR", "QAR", "JOD", "BHD", "KWD", "CNY"
        ];
        defaultCodes.forEach(code => {
          newRates[code] = liveRates[code] ?? currentRates[code] ?? 0;
        });
      }

      setExtractedRates(newRates);
      setExtractedDates(null);
      setActiveCategory('currencies');
      setSuccess(`تم عرض جميع أسعار العملات الموازية (${Object.keys(newRates).length} عملة) للتحكم اليدوي`);
    } catch (err) {
      setError("فشل تحميل أسعار العملات الموازية");
    }
    setAiLoading(false);
  };

  // Load All Gold & Metals for fast manual updating
  const handleLoadGold = async () => {
    setAiLoading(true);
    setError("");
    setSuccess("");
    try {
      const liveRates = await fetchCurrentRates();
      const newRates: Record<string, number> = {};

      GOLD_METAL_IDS.forEach(id => {
        newRates[id] = liveRates[id] ?? currentRates[id] ?? 0;
      });

      setExtractedRates(newRates);
      setExtractedDates(null);
      setActiveCategory('gold');
      setSuccess(`تم عرض جميع أصناف الذهب والمعادن المعتمدة (${Object.keys(newRates).length} أصناف) للتحكم اليدوي`);
    } catch (err) {
      setError("فشل تحميل أصناف الذهب والمعادن");
    }
    setAiLoading(false);
  };

  const handleSelectAll = (select: boolean) => {
    if (!extractedRates) return;
    const newRates = { ...extractedRates };
    Object.keys(extractedRates).forEach(k => {
      if (!k.startsWith('_')) {
        if (select) {
          delete (newRates as any)[`_skip_${k}`];
        } else {
          (newRates as any)[`_skip_${k}`] = true;
        }
      }
    });
    setExtractedRates(newRates);
  };

  const handleAISave = async () => {
    if (!extractedRates) return;
    
    const updatesToSend: Record<string, number> = {};
    Object.entries(extractedRates).forEach(([k, v]) => {
      if (!k.startsWith('_') && !(extractedRates as any)[`_skip_${k}`]) {
        updatesToSend[k] = v as number;
      }
    });

    if (Object.keys(updatesToSend).length === 0) {
      setError("لم يتم تحديد أي أسعار للتحديث، يرجى تحديد العملات المراد تعديلها");
      return;
    }

    setAiLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/rates", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ updates: updatesToSend, isManual: true })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message || `تم تحديث وحفظ ${Object.keys(updatesToSend).length} من الأسعار ونشرها فوراً بدون شروط بنجاح`);
        setExtractedRates(null);
        setExtractedDates(null);
        setAiText("");
        await fetchCurrentRates();
        triggerRefresh();
      } else {
        setError(data.message || "فشل تحديث الأسعار");
      }
    } catch (err) {
      setError("خطأ في الاتصال بالسيرفر");
    }
    setAiLoading(false);
  };

  const selectedCount = extractedRates 
    ? Object.keys(extractedRates).filter(k => !k.startsWith('_') && !(extractedRates as any)[`_skip_${k}`]).length
    : 0;

  const totalCount = extractedRates 
    ? Object.keys(extractedRates).filter(k => !k.startsWith('_')).length
    : 0;

  return (
    <motion.div 
      key="ai"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Quick Manual Update Bar: Currencies & Gold */}
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
              <Filter className="w-6 h-6 text-amber-400" />
              تحديث وإدخال الأسعار يدوياً
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              اختر الفئة لعرض جميع أسعارها وتعديلها يدوياً مع إمكانية تحديد أو استثناء أي صنف قبل الحفظ:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleLoadCurrencies}
            disabled={aiLoading}
            className={`p-5 rounded-2xl border transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 group text-right ${
              activeCategory === 'currencies' && extractedRates
                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
                : 'bg-black/30 border-slate-700/50 hover:border-emerald-500/30 hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <div className="font-black text-white text-base group-hover:text-emerald-300 transition-colors">
                  أسعار عملات موازي
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  عرض جميع العملات الموازية، الصكوك والحوالات
                </div>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              عرض العملات
            </span>
          </button>

          <button
            onClick={handleLoadGold}
            disabled={aiLoading}
            className={`p-5 rounded-2xl border transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 group text-right ${
              activeCategory === 'gold' && extractedRates
                ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-950/40'
                : 'bg-black/30 border-slate-700/50 hover:border-amber-500/30 hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <div className="font-black text-white text-base group-hover:text-amber-300 transition-colors">
                  أسعار الذهب والمعادن
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  عرض كل الذهب (مسبوك، كسر، خارجي، ليرات، فضة)
                </div>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              عرض الذهب
            </span>
          </button>
        </div>
      </section>

      {/* Text Extractor Card */}
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white mb-1">استخراج الأسعار من النصوص</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              الصق نص أسعار السوق أو قائمة أسعار الذهب والعملات (سطر بسطر أو فقرة)، وسيقوم المستخرج بالتعرف على كافة العملات وأصناف الذهب تلقائياً.
            </p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={`الصق النص هنا... مثال قائمة الذهب:\nذهب مسبوك18 1016\nذهب خارجي18 55\nذهب خارجي21 56\nكسر 18 57\nكسر 21 58\nمسبوك 24 59\nليرة ذهب 8 جرام 60\nليرة ذهب 14 جرام 61\nمجارة ذهب 14 62\nمسبوك فضة 63`}
            className="w-full h-44 bg-black/40 border border-slate-700/50 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none font-mono leading-relaxed placeholder:text-zinc-600 placeholder:font-sans"
            dir="auto"
          />
          {aiText && (
            <button
              onClick={() => { setAiText(''); setExtractedRates(null); }}
              className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <button
            onClick={handleAIExtract}
            disabled={aiLoading || !aiText.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-black font-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/30 disabled:shadow-none active:scale-[0.98]"
          >
            {aiLoading && !extractedRates ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري التحليل والاستخراج...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>استخراج الأسعار من النص</span>
              </>
            )}
          </button>
          <button
            onClick={handleEssaleExtract}
            disabled={aiLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 disabled:shadow-none active:scale-[0.98]"
          >
            {aiLoading && !extractedRates ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري الجلب...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-5 h-5" />
                <span>جلب الأسعار من تطبيق الصراف</span>
              </>
            )}
          </button>
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors mt-4">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
            checked={filterTodayOnly}
            onChange={(e) => setFilterTodayOnly(e.target.checked)}
          />
          استخراج وجلب أسعار اليوم فقط (عند توفر تواريخ في النص)
        </label>
      </section>

      {/* Rates Table Section */}
      <AnimatePresence>
        {extractedRates && Object.keys(extractedRates).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] overflow-hidden"
          >
            <div className="p-6 border-b border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  {activeCategory === 'currencies' && 'جدول أسعار العملات الموازية'}
                  {activeCategory === 'gold' && 'جدول أسعار الذهب والمعادن'}
                  {activeCategory === 'text' && 'الأسعار المستخرجة من النص'}
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    تم تحديد {selectedCount} من {totalCount}
                  </span>
                </h3>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition-all font-bold"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all font-bold"
                >
                  <Square className="w-3.5 h-3.5" />
                  إلغاء تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => { setExtractedRates(null); setExtractedDates(null); }}
                  className="text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/20 transition-all font-bold"
                >
                  إغلاق الجدول
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800/60 text-[11px] text-zinc-500 font-black uppercase tracking-widest bg-black/20">
                    <th className="p-4 text-center w-12">تحديد</th>
                    <th className="p-4 text-right">العملة / الصنف</th>
                    <th className="p-4 text-center">السعر الحالي في النظام</th>
                    <th className="p-4 text-center">السعر الجديد (قابل للتعديل ✏️)</th>
                    <th className="p-4 text-center">تاريخ المصدر</th>
                    <th className="p-4 text-center">التغيير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {Object.entries(extractedRates)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([key, newValue]) => {
                      const currentVal = currentRates[key] || 0;
                      const diff = (newValue as number) - currentVal;
                      const isUp = diff > 0.001;
                      const isDown = diff < -0.001;
                      const isSkipped = !!(extractedRates as any)[`_skip_${key}`];
                      const term = config?.terms?.find((t: any) => t.id === key);

                      return (
                        <tr
                          key={key}
                          className={`transition-all ${isSkipped ? 'opacity-35 bg-white/[0.01]' : 'hover:bg-white/[0.02]'}`}
                        >
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                              checked={!isSkipped}
                              onChange={(e) => {
                                const newRates = { ...extractedRates };
                                if (!e.target.checked) (newRates as any)[`_skip_${key}`] = true;
                                else delete (newRates as any)[`_skip_${key}`];
                                setExtractedRates(newRates);
                              }}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {term?.icon ? (
                                <img src={term.icon} className="w-6 h-6 rounded-full" alt={key} />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                  {key.substring(0, 2)}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-white text-sm">
                                  {term ? term.name : key}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono tracking-wider">{key}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-zinc-400 font-mono text-sm font-semibold">
                              {currentVal > 0 ? (currentVal % 1 === 0 ? currentVal : currentVal.toFixed(3)) : '—'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="number"
                              step="0.001"
                              value={newValue as number}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) {
                                  const updated = { ...extractedRates, [key]: v };
                                  if (['USD_CHECKS', 'USD_JBANK', 'USD_NCB'].includes(key)) {
                                    if (updated['USD_CHECKS'] !== undefined) updated['USD_CHECKS'] = v;
                                    if (updated['USD_JBANK'] !== undefined) updated['USD_JBANK'] = v;
                                    if (updated['USD_NCB'] !== undefined) updated['USD_NCB'] = v;
                                  }
                                  setExtractedRates(updated);
                                }
                              }}
                              disabled={isSkipped}
                              className={`w-32 text-center bg-black/50 border ${
                                isSkipped 
                                  ? 'border-transparent text-zinc-600' 
                                  : 'border-emerald-500/40 text-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                              } rounded-xl px-3 py-2 text-sm font-black font-mono transition-all outline-none`}
                            />
                          </td>
                          <td className="p-4 text-center">
                            <div className="text-xs text-zinc-500 font-mono">
                              {extractedDates && extractedDates[key] 
                                ? format(new Date(extractedDates[key]), "yyyy-MM-dd HH:mm") 
                                : <span className="text-zinc-600">—</span>}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {!isSkipped && Math.abs(diff) > 0.0001 ? (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
                                isUp ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                <span className="font-mono">{Math.abs(diff) % 1 === 0 ? Math.abs(diff) : Math.abs(diff).toFixed(3)}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 text-xs font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-slate-800/60 bg-black/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1 text-sm text-slate-300">
                <div>
                  سيتم تحديث وحفظ <span className="text-emerald-400 font-black">{selectedCount}</span> أسعار محددة في قاعدة البيانات
                </div>
                <div className="text-xs text-amber-400/90 flex items-center gap-1.5 font-medium">
                  <span>⚡</span>
                  <span>نشر تلقائي فوري ومباشر لجميع الأسعار المحددة بدون أي قيود أو فترات انتظار</span>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={handleAISave}
                  disabled={aiLoading || selectedCount === 0}
                  className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none cursor-pointer"
                >
                  {aiLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  اعتماد وحفظ الأسعار المحددة
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
