import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  RefreshCw, 
  Power, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Send, 
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  Info
} from 'lucide-react';
import { FlagIcon } from './FlagIcon';

interface CblStatus {
  enabled: boolean;
  lastOfficialFetchDate: string;
  lastOfficialBroadcastDate?: string;
  isTodayFetched: boolean;
  isInActiveWindow: boolean;
  isWeekend: boolean;
  currentLibyaDate: string;
  currentLibyaTime: string;
  currentLibyaHour: number;
  lastSuccessfulFetchTime?: number;
  rates?: Record<string, number>;
}

interface AdminCentralBankProps {
  token: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const AdminCentralBank: React.FC<AdminCentralBankProps> = ({
  token,
  onError,
  onSuccess
}) => {
  const [status, setStatus] = useState<CblStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/cbl-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setStatus(data.status);
        }
      }
    } catch (err: any) {
      console.error('Error fetching CBL status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    try {
      const res = await fetch('/api/admin/cbl-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !status.enabled })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus(data.status);
        onSuccess(data.message || (data.enabled ? 'تم تنشيط الدالة بنجاح' : 'تم إيقاف الدالة بنجاح'));
      } else {
        onError(data.error || 'فشل تغيير حالة الدالة');
      }
    } catch (err: any) {
      onError('خطأ في الاتصال بالخادم: ' + (err?.message || err));
    } finally {
      setToggling(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/refresh-official', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.status) setStatus(data.status);
        onSuccess('تم تحديث أسعار المصرف المركزي بنجاح وحفظها في قاعدة البيانات');
      } else {
        onError(data.message || 'فشل التحديث من موقع المصرف المركزي');
      }
    } catch (err: any) {
      onError('خطأ تقني أثناء التحديث: ' + (err?.message || err));
    } finally {
      setRefreshing(false);
      fetchStatus();
    }
  };

  const handleBroadcastOfficial = async () => {
    setBroadcasting(true);
    try {
      const res = await fetch('/api/admin/telegram/official-broadcast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess('تم إرسال ونشر أسعار المصرف المركزي على القنوات بنجاح');
      } else {
        onError(data.error || 'فشل إرسال النشرة الرسمية');
      }
    } catch (err: any) {
      onError('خطأ أثناء إرسال النشرة: ' + (err?.message || err));
    } finally {
      setBroadcasting(false);
      fetchStatus();
    }
  };

  if (loading && !status) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-bold">جاري تحميل بيانات مصرف ليبيا المركزي...</p>
      </div>
    );
  }

  const currenciesList = [
    { code: 'USD', name: 'الدولار الأمريكي', flag: 'us' },
    { code: 'EUR', name: 'اليورو الأوروبي', flag: 'eu' },
    { code: 'GBP', name: 'الجنيه الإسترليني', flag: 'gb' },
    { code: 'AED', name: 'الدرهم الإماراتي', flag: 'ae' },
    { code: 'SAR', name: 'الريال السعودي', flag: 'sa' },
    { code: 'TND', name: 'الدينار التونسي', flag: 'tn' },
    { code: 'TRY', name: 'الليرة التركية', flag: 'tr' },
    { code: 'EGP', name: 'الجنيه المصري', flag: 'eg' },
    { code: 'CAD', name: 'الدولار الكندي', flag: 'ca' },
    { code: 'CHF', name: 'الفرنك السويسري', flag: 'ch' },
    { code: 'CNY', name: 'اليوان الصيني', flag: 'cn' },
    { code: 'JPY', name: 'الين الياباني (100)', flag: 'jp' }
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900/40 via-slate-900/80 to-slate-950 border border-blue-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none -ml-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10 shrink-0">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl md:text-2xl font-black text-white">إدارة مصرف ليبيا المركزي (السوق الرسمي)</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                  status?.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {status?.enabled ? 'الدالة مفعلة' : 'الدالة معطلة'}
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                التحكم التلقائي واليدوي في كشط ونشر أسعار الصرف الرسمية الصادرة عن مصرف ليبيا المركزي
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
                status?.enabled
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <Power className={`w-4 h-4 ${toggling ? 'animate-spin' : ''}`} />
              <span>{status?.enabled ? 'إيقاف تنشيط الدالة' : 'تنشيط دالة الجلب'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs md:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/25"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'جاري الجلب من المركزي...' : 'تحديث أسعار السوق الرسمي الآن'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rules & Logic Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white text-sm">قواعد عمل دالة المركزي الذكية لترشيد الاستهلاك:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              <li><strong className="text-slate-200">نافذة النشاط:</strong> تعمل الدالة تلقائياً فقط بين الساعة <span className="text-amber-300 font-bold">9:00 صباحاً و 11:00 صباحاً</span> بتوقيت ليبيا.</li>
              <li><strong className="text-slate-200">الإغلاق الذاتي:</strong> بمجرد جلب نشرة اليوم بنجاح من الموقع، <span className="text-emerald-300 font-bold">تتوقف الدالة تماماً</span> عن الجلب أو النشر لباقي اليوم.</li>
              <li><strong className="text-slate-200">أيام العمل:</strong> تعمل الدالة من الأحد إلى الخميس (المصرف مغلق الجمعة والسبت).</li>
              <li><strong className="text-slate-200">التحديث اليدوي:</strong> زر "تحديث الآن" بالأعلى يتجاوز هذه الشروط ويجلب فوراً بطلبك.</li>
            </ul>
          </div>
        </div>

        <a 
          href="https://cbl.gov.ly/currency-exchange-rates/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-blue-400 border border-slate-700/60 transition-all font-bold shrink-0 self-start md:self-center"
        >
          <span>زيارة موقع المصرف المركزي</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Function State */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">حالة دالة الجلب الآلي</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              status?.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <Power className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white">
            {status?.enabled ? 'مفعّلة ونشطة' : 'متوقفة ومعطلة'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {status?.enabled ? 'تراقب تلقائياً في نافذة 9-11 ص' : 'تم إيقافها يدوياً بواسطة الأدمن'}
          </p>
        </div>

        {/* 2. Active Window Status */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">نافذة الجلب (9:00 - 11:00 ص)</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              status?.isInActiveWindow ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white flex items-center gap-2">
            <span>{status?.currentLibyaTime || '--:--'}</span>
            <span className="text-xs text-slate-400 font-normal">(بتوقيت ليبيا)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {status?.isInActiveWindow ? '🟢 داخل نافذة العمل حالياً' : '⚪ خارج نافذة العمل (الدالة خاملة)'}
          </p>
        </div>

        {/* 3. Today Bulletin Status */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">نشرة اليوم الرسمية</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              status?.isTodayFetched ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {status?.isTodayFetched ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-lg font-black text-white">
            {status?.isTodayFetched ? 'تم الجلب وتوقف الدالة' : 'في انتظار نشرة اليوم'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {status?.isTodayFetched ? 'الدالة متوقفة لباقي اليوم لترشيد الاستهلاك' : 'ستعمل الدالة فور حلول الساعة 9 صباحاً'}
          </p>
        </div>

        {/* 4. Last Recorded Date */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">تاريخ آخر جلب معتمد</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white">
            {status?.lastOfficialFetchDate || 'غير مسجل'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تاريخ النشرة المسجلة حالياً
          </p>
        </div>
      </div>

      {/* Broadcast Bulletin to Social Media Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            <span>نشر النشرة الرسمية على قنوات التواصل</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            إرسال جدول أسعار مصرف ليبيا المركزي المعتمدة مباشرة إلى قنوات تليجرام وصفحة فيسبوك
          </p>
        </div>

        <button
          onClick={handleBroadcastOfficial}
          disabled={broadcasting}
          className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-blue-500/30 font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <Send className={`w-4 h-4 ${broadcasting ? 'animate-pulse' : ''}`} />
          <span>{broadcasting ? 'جاري الإرسال...' : 'إرسال نشرة المركزي الآن'}</span>
        </button>
      </div>

      {/* Live Official Rates Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">أسعار الصرف الرسمية الحالية (مصرف ليبيا المركزي)</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {currenciesList.filter(c => status?.rates?.[c.code]).length} عملة مسجلة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {currenciesList.map((curr) => {
            const val = status?.rates?.[curr.code];
            return (
              <div 
                key={curr.code}
                className="bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/30 rounded-2xl p-4 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <FlagIcon flagCode={curr.flag} name={curr.name} className="w-10 h-10 shadow-md" />
                  <div>
                    <span className="text-xs font-black text-white block">{curr.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{curr.code}</span>
                  </div>
                </div>

                <div className="text-left">
                  {val ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black font-mono text-blue-400">{val.toFixed(4)}</span>
                      <span className="text-[10px] text-slate-400">د.ل</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 font-mono">غير متوفر</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
