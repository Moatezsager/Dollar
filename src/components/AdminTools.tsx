import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Stethoscope, CheckCircle2, RefreshCw, AlertTriangle, Cpu, Trash, ListX, Play, Pause, Download, Search, Filter, Send, XCircle, AlertCircle, Copy, Zap } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminToolsProps {
  token: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const fetchWithTimeout = async (resource: string, options: any = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export function AdminTools({ token, setError, setSuccess }: AdminToolsProps) {
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [feedSearch, setFeedSearch] = useState("");
  const [feedChannelFilter, setFeedChannelFilter] = useState("all");
  const [feedStatusFilter, setFeedStatusFilter] = useState("all");
  const [isFeedPaused, setIsFeedPaused] = useState(false);

  const fetchLiveFeed = async () => {
    if (isFeedPaused) return;
    try {
      const res = await fetchWithTimeout("/api/admin/live-feed", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveFeed(data.feed || []);
      }
    } catch (err) {
      console.warn("Live feed fetch failed");
    }
  };

  useEffect(() => {
    if (token) {
      fetchLiveFeed();
    }
  }, [token, isFeedPaused]);

  const runDiagnostics = async () => {
    try {
      setDiagnosticsResult({ loading: true });
      const res = await fetchWithTimeout("/api/admin/diagnostics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsResult(data);
      } else {
        setDiagnosticsResult({ error: "فشل الاتصال" });
      }
    } catch (err) {
      setDiagnosticsResult({ error: "خطأ في الشبكة" });
    }
  };

  const clearQueue = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/clear-queue", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess("تم تفريغ طابور الرسائل");
        fetchLiveFeed();
      }
    } catch (e) {
      setError("فشل تفريغ الطابور");
    }
  };

  const clearRam = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/clear-ram", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess("تم إرسال أمر تنظيف الذاكرة");
      }
    } catch (e) {
      setError("فشل تنظيف الذاكرة");
    }
  };

  const downloadFeedCSV = () => {
    const headers = ["ID", "Channel", "Time", "Status", "Text", "Extracted Rates"];
    const rows = liveFeed.map(msg => [
      msg.id,
      msg.channel,
      new Date(msg.time).toLocaleString('ar-SA'),
      msg.status,
      `"${msg.text.replace(/"/g, '""')}"`,
      `"${JSON.stringify(msg.extractedRates || []).replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dollar-feed-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualExtract = async (msg: any) => {
    try {
      const res = await fetchWithTimeout("/api/admin/manual-extract", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ text: msg.text, time: msg.time, channel: msg.channel })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message);
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("فشل الاستخراج اليدوي");
    }
  };

  return (
    <motion.div 
      key="tools"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20 shrink-0">
            <Stethoscope className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white mb-1">أدوات النظام والتشخيص</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              أدوات متقدمة لفحص صحة النظام، إدارة الذاكرة، ومراقبة الرسائل الحية.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Self-Diagnosis Tool */}
          <div className="bg-black/40 border border-slate-800/60 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Stethoscope className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">التحقق من صحة الربط</h3>
                <p className="text-xs text-slate-500">فحص شامل لقاعدة البيانات وتليجرام والـ Regex</p>
              </div>
            </div>
            
            <button
              onClick={runDiagnostics}
              disabled={diagnosticsResult?.loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
            >
              {diagnosticsResult?.loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              اختصار فحص النظام
            </button>

            {diagnosticsResult && !diagnosticsResult.loading && (
              <div className="mt-auto bg-white/5 rounded-xl p-4 text-sm">
                {diagnosticsResult.error ? (
                  <div className="text-rose-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {diagnosticsResult.error}</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">قاعدة البيانات:</span>
                      <span className={diagnosticsResult.db === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                        {diagnosticsResult.db === 'ok' ? 'متصل ✅' : 'خطأ ❌'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">تليجرام:</span>
                      <span className={diagnosticsResult.telegram === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                        {diagnosticsResult.telegram === 'ok' ? 'متصل ✅' : 'غير متصل ❌'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">الـ Regex:</span>
                      <span className={diagnosticsResult.regex === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                        {diagnosticsResult.regex === 'ok' ? 'سليم ✅' : 'خطأ ❌'}
                      </span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-700/50 text-center font-bold text-emerald-400">
                      {diagnosticsResult.status === 'ok' ? 'الكل جاهز ✅' : 'يوجد أخطاء ❌'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RAM Cleanup */}
          <div className="bg-black/40 border border-slate-800/60 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Cpu className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">تنظيف الذاكرة (RAM)</h3>
                <p className="text-xs text-slate-500">تفريغ الذاكرة العشوائية للسيرفر</p>
              </div>
            </div>
            
            <button
              onClick={clearRam}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all flex items-center justify-center gap-2 mt-auto"
            >
              <Trash className="w-5 h-5" />
              تنظيف الرام الآن
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <ListX className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">إدارة الرسائل المعلقة</h3>
              <p className="text-sm text-slate-500">مراقبة وتفريغ طابور الرسائل القادمة من تليجرام</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsFeedPaused(!isFeedPaused)}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${
                isFeedPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30'
              }`}
            >
              {isFeedPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isFeedPaused ? 'استئناف' : 'إيقاف مؤقت'}
            </button>
            <button
              onClick={downloadFeedCSV}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </button>
            <button
              onClick={fetchLiveFeed}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث
            </button>
            <button
              onClick={clearQueue}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all flex items-center gap-2 text-sm"
            >
              <Trash className="w-4 h-4" />
              تفريغ الطابور
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="بحث في محتوى الرسائل..."
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className="w-full bg-black/40 border border-slate-800/60 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={feedChannelFilter}
              onChange={(e) => setFeedChannelFilter(e.target.value)}
              className="w-full bg-black/40 border border-slate-800/60 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all appearance-none"
            >
              <option value="all">جميع القنوات</option>
              {Array.from(new Set(liveFeed.map(m => m.channel))).map(c => (
                <option key={c as string} value={c as string}>{c as string}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={feedStatusFilter}
              onChange={(e) => setFeedStatusFilter(e.target.value)}
              className="w-full bg-black/40 border border-slate-800/60 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all appearance-none"
            >
              <option value="all">جميع الحالات</option>
              <option value="processed">تم الاستخراج</option>
              <option value="skipped">تم التخطي</option>
              <option value="error">خطأ</option>
            </select>
          </div>
        </div>

        <div className="bg-black/40 border border-slate-800/60 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isFeedPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
              سجل الرسائل الأخيرة ({liveFeed.length})
            </div>
            {isFeedPaused && <span className="text-[10px] text-amber-500 uppercase tracking-wider">التحديث التلقائي متوقف</span>}
          </h4>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {(() => {
              const filteredFeed = liveFeed.filter(msg => {
                const matchesSearch = msg.text.toLowerCase().includes(feedSearch.toLowerCase());
                const matchesChannel = feedChannelFilter === "all" || msg.channel === feedChannelFilter;
                const matchesStatus = feedStatusFilter === "all" || msg.status === feedStatusFilter;
                return matchesSearch && matchesChannel && matchesStatus;
              }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

              if (filteredFeed.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Search className="w-6 h-6 opacity-20" />
                    </div>
                    لا توجد رسائل تطابق معايير البحث
                  </div>
                );
              }

              return filteredFeed.map((msg, idx) => (
                <div key={msg.id || idx} className="bg-white/[0.02] rounded-2xl p-5 border border-slate-800/60 hover:bg-white/[0.04] hover:border-slate-700/50 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                        <Send className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white tracking-tight">
                          {msg.channel}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDistanceToNow(new Date(msg.time), { addSuffix: true, locale: ar })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        msg.status === 'processed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        msg.status === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-zinc-500/10 text-slate-400 border-zinc-500/20'
                      }`}>
                        {msg.status === 'processed' ? <CheckCircle2 className="w-3 h-3" /> :
                          msg.status === 'error' ? <XCircle className="w-3 h-3" /> :
                          <AlertCircle className="w-3 h-3" />}
                        {msg.status === 'processed' ? 'تم الاستخراج' :
                          msg.status === 'error' ? 'خطأ' : 'تخطي'}
                      </div>
                      
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setSuccess("تم نسخ النص");
                          setTimeout(() => setSuccess(""), 2000);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                        title="نسخ النص"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleManualExtract(msg)}
                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        title="استخراج يدوي"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-black/40 rounded-xl p-4 border border-slate-800/60 relative z-10">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed" dir="auto">
                      {msg.text}
                    </p>
                  </div>

                  {msg.extractedRates && msg.extractedRates.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-800/60 relative z-10">
                      {msg.extractedRates.map((rate: any, rIdx: number) => (
                        <div key={rIdx} className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-3 py-1.5 border border-emerald-500/20">
                          <span className="text-[11px] font-bold text-emerald-500/70">{rate.code}:</span>
                          <span className="text-[12px] font-black font-mono text-emerald-400">{rate.value.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {msg.error && (
                    <div className="mt-4 text-xs text-rose-400 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 relative z-10 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{msg.error}</span>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
