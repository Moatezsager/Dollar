import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Send, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Clock, 
  Users, 
  Smartphone, 
  ShieldCheck, 
  Link2,
  Database,
  ArrowUpRight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";

interface TelegramVisitsCardProps {
  token: string;
}

interface VisitRecord {
  id: number;
  visits_count: number;
  last_entry_at: string | null;
  last_ip_hash?: string | null;
  last_user_agent?: string | null;
  last_referrer?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export function TelegramVisitsCard({ token }: TelegramVisitsCardProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<{
    count: number;
    last_entry_at: string | null;
    record: VisitRecord | null;
  }>({
    count: 0,
    last_entry_at: null,
    record: null
  });

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram-visits", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData({
          count: json.count || 0,
          last_entry_at: json.last_entry_at || (json.record?.last_entry_at) || null,
          record: json.record || null
        });
      }
    } catch (e) {
      console.warn("Failed to fetch telegram visits", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const redirectUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/telegram` 
    : "https://dollar-price-qp14.onrender.com/telegram";

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper to format last visit timestamp
  const formatLastSeen = (timestampStr: string | null) => {
    if (!timestampStr) return "لا توجد زيارات مسجلة بعد";
    try {
      const d = new Date(timestampStr);
      if (isNaN(d.getTime())) return "غير محدد";
      const relative = formatDistanceToNow(d, { addSuffix: true, locale: ar });
      const exact = format(d, "yyyy/MM/dd - hh:mm:ss a", { locale: ar });
      return { relative, exact };
    } catch {
      return "غير محدد";
    }
  };

  // Helper to parse user-agent into a friendly label
  const parseUserAgent = (ua: string | null | undefined) => {
    if (!ua) return "غير متوفر";
    if (/android/i.test(ua)) return "هاتف أندرويد (Android)";
    if (/iphone|ipad|ipod/i.test(ua)) return "هاتف آبل (iOS iPhone)";
    if (/windows/i.test(ua)) return "كمبيوتر (Windows PC)";
    if (/macintosh|mac os/i.test(ua)) return "كمبيوتر (Mac OS)";
    if (/linux/i.test(ua)) return "نظام لينكس (Linux)";
    return "متصفح ويب";
  };

  const lastSeenInfo = formatLastSeen(data.last_entry_at);

  return (
    <section className="bg-slate-900/60 border border-slate-800/80 rounded-[2rem] p-5 md:p-7 relative overflow-hidden backdrop-blur-md shadow-2xl transition-all">
      {/* Decorative ambient light */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/10 blur-[90px] rounded-full pointer-events-none -mr-20 -mt-20"></div>

      {/* Header Bar */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800/70">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-lg shrink-0">
            <Send className="w-6 h-6 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                إحصائيات تحويلات تليجرام
              </h3>
              <span className="text-[10px] text-sky-400 font-mono font-medium">
                (روابط تعليقات فيسبوك)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              قاعدة بيانات Supabase الموحدة · سجل ثابت (ID = 0)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center w-full sm:w-auto">
          <button
            onClick={fetchStats}
            disabled={loading}
            title="تحديث الإحصائيات"
            className="flex-1 sm:flex-initial h-11 px-3.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-400" : ""}`} />
            <span className="sm:inline">تحديث</span>
          </button>

          <button
            onClick={handleCopy}
            title="نسخ رابط التحويل المخصص للفيسبوك"
            className="flex-1 sm:flex-initial h-11 px-3.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "تم النسخ!" : "نسخ الرابط"}</span>
          </button>

          <a
            href={redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="تجربة رابط التحويل"
            className="w-11 h-11 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-sky-300 flex items-center justify-center transition-all shrink-0 active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main Responsive Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4 mb-6">
        {/* Metric 1: Total Real Visitors Count */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              إجمالي الأشخاص
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight tabular-nums">
              {data.count.toLocaleString("ar-LY")}
            </span>
            <span className="text-xs text-sky-400 font-bold">شخص</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            يزيد بمقدار +1 تلقائياً مع كل نقرة بشرية حقيقية
          </p>
        </div>

        {/* Metric 2: Last Visit Time */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              آخر دخول
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {typeof lastSeenInfo === "object" ? (
            <div>
              <div className="text-base sm:text-lg font-black text-emerald-400 truncate">
                {lastSeenInfo.relative}
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-1" dir="ltr">
                {lastSeenInfo.exact}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1">{lastSeenInfo}</p>
          )}
        </div>

        {/* Metric 3: Target & Referrer Source */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              مصدر الإحالة
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-white truncate">
            {data.record?.last_referrer ? "تعليق فيسبوك / خارجي" : "فيسبوك (مباشر)"}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate font-mono" dir="ltr">
            t.me/libya_index_dollar
          </p>
        </div>

        {/* Metric 4: Supabase Record Identity */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              حالة الجدول
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-amber-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>صف موحد (ID: 0)</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            تحديث وتعديل ذري دائم بدون تكرار
          </p>
        </div>
      </div>

      {/* Details Box: Last Visitor Technical Metadata (Mobile Friendly) */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 md:p-5">
        <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-400" />
          بيانات وتفاصيل آخر زائر نقر على الرابط:
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {/* Device Type */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400">جهاز المتصفح:</span>
            <span className="font-bold text-slate-200">
              {parseUserAgent(data.record?.last_user_agent)}
            </span>
          </div>

          {/* Masked IP Hash */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400">بصمة الاتصال:</span>
            <span className="font-mono text-slate-300 text-[11px]">
              {data.record?.last_ip_hash ? `${data.record.last_ip_hash.slice(0, 10)}...` : "مجهول"}
            </span>
          </div>

          {/* Destination */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 sm:col-span-2 md:col-span-1">
            <span className="text-slate-400">الوجهة:</span>
            <a 
              href="https://t.me/libya_index_dollar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline font-mono text-[11px] flex items-center gap-1"
            >
              قناة مؤشر الدينار
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* User Agent Raw String (Collapsible / Quiet) */}
        {data.record?.last_user_agent && (
          <div className="mt-3 pt-3 border-t border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 font-mono">
            <span className="shrink-0 text-slate-400">معرف المتصفح الكامل:</span>
            <span className="truncate max-w-full text-slate-400" title={data.record.last_user_agent}>
              {data.record.last_user_agent}
            </span>
          </div>
        )}
      </div>

      {/* Copy Link Helper Tip */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          <span>الرابط المخصص للنشر في تعليقات فيسبوك:</span>
          <code className="text-sky-300 bg-slate-800/80 px-2 py-0.5 rounded text-[11px] font-mono break-all">
            {redirectUrl}
          </code>
        </div>
        <button
          onClick={handleCopy}
          className="text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center gap-1 self-end sm:self-auto cursor-pointer"
        >
          {copied ? "تم النسخ للحافظة ✓" : "اضغط للنسخ السريع"}
        </button>
      </div>
    </section>
  );
}
