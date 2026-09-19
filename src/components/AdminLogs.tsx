import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Terminal, RefreshCw, Clock, ChevronDown } from 'lucide-react';
import { format } from "date-fns";

interface AdminLogsProps {
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

export function AdminLogs({ token, setError, setSuccess }: AdminLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/error-logs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn("Failed to fetch error logs");
    }
  };

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
  }, [token]);

  return (
    <motion.div 
      key="logs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <section className="glass-panel-heavy premium-border border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-800/60 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black flex items-center gap-3 text-rose-400">
              <Terminal className="w-6 h-6" />
              سجلات النظام (Console Logs)
            </h2>
            <p className="text-sm text-slate-500 mt-1">آخر 20 رسالة خطأ أو تحذير من السيرفر والمستخدمين</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                if (window.confirm("هل أنت متأكد من مسح جميع سجلات الأخطاء؟")) {
                  try {
                    const res = await fetch("/api/admin/error-logs", {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                      setLogs([]);
                      setSuccess("تم مسح السجلات بنجاح");
                      setTimeout(() => setSuccess(""), 3000);
                    }
                  } catch (e) {
                    setError("فشل مسح السجلات");
                    setTimeout(() => setError(""), 3000);
                  }
                }
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500/20 transition-all border border-rose-500/20 text-sm"
            >
              تنظيف السجل
            </button>
            <button 
              onClick={fetchLogs}
              className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all border border-slate-800/60"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="bg-black/40 p-6 font-mono text-sm leading-relaxed max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
          {logs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4"> 
              <Clock className="w-10 h-10 text-zinc-800" />
              <p className="text-zinc-600">لا توجد سجلات حالياً. النظام يعمل باستقرار.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, i) => (
                <div key={i} className="border-b border-slate-800/60 pb-4 last:border-0 hover:bg-white/[0.02] p-4 rounded-2xl transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-rose-500 font-black text-xs uppercase px-2 py-0.5 bg-rose-500/10 rounded">Error</span>
                    <span className="text-zinc-600 text-[10px]">{log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "---"}</span>
                  </div>
                  <p className="text-slate-200 font-bold mb-1 selection:bg-rose-500/30">{log.message || "Unknown error"}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-600 uppercase">Context</span>
                      <span className="text-[11px] text-emerald-500/70">{log.context || "Backend"}</span>
                    </div>
                    {log.url && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-600 uppercase">URL</span>
                        <span className="text-[11px] text-blue-500/70 truncate max-w-xs">{log.url}</span>
                      </div>
                    )}
                  </div>
                  {log.stack && (
                    <details className="mt-4 group">
                      <summary className="text-[10px] text-zinc-700 cursor-pointer hover:text-slate-400 transition-colors uppercase tracking-widest font-black list-none flex items-center gap-2">
                        <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                        Show Stack Trace
                      </summary>
                      <pre className="mt-3 p-4 bg-black/60 rounded-xl border border-slate-800/60 text-[10px] text-slate-500 overflow-x-auto selection:bg-rose-500/20">
                        {log.stack}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}
