import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  Download,
  Send,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
  Sliders,
  Check,
  TrendingUp,
  Globe,
  Share2
} from "lucide-react";
import { toPng } from "html-to-image";

interface WeeklyItem {
  id: string;
  name: string;
  flag: string;
  category: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  trend: 'up' | 'down' | 'steady';
}

interface WeeklyHarvestData {
  title: string;
  dateRange: string;
  notes: string[];
  items: WeeklyItem[];
}

interface AdminWeeklyHarvestProps {
  token: string;
  config: any;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const flagEmojiMap: Record<string, string> = {
  us: '🇺🇸',
  eu: '🇪🇺',
  gb: '🇬🇧',
  tn: '🇹🇳',
  eg: '🇪🇬',
  tr: '🇹🇷',
  ae: '🇦🇪',
  cn: '🇨🇳'
};

// Clean financial icon renderer (Realistic 3D bullion badges for Gold and Silver, country flags for currencies)
function renderItemIcon(flag: string) {
  if (flag === 'gold') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden border border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.3)] shrink-0 bg-amber-500/10">
        <img
          src="/gold.png"
          alt="ذهب"
          className="w-full h-full object-contain p-0.5"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  if (flag === 'silver') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden border border-slate-300/50 shadow-[0_0_10px_rgba(203,213,225,0.3)] shrink-0 bg-slate-900">
        <img
          src="/silver-icon.jpg"
          alt="فضة"
          className="w-full h-full object-cover scale-110"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  return <span className="text-base leading-none">{flagEmojiMap[flag] || '💰'}</span>;
}

export function AdminWeeklyHarvest({ token, config, setError, setSuccess }: AdminWeeklyHarvestProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeeklyHarvestData | null>(null);
  const [activeView, setActiveView] = useState<'preview' | 'editor'>('preview');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Customization states
  const [customTitle, setCustomTitle] = useState("حصاد الأسبوع | التقرير المالي وحركة التداول");
  const [customDateRange, setCustomDateRange] = useState("");
  const [customNotes, setCustomNotes] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<WeeklyItem[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);

  // Load calculated weekly data from backend
  const fetchHarvestData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/weekly-harvest/data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setCustomTitle(json.title);
        setCustomDateRange(json.dateRange);
        setCustomNotes(json.notes || []);
        setCustomItems(json.items || []);
        setSuccess("تم جلب واحتساب بيانات الأسبوع بنجاح ✅");
      } else {
        setError(json.error || "فشل جلب بيانات الحصاد الأسبوعي");
      }
    } catch (err: any) {
      setError("خطأ في الاتصال بالسيرفر أثناء جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHarvestData();
  }, []);

  // Update item field and recalculate change and %
  const handleItemChange = (index: number, field: 'open' | 'high' | 'low' | 'close', value: string) => {
    const num = parseFloat(value) || 0;
    const updated = [...customItems];
    const current = { ...updated[index], [field]: num };

    // Recalculate
    const diff = current.close - current.open;
    const pct = current.open > 0 ? (diff / current.open) * 100 : 0;
    current.change = Number(diff.toFixed(3));
    current.changePct = Number(pct.toFixed(2));
    current.trend = diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : 'steady';

    updated[index] = current;
    setCustomItems(updated);
  };

  // Generate high-resolution PNG using html-to-image
  const generatePngBlob = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      return await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2.5, // Crisp retina resolution
        quality: 0.98,
        backgroundColor: '#070b14'
      });
    } catch (err) {
      console.error("PNG generation error:", err);
      return null;
    }
  };

  // Download Image
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const dataUrl = await generatePngBlob();
      if (!dataUrl) {
        setError("فشل توليد صورة الحصاد الأسبوعي");
        return;
      }
      const link = document.createElement('a');
      link.download = `weekly-harvest-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      setSuccess("تم تحميل صورة الحصاد الأسبوعي بنجاح 📥");
    } catch (e: any) {
      setError("حدث خطأ أثناء تحميل الصورة");
    } finally {
      setDownloading(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopy = async () => {
    try {
      const dataUrl = await generatePngBlob();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      setSuccess("تم نسخ الصورة إلى الحافظة بنجاح 📋");
    } catch (err) {
      setError("متصفحك لا يدعم نسخ الصور مباشرة، يمكنك استخدام زر التحميل");
    }
  };

  // Send to Telegram (either 'me' for test or channel)
  const handleSendTelegram = async (dest: 'me' | 'channel') => {
    setSendingTelegram(true);
    try {
      const dataUrl = await generatePngBlob();
      if (!dataUrl) {
        setError("فشل توليد صورة الحصاد للإرسال");
        setSendingTelegram(false);
        return;
      }

      const caption = `📊 *${customTitle}*\n📅 ${customDateRange}\n\nنشرة الحصاد الأسبوعي الشاملة لأسعار العملات والذهب بسوق المشير والمصارف.\n🌐 لمزيد من التفاصيل والبيانات الحية:\nhttps://dollar-price-qp14.onrender.com/`;

      const res = await fetch('/api/admin/weekly-harvest/send-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          caption,
          destination: dest
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccess(json.message);
      } else {
        setError(json.error || "فشل إرسال الصورة عبر تيليجرام");
      }
    } catch (err: any) {
      setError("خطأ في الاتصال أثناء إرسال الصورة إلى تيليجرام");
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <motion.div
      key="weekly-harvest"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 md:space-y-8 pb-20"
      dir="rtl"
    >
      {/* Top Banner & Action Bar */}
      <section className="bg-white/[0.02] border border-slate-800/80 rounded-[2rem] p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white">حصاد الأسبوع (توليد الرسوم البيانية)</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  مجاني 100% · بدون اشتراك
                </span>
              </div>
              <p className="text-slate-400 text-xs md:text-sm mt-1">
                توليد بطاقة مصممة بإتقان بشري عالي لعرض أداء العملات والذهب الأسبوعي، مع إمكانية إرسالها لتجربتها على حسابك في تيليجرام.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={fetchHarvestData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700/50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              إعادة احتساب الأسبوع
            </button>

            <button
              onClick={() => setActiveView(activeView === 'preview' ? 'editor' : 'preview')}
              className="px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold transition-all flex items-center gap-2 border border-blue-500/20"
            >
              <Sliders className="w-4 h-4" />
              {activeView === 'preview' ? 'تعديل البيانات والأرقام' : 'معاينة البطاقة'}
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-6 pt-6 border-t border-slate-800/60 flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading || loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'جاري التوليد...' : 'تحميل صورة PNG عالية الدقة'}
          </button>

          <button
            onClick={handleCopy}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs md:text-sm transition-all flex items-center gap-2 border border-slate-700/50 active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ للحافظة'}
          </button>

          <button
            onClick={() => handleSendTelegram('me')}
            disabled={sendingTelegram || loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-500/30 text-sky-400 font-bold text-xs md:text-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${sendingTelegram ? 'animate-pulse' : ''}`} />
            {sendingTelegram ? 'جاري الإرسال...' : 'إرسال لحسابي في تيليجرام (تجربة)'}
          </button>

          <button
            onClick={() => handleSendTelegram('channel')}
            disabled={sendingTelegram || loading}
            className="px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 font-bold text-xs md:text-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            نشر مباشرة في القناة
          </button>
        </div>
      </section>

      {/* Editor View (Optional for editing numbers and custom comments) */}
      <AnimatePresence>
        {activeView === 'editor' && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-black/30 border border-slate-800 rounded-3xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                تعديل محتوى ونصوص البطاقة
              </h3>
              <span className="text-xs text-slate-500">التعديلات تنعكس فوراً على معاينة البطاقة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">عنوان النشرة</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-black/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-white text-sm focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">النطاق الزمني للأسبوع</label>
                <input
                  type="text"
                  value={customDateRange}
                  onChange={(e) => setCustomDateRange(e.target.value)}
                  className="w-full bg-black/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-white text-sm focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Notes Editor */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">رؤية وخلاصة الأسبوع (3 نقاط أساسية)</label>
              <div className="space-y-2">
                {customNotes.map((note, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={note}
                    onChange={(e) => {
                      const updated = [...customNotes];
                      updated[idx] = e.target.value;
                      setCustomNotes(updated);
                    }}
                    className="w-full bg-black/50 border border-slate-700/60 rounded-xl px-4 py-2 text-white text-xs md:text-sm focus:border-emerald-500"
                  />
                ))}
              </div>
            </div>

            {/* Table Values Editor */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">أرقام وتداولات العملات والذهب</label>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 text-[11px] font-bold">
                    <tr>
                      <th className="p-3">الصنف / العملة</th>
                      <th className="p-3">الافتتاح</th>
                      <th className="p-3">الأعلى</th>
                      <th className="p-3">الأدنى</th>
                      <th className="p-3">الإغلاق</th>
                      <th className="p-3">التغير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          {renderItemIcon(item.flag)}
                          <span>{item.name}</span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.001"
                            value={item.open}
                            onChange={(e) => handleItemChange(idx, 'open', e.target.value)}
                            className="w-20 bg-black/40 border border-slate-700/50 rounded-lg px-2 py-1 text-white font-mono text-xs"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.001"
                            value={item.high}
                            onChange={(e) => handleItemChange(idx, 'high', e.target.value)}
                            className="w-20 bg-black/40 border border-slate-700/50 rounded-lg px-2 py-1 text-white font-mono text-xs"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.001"
                            value={item.low}
                            onChange={(e) => handleItemChange(idx, 'low', e.target.value)}
                            className="w-20 bg-black/40 border border-slate-700/50 rounded-lg px-2 py-1 text-white font-mono text-xs"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.001"
                            value={item.close}
                            onChange={(e) => handleItemChange(idx, 'close', e.target.value)}
                            className="w-20 bg-black/40 border border-slate-700/50 rounded-lg px-2 py-1 text-white font-mono text-xs"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold">
                          <span className={item.change > 0 ? 'text-emerald-400' : item.change < 0 ? 'text-rose-400' : 'text-slate-400'}>
                            {item.change > 0 ? `+${item.change}` : item.change} ({item.changePct > 0 ? `+${item.changePct}%` : `${item.changePct}%`})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Main Infographic Card Preview Container */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            المعاينة الحية لبطاقة الحصاد (جاهزة للتوليد والنشر)
          </span>
          <span className="text-xs text-slate-500 font-mono">100% Vector Canvas · 2.5x Resolution</span>
        </div>

        {/* ─── THE INFOGRAPHIC CANVAS (Captured to PNG) ─── */}
        <div className="overflow-x-auto w-full flex justify-center p-2">
          <div
            ref={cardRef}
            id="weekly-harvest-card"
            className="w-[860px] bg-[#070b14] text-white p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden font-sans select-none shrink-0"
            style={{
              backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.08) 0%, rgba(7, 11, 20, 1) 75%)'
            }}
          >
            {/* Elegant Header Accent */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 p-1 flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden shrink-0">
                  <img
                    src="/logo.png"
                    alt="مؤشر الدينار"
                    className="w-full h-full object-contain rounded-xl"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none -z-10">
                    🇱🇾
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">مؤشر الدينار</span>
                    <span className="text-slate-600 text-xs">·</span>
                    <span className="text-xs text-slate-400 font-medium">سوق المشير والمصارف</span>
                  </div>

                  <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                    {customTitle}
                  </h2>
                </div>
              </div>

              <div className="text-left bg-white/[0.03] border border-slate-800/80 px-4 py-2.5 rounded-2xl">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 justify-end">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الفترة المشمولة</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5 font-mono" dir="rtl">
                  {customDateRange || "الأسبوع الحالي"}
                </div>
              </div>
            </div>

            {/* The Financial Data Table */}
            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-black/30 backdrop-blur-md">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider">
                    <th className="py-3 px-4">الصنف / العملة</th>
                    <th className="py-3 px-3 text-center">الافتتاح</th>
                    <th className="py-3 px-3 text-center text-emerald-400/80">الأعلى</th>
                    <th className="py-3 px-3 text-center text-rose-400/80">الأدنى</th>
                    <th className="py-3 px-3 text-center">الإغلاق</th>
                    <th className="py-3 px-4 text-left">التغير الأسبوعي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-mono text-[12px]">
                  {customItems.map((item, idx) => {
                    const isUp = item.change > 0.002;
                    const isDown = item.change < -0.002;
                    const isMetal = item.category === 'metal';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          idx % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'
                        } ${isMetal ? 'bg-amber-500/[0.02]' : ''}`}
                      >
                        {/* Currency Name */}
                        <td className="py-2.5 px-4 font-sans font-bold text-white flex items-center gap-2.5">
                          {renderItemIcon(item.flag)}
                          <span className={isMetal ? 'text-amber-200' : 'text-slate-100'}>{item.name}</span>
                        </td>

                        {/* Open */}
                        <td className="py-2.5 px-3 text-center text-slate-300 tabular-nums">
                          {item.open.toFixed(item.open >= 100 ? 0 : 3)}
                        </td>

                        {/* High */}
                        <td className="py-2.5 px-3 text-center text-emerald-400/90 tabular-nums">
                          {item.high.toFixed(item.high >= 100 ? 0 : 3)}
                        </td>

                        {/* Low */}
                        <td className="py-2.5 px-3 text-center text-rose-400/90 tabular-nums">
                          {item.low.toFixed(item.low >= 100 ? 0 : 3)}
                        </td>

                        {/* Close */}
                        <td className="py-2.5 px-3 text-center font-bold text-white tabular-nums bg-white/[0.03]">
                          {item.close.toFixed(item.close >= 100 ? 0 : 3)}
                        </td>

                        {/* Weekly Change Badge */}
                        <td className="py-2.5 px-4 text-left">
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums ${
                              isUp
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isDown
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-slate-800/40 text-slate-400 border border-slate-700/30'
                            }`}
                            dir="ltr"
                          >
                            {isUp && <ArrowUpRight className="w-3.5 h-3.5" />}
                            {isDown && <ArrowDownRight className="w-3.5 h-3.5" />}
                            {!isUp && !isDown && <Minus className="w-3.5 h-3.5" />}
                            <span>
                              {item.change > 0 ? `+${item.change.toFixed(3)}` : item.change.toFixed(3)}
                            </span>
                            <span className="opacity-75">
                              ({item.changePct > 0 ? `+${item.changePct.toFixed(1)}%` : `${item.changePct.toFixed(1)}%`})
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Editorial Market Insights (Clean, Professional Financial Bulletin Style) */}
            <div className="mt-5 p-5 rounded-2xl bg-white/[0.02] border border-slate-800/80">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-3.5 bg-emerald-500 rounded-sm"></span>
                <h4 className="text-xs font-black text-white tracking-wide">
                  خلاصة حركة التداول وتطورات الأسبوع
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-2 text-[12px] text-slate-300 font-sans">
                {customNotes.map((note, i) => (
                  <div key={i} className="flex items-baseline gap-2.5 bg-black/30 px-3.5 py-2.5 rounded-xl border border-slate-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 shrink-0 mt-1.5"></span>
                    <p className="leading-relaxed text-slate-200">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with Social Channels & Portal Link */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  <span className="font-bold text-slate-200 text-xs">مؤشر الدينار</span>
                </div>

                <span className="text-slate-700">|</span>

                {/* Social Channels with "تابعنا على:" label */}
                <div className="flex items-center gap-2 bg-white/[0.03] px-3 py-1 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-400 font-medium">تابعنا على:</span>
                  
                  {/* Telegram */}
                  <span className="inline-flex items-center gap-1 text-sky-400 font-bold text-[11px] bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                    </svg>
                    <span>Telegram</span>
                  </span>

                  {/* Facebook */}
                  <span className="inline-flex items-center gap-1 text-blue-400 font-bold text-[11px] bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z" />
                    </svg>
                    <span>Facebook</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                <span className="text-slate-300">https://dollar-price-qp14.onrender.com/</span>
                <span className="text-slate-600">·</span>
                <span dir="ltr">{new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
