import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radio,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Send,
  ArrowUpRight,
  Info
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface BroadcastLogRow {
  id: number;
  created_at: number;
  platform: 'telegram' | 'facebook' | 'both';
  currency_ids: string;
  status: 'success' | 'success_after_retry' | 'failed';
  attempts: number;
  duration_ms: number | null;
  error_message: string | null;
  is_test: number;
}

interface BroadcastSummary {
  successRate24h: number | null;
  total24h: number;
  successful24h: number;
  failed24h: number;
  lastSuccessfulTelegram: number | null;
  lastSuccessfulFacebook: number | null;
  activeRetryQueueCount?: number;
}

interface AdminBroadcastLogProps {
  token: string;
}

const currencyFlagMap: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  TRY: '🇹🇷',
  EGP: '🇪🇬',
  TND: '🇹🇳',
  AED: '🇦🇪',
  SAR: '🇸🇦',
  QAR: '🇶🇦',
  CNY: '🇨🇳',
  GOLD_CAST_24: '✨',
  GOLD_CAST_18: '✨',
  GOLD_SCRAP_18: '✨',
  SILVER: '🪙',
  OFFICIAL: '🏦',
};

export function AdminBroadcastLog({ token }: AdminBroadcastLogProps) {
  const [logs, setLogs] = useState<BroadcastLogRow[]>([]);
  const [summary, setSummary] = useState<BroadcastSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'telegram' | 'facebook'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'success_after_retry' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast-log/summary", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.warn("Failed to fetch broadcast summary", err);
    } finally {
      setSummaryLoading(false);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await fetch(`/api/admin/broadcast-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.rows || []);
        setTotalPages(data.totalPages || 1);
        setTotalRows(data.total || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch broadcast logs", err);
    } finally {
      setLoading(false);
    }
  }, [token, platformFilter, statusFilter, page]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    fetchSummary();
    fetchLogs();
  };

  const parseCurrencies = (raw: string | any[]): string[] => {
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getSuccessRateBadge = (rate: number | null) => {
    if (rate === null) {
      return {
        text: "لا توجد بيانات",
        color: "text-slate-400 bg-slate-800/60 border-slate-700/50"
      };
    }
    if (rate >= 95) {
      return {
        text: `${rate}%`,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      };
    }
    if (rate >= 80) {
      return {
        text: `${rate}%`,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
      };
    }
    return {
      text: `${rate}%`,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20"
    };
  };

  const rateBadge = getSuccessRateBadge(summary?.successRate24h ?? null);

  const isBroadcastStale = (timestamp: number | null | undefined): boolean => {
    if (!timestamp) return true;
    const elapsedHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    return elapsedHours > 2;
  };

  const tgWarning = isBroadcastStale(summary?.lastSuccessfulTelegram);
  const fbWarning = isBroadcastStale(summary?.lastSuccessfulFacebook);

  return (
    <motion.div
      key="broadcast-log"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
      dir="rtl"
    >
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3 text-white">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Radio className="w-6 h-6" />
            </div>
            سجل النشر الاجتماعي (Social Broadcast Log)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            مراقبة شاملة لكافة محاولات النشر الفوري والمجدول عبر تيليجرام وفيسبوك مع تفاصيل الأخطاء والإعادة
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading || summaryLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all border border-slate-700/60 shadow-lg active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading || summaryLoading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
          تحديث السجل
        </button>
      </div>

      {/* Top summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 24h Success Rate */}
        <div className="bg-[#080808] border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">نسبة النجاح (آخر 24 ساعة)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-white">
              {summary?.successRate24h !== null && summary?.successRate24h !== undefined
                ? `${summary.successRate24h}%`
                : "—"}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${rateBadge.color}`}>
              {summary?.total24h ? `${summary.successful24h} / ${summary.total24h} إرسال` : "لا يوجد بث"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            بث فعلي غير تجريبي • استبعاد الاختبارات
          </div>
        </div>

        {/* Card 2: Last Telegram Broadcast */}
        <div className={`bg-[#080808] border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${
          tgWarning ? 'border-rose-500/40 bg-gradient-to-b from-rose-500/[0.04] to-transparent' : 'border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold ${tgWarning ? 'text-rose-300' : 'text-slate-400'}`}>آخر بث ناجح لتيليجرام</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              tgWarning ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-sky-500/10'
            }`}>
              <Send className={`w-4 h-4 ${tgWarning ? 'text-rose-400' : 'text-sky-400'}`} />
            </div>
          </div>
          <div className={`text-xl font-black truncate flex items-center gap-2 ${tgWarning ? 'text-rose-400' : 'text-white'}`}>
            {tgWarning && (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            {summary?.lastSuccessfulTelegram ? (
              <span>{formatDistanceToNow(new Date(summary.lastSuccessfulTelegram), { addSuffix: true, locale: ar })}</span>
            ) : (
              <span className={tgWarning ? "text-rose-400 text-sm font-bold" : "text-slate-500 text-sm font-medium"}>
                لا يوجد بث سابق
              </span>
            )}
          </div>
          <div className={`text-[11px] mt-2 truncate flex items-center justify-between ${
            tgWarning ? 'text-rose-400/80' : 'text-slate-500'
          }`}>
            <span>
              {summary?.lastSuccessfulTelegram
                ? format(new Date(summary.lastSuccessfulTelegram), "yyyy/MM/dd • HH:mm:ss")
                : "لم يتم رصد إرسال بعد"}
            </span>
            {tgWarning && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                متأخر (&gt; ساعتين)
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Last Facebook Broadcast */}
        <div className={`bg-[#080808] border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${
          fbWarning ? 'border-rose-500/40 bg-gradient-to-b from-rose-500/[0.04] to-transparent' : 'border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold ${fbWarning ? 'text-rose-300' : 'text-slate-400'}`}>آخر بث ناجح لفيسبوك</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              fbWarning ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-indigo-500/10'
            }`}>
              <Layers className={`w-4 h-4 ${fbWarning ? 'text-rose-400' : 'text-indigo-400'}`} />
            </div>
          </div>
          <div className={`text-xl font-black truncate flex items-center gap-2 ${fbWarning ? 'text-rose-400' : 'text-white'}`}>
            {fbWarning && (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            {summary?.lastSuccessfulFacebook ? (
              <span>{formatDistanceToNow(new Date(summary.lastSuccessfulFacebook), { addSuffix: true, locale: ar })}</span>
            ) : (
              <span className={fbWarning ? "text-rose-400 text-sm font-bold" : "text-slate-500 text-sm font-medium"}>
                لا يوجد بث سابق
              </span>
            )}
          </div>
          <div className={`text-[11px] mt-2 truncate flex items-center justify-between ${
            fbWarning ? 'text-rose-400/80' : 'text-slate-500'
          }`}>
            <span>
              {summary?.lastSuccessfulFacebook
                ? format(new Date(summary.lastSuccessfulFacebook), "yyyy/MM/dd • HH:mm:ss")
                : "لم يتم رصد إرسال بعد"}
            </span>
            {fbWarning && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                متأخر (&gt; ساعتين)
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Active Retry Queue */}
        <div className="bg-[#080808] border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">قائمة إعادة المحاولة النشطة</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              (summary?.activeRetryQueueCount || 0) > 0 ? 'bg-amber-500/10' : 'bg-slate-800/60'
            }`}>
              <Clock className={`w-4 h-4 ${(summary?.activeRetryQueueCount || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-white">
              {summary?.activeRetryQueueCount || 0}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              (summary?.activeRetryQueueCount || 0) > 0
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : 'text-slate-400 bg-slate-800/50 border-slate-700/50'
            }`}>
              {(summary?.activeRetryQueueCount || 0) > 0 ? 'قيد الإعادة التلقائية' : 'خالية تماماً'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Exponential Backoff (30s, 60s, 120s)
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-[#080808] border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Platform Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            المنصة:
          </span>
          <div className="inline-flex rounded-xl bg-black/40 p-1 border border-slate-800/60">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'telegram', label: 'تيليجرام' },
              { id: 'facebook', label: 'فيسبوك' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPlatformFilter(p.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  platformFilter === p.id
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 ml-1">الحالة:</span>
          <div className="inline-flex rounded-xl bg-black/40 p-1 border border-slate-800/60">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'success', label: 'ناجح' },
              { id: 'success_after_retry', label: 'ناجح بعد محاولة' },
              { id: 'failed', label: 'فشل' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStatusFilter(s.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s.id
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter indicator */}
        <div className="text-xs font-bold text-slate-400 mr-auto">
          إجمالي السجلات: <span className="text-white">{totalRows}</span>
        </div>
      </div>

      {/* Main Table Panel */}
      <section className="bg-[#080808] border border-slate-800/80 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-white/[0.02] text-slate-400 text-xs font-bold">
                <th className="py-4 px-5">الوقت والتاريخ</th>
                <th className="py-4 px-5">المنصة</th>
                <th className="py-4 px-5">العملات المتضمنة</th>
                <th className="py-4 px-5">الحالة</th>
                <th className="py-4 px-5">المحاولات</th>
                <th className="py-4 px-5">المدة</th>
                <th className="py-4 px-5">رسالة الخطأ / الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-3" />
                    جاري تحميل سجلات البث...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Radio className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                    <p className="text-base font-bold text-slate-300">لا توجد سجلات بعد</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {platformFilter !== 'all' || statusFilter !== 'all'
                        ? 'جرّب تغيير فلاتر البحث أو إلغائها لعرض مزيد من السجلات'
                        : 'ستظهر هنا سجلات البث عند تنفيذ أول عملية إرسال أو تجربة'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((row) => {
                  const currencies = parseCurrencies(row.currency_ids);
                  const isExpanded = expandedErrorId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-xs">
                            {format(new Date(row.created_at), "yyyy/MM/dd")}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {format(new Date(row.created_at), "HH:mm:ss")}
                            <span className="text-slate-600 mr-1">
                              ({formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ar })})
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.platform === 'telegram' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <Send className="w-3 h-3" />
                              تيليجرام
                            </span>
                          )}
                          {row.platform === 'facebook' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <Layers className="w-3 h-3" />
                              فيسبوك
                            </span>
                          )}
                          {row.platform === 'both' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Radio className="w-3 h-3" />
                              تيليجرام + فيسبوك
                            </span>
                          )}

                          {row.is_test === 1 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              تجريبي
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Currencies */}
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {currencies.length > 0 ? (
                            currencies.map((cid, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-slate-700/50 text-[11px] font-mono text-slate-300"
                              >
                                <span>{currencyFlagMap[cid] || '💰'}</span>
                                <span>{cid}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {row.status === 'success' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ناجح
                          </span>
                        )}
                        {row.status === 'success_after_retry' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ناجح بعد محاولة
                          </span>
                        )}
                        {row.status === 'failed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            فشل
                          </span>
                        )}
                      </td>

                      {/* Attempts */}
                      <td className="py-4 px-5 whitespace-nowrap font-mono text-xs">
                        <span className={`font-bold ${row.attempts > 1 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {row.attempts}
                        </span>
                        <span className="text-slate-500 mr-1">
                          {row.attempts === 1 ? 'محاولة' : 'محاولات'}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-5 whitespace-nowrap font-mono text-xs text-slate-400">
                        {row.duration_ms !== null && row.duration_ms !== undefined ? (
                          <span>{(row.duration_ms / 1000).toFixed(1)} ث</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Error message / Notes */}
                      <td className="py-4 px-5 text-xs">
                        {row.error_message ? (
                          <div className="max-w-md">
                            <div
                              onClick={() => setExpandedErrorId(isExpanded ? null : row.id)}
                              className="cursor-pointer group flex items-start gap-1.5 text-rose-300 hover:text-rose-200 transition-colors"
                              title={row.error_message}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                              <span className={isExpanded ? 'whitespace-normal font-mono break-all' : 'truncate max-w-sm'}>
                                {row.error_message}
                              </span>
                            </div>
                            {row.error_message.length > 50 && (
                              <button
                                onClick={() => setExpandedErrorId(isExpanded ? null : row.id)}
                                className="text-[10px] text-slate-500 hover:text-slate-300 underline mt-1"
                              >
                                {isExpanded ? 'طي الرسالة' : 'عرض التفاصيل بالكامل'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
                            لا توجد أخطاء
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-between gap-4 bg-white/[0.01]">
            <div className="text-xs text-slate-400">
              الصفحة <span className="font-bold text-white">{page}</span> من <span className="font-bold text-white">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-bold text-slate-300 transition-all border border-slate-700/50"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </button>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-bold text-slate-300 transition-all border border-slate-700/50"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}
