import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle2, XCircle, Activity, Globe, RefreshCcw } from 'lucide-react';

export const TelegramDetailedStatus = () => {
  const [status, setStatus] = useState<{ isConnected: boolean; lastFetchTime: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/status');
      if (!response.ok) return;
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch telegram status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className={`border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden ${status.isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
      
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none opacity-20 ${status.isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

      <div className="flex items-start gap-4 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${status.isConnected ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 'bg-rose-500/20 text-rose-400 shadow-rose-500/10'}`}>
          {status.isConnected ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
        </div>
        <div>
          <h3 className={`text-xl font-black mb-1 ${status.isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
            {status.isConnected ? 'حساب تيليجرام متصل ويعمل بنجاح' : 'حساب تيليجرام غير متصل'}
          </h3>
          <p className={`text-sm leading-relaxed ${status.isConnected ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
            {status.isConnected 
              ? 'النظام قادر الآن على الدخول لقنواتك وجلب الأسعار بشكل سلس وآمن وتجاوز أي حظر.'
              : 'النظام لا يستطيع قراءة الأسعار. يرجى إعادة تسجيل الدخول لتفعيل الجلب التلقائي.'}
          </p>
          
          {status.isConnected && (
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Globe className="w-4 h-4" />
                <span>الوصول للقنوات: فعّال</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Activity className="w-4 h-4" />
                <span>
                  آخر تحديث للأسعار: {status.lastFetchTime > 0 ? formatDistanceToNow(new Date(status.lastFetchTime), { locale: ar, addSuffix: true }) : 'في الانتظار...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 shrink-0">
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${status.isConnected ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الحالة</span>
        </button>
      </div>
    </div>
  );
};
