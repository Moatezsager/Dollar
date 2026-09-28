import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle2, XCircle, AlertTriangle, Activity, Globe, RefreshCcw, Bot } from 'lucide-react';

export const TelegramDetailedStatus = () => {
  const [status, setStatus] = useState<{ 
    isConnected: boolean; 
    isAuthRevoked?: boolean;
    lastError?: string;
    hasBotToken?: boolean;
    lastFetchTime: number;
  } | null>(null);
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

  const isWarning = status.isAuthRevoked && !status.hasBotToken;

  return (
    <div className="space-y-4">
      <div className={`border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden ${
        status.isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/20' 
          : isWarning 
            ? 'bg-amber-500/10 border-amber-500/20' 
            : 'bg-rose-500/10 border-rose-500/20'
      }`}>
        
        {/* Background Glow */}
        <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none opacity-20 ${
          status.isConnected ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
        }`}></div>

        <div className="flex items-start gap-4 relative z-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
            status.isConnected 
              ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10' 
              : isWarning 
                ? 'bg-amber-500/20 text-amber-400 shadow-amber-500/10'
                : 'bg-rose-500/20 text-rose-400 shadow-rose-500/10'
          }`}>
            {status.isConnected ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : isWarning ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
          </div>
          <div>
            <h3 className={`text-xl font-black mb-1 ${
              status.isConnected ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {status.isConnected 
                ? (status.hasBotToken ? 'النشر عبر بوت تيليجرام (Bot API) جاهز ومتصل' : 'حساب تيليجرام متصل ويعمل بنجاح')
                : isWarning 
                  ? 'جلسة تيليجرام ملغاة (AUTH_KEY_DUPLICATED)' 
                  : 'حساب تيليجرام غير متصل'}
            </h3>
            <p className={`text-sm leading-relaxed ${
              status.isConnected ? 'text-emerald-500/80' : isWarning ? 'text-amber-500/80' : 'text-rose-500/80'
            }`}>
              {status.isConnected 
                ? 'النظام قادر الآن على جلب الأسعار بشكل سلس والنشر بالقناة وتجاوز أي انقطاع.'
                : isWarning 
                  ? 'تم إلغاء الجلسة من سيرفرات تيليجرام لتكرار الاتصال. الكاشط يعمل حالياً بالجلب العام الآمن. يرجى إعادة تسجيل الدخول بالأسفل لتجديد النشر.'
                  : 'النظام يعمل بالجلب العام الآمن. يرجى تسجيل الدخول أو إدخال Bot Token لتفعيل النشر في القناة.'}
            </p>
            
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Globe className="w-4 h-4" />
                <span>جلب القنوات: فعّال (عام + MTProto)</span>
              </div>
              {status.hasBotToken && (
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400/90 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                  <Bot className="w-4 h-4" />
                  <span>بوت تيليجرام: مربوط</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Activity className="w-4 h-4" />
                <span>
                  آخر جلب للأسعار: {status.lastFetchTime > 0 ? formatDistanceToNow(new Date(status.lastFetchTime), { locale: ar, addSuffix: true }) : 'في الانتظار...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 shrink-0">
          <button 
            onClick={fetchStatus}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              status.isConnected 
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الحالة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
