import React, { useState } from "react";
import { motion } from "motion/react";
import { Terminal, RefreshCw, Copy } from 'lucide-react';

interface AdminReportProps {
  token: string;
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

export function AdminReport({ token }: AdminReportProps) {
  const [systemReport, setSystemReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/admin/system-report", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setSystemReport(data);
      }
    } catch (e) {
      console.warn("Failed to fetch system report");
    }
    setLoading(false);
  };

  return (
    <motion.div 
      key="report"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Terminal className="w-8 h-8 text-blue-400" />
            تقرير حالة النظام
          </h2>
          <p className="text-sm text-slate-400 mt-2">عرض تقرير تشخيصي شامل لحالة الخوادم وقواعد البيانات والأخطاء</p>
        </div>
        <button 
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          تحديث التقرير
        </button>
      </div>

      {systemReport ? (
        <div className="glass-panel-heavy premium-border border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono text-slate-400">REPORT_GENERATED_AT: {systemReport.generated_at}</span>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(systemReport, null, 2));
                alert('تم نسخ التقرير بنجاح!');
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all"
            >
              <Copy className="w-4 h-4" />
              نسخ JSON
            </button>
          </div>
          <div className="p-6 overflow-x-auto">
            <pre className="text-[11px] sm:text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap" dir="ltr">
              {JSON.stringify(systemReport, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 glass-panel-heavy premium-border rounded-3xl border border-slate-800/60 border-dashed">
          <Terminal className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">لا يوجد تقرير حالياً</h3>
          <p className="text-slate-500 text-sm">اضغط على زر تحديث التقرير في الأعلى لجلب البيانات</p>
        </div>
      )}
    </motion.div>
  );
}
