import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  QrCode, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  Clock, 
  Radio, 
  Layers, 
  Sliders,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface WhatsAppStatusData {
  status: 'disconnected' | 'connecting' | 'scan_qr' | 'connected' | 'error';
  qrCodeUrl: string | null;
  phoneNumber: string | null;
  userName: string | null;
  connectedAt: string | null;
  lastMessageTime: string | null;
  lastError: string | null;
  messagesReceivedCount: number;
  ratesExtractedCount: number;
  autoProcessEnabled: boolean;
  activeChatsCount: number;
}

interface AdminWhatsAppProps {
  token: string;
  fetchWithTimeout: (resource: string, options?: any, timeout?: number) => Promise<Response>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

export const AdminWhatsApp: React.FC<AdminWhatsAppProps> = ({
  token,
  fetchWithTimeout,
  setError,
  setSuccess
}) => {
  const [statusData, setStatusData] = useState<WhatsAppStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetchWithTimeout('/api/admin/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStatusData(json.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch WhatsApp status:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);

    // Auto-poll status frequently when waiting for QR scan or connecting
    const interval = setInterval(() => {
      fetchStatus(false);
    }, statusData?.status === 'scan_qr' || statusData?.status === 'connecting' ? 3000 : 10000);

    return () => clearInterval(interval);
  }, [token, statusData?.status]);

  const handleInit = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithTimeout('/api/admin/whatsapp/init', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      const json = await res.json();
      if (json.success) {
        setSuccess('جاري تشغيل عميل واتساب وتوليد رمز QR...');
        await fetchStatus(true);
      } else {
        setError(json.error || 'فشل تشغيل العميل');
      }
    } catch (err: any) {
      setError(err?.message || 'خطأ في الاتصال بالسيرفر');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('هل أنت متأكد من تسجيل الخروج وقطع اتصال واتساب؟ سيتوقف جلب الأسعار من الواتساب حتى إعادة المسح.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchWithTimeout('/api/admin/whatsapp/disconnect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      const json = await res.json();
      if (json.success) {
        setSuccess('تم تسجيل الخروج وقطع الاتصال بنجاح');
        await fetchStatus(true);
      } else {
        setError(json.error || 'فشل قطع الاتصال');
      }
    } catch (err: any) {
      setError(err?.message || 'خطأ في الاتصال بالسيرفر');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoProcess = async () => {
    if (!statusData) return;
    const nextVal = !statusData.autoProcessEnabled;
    try {
      const res = await fetchWithTimeout('/api/admin/whatsapp/toggle-auto', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ enabled: nextVal })
      });
      const json = await res.json();
      if (json.success) {
        setStatusData(prev => prev ? { ...prev, autoProcessEnabled: nextVal } : null);
        setSuccess(nextVal ? 'تم تفعيل المعالجة التلقائية للأسعار' : 'تم إيقاف المعالجة التلقائية مؤقتاً');
      }
    } catch (err: any) {
      setError('فشل تعديل إعداد المعالجة التلقائية');
    }
  };

  const isConnected = statusData?.status === 'connected';
  const isScanning = statusData?.status === 'scan_qr';
  const isConnecting = statusData?.status === 'connecting';

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Banner & Status Card */}
      <div className="bg-[#0b1220]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
              isConnected
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : isScanning
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 animate-pulse'
                : 'bg-white/5 border-white/10 text-zinc-400'
            }`}>
              <MessageSquare className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  ربط وتكامل واتساب (WhatsApp Channels & Groups)
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isScanning
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : isConnecting
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-ping' : isScanning ? 'bg-amber-400 animate-ping' : isConnecting ? 'bg-blue-400' : 'bg-zinc-500'
                  }`} />
                  {isConnected
                    ? 'متصل ويعمل الآن 🟢'
                    : isScanning
                    ? 'بانتظار مسح QR Code 🟡'
                    : isConnecting
                    ? 'جاري التهيئة والاتصال... 🔵'
                    : 'غير متصل 🔴'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
                رصد فوري لأسعار العملات والذهب والصكوك من قنوات ومجموعات الواتساب بالتوازي مع التيليجرام لزيادة دقة وموثوقية الأسعار.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <button
              onClick={() => fetchStatus(true)}
              disabled={loading || actionLoading}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>

            {!isConnected ? (
              <button
                onClick={handleInit}
                disabled={actionLoading || isConnecting}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <QrCode className="w-4 h-4" />
                <span>{isScanning ? 'تجديد رمز QR' : 'بدء الاتصال ومسح الرمز'}</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>قطع الاتصال</span>
              </button>
            )}
          </div>
        </div>

        {/* Ambient glow */}
        <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20 ${
          isConnected ? 'bg-emerald-500/10' : isScanning ? 'bg-amber-500/10' : 'bg-transparent'
        }`} />
      </div>

      {/* Main Grid: QR Pairing or Connected Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column: QR Code Display OR Connected Phone Info */}
        <div className="lg:col-span-1 space-y-6">
          {!isConnected ? (
            /* QR Code Pairing Box */
            <div className="bg-[#0b1220]/90 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl space-y-5 text-center shadow-xl">
              <div className="flex items-center justify-center gap-2 text-zinc-200 font-bold text-sm">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>مسح رمز الاستجابة السريعة (QR)</span>
              </div>

              {statusData?.qrCodeUrl ? (
                <div className="relative inline-block p-4 rounded-2xl bg-white border-4 border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.15)] mx-auto">
                  <img
                    src={statusData.qrCodeUrl}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                  />
                  <div className="absolute inset-x-0 bottom-1 flex justify-center">
                    <span className="text-[10px] font-mono font-bold text-zinc-700 bg-white/90 px-2 py-0.5 rounded shadow">
                      يتحدث الرمز تلقائياً
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-56 h-56 sm:w-64 sm:h-64 mx-auto rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-6 text-zinc-500 space-y-3 bg-white/[0.02]">
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-xs text-zinc-300 font-medium">جاري تجهيز الرمز المشفر...</p>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-10 h-10 text-zinc-600" />
                      <p className="text-xs text-zinc-400">انقر على الزر بالأسفل لتوليد الرمز</p>
                      <button
                        onClick={handleInit}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all"
                      >
                        توليد رمز QR
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Step-by-step instructions */}
              <div className="text-right space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed">
                <p className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  خطوات الربط من هاتفك:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>افتح تطبيق واتساب على هاتفك (شريحة مخصصة).</li>
                  <li>اضغط على القائمة (الثلاث نقاط) ⬅️ **الأجهزة المرتبطة**.</li>
                  <li>اضغط على **ربط جهاز (Link a Device)**.</li>
                  <li>وجّه الكاميرا نحو الرمز أعلاه لمسحه.</li>
                </ol>
                <p className="text-[11px] text-emerald-400/80 pt-1">
                  💡 يتم حفظ جلسة الاتصال بالسيرفر مشفرة ولن تحتاج لمسحه مجدداً.
                </p>
              </div>
            </div>
          ) : (
            /* Connected Device Card */
            <div className="bg-[#0b1220]/90 border border-emerald-500/30 rounded-3xl p-6 backdrop-blur-2xl space-y-5 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {statusData.userName || 'حساب واتساب النشط'}
                  </h3>
                  <p className="text-xs font-mono text-emerald-400 font-bold" dir="ltr">
                    +{statusData.phoneNumber || 'متصل'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/[0.08] text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>تاريخ بدء الاتصال:</span>
                  <span className="font-mono text-zinc-200">
                    {statusData.connectedAt ? new Date(statusData.connectedAt).toLocaleDateString('ar-LY') : 'الآن'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>وقت آخر رسالة واردة:</span>
                  <span className="font-mono text-zinc-200">
                    {statusData.lastMessageTime ? new Date(statusData.lastMessageTime).toLocaleTimeString('ar-LY') : 'بانتظار منشورات'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>المجموعات والقنوات النشطة:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {statusData.activeChatsCount} محادثة
                  </span>
                </div>
              </div>

              {/* Toggle Auto Process */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-200">المعالجة والتحديث التلقائي</p>
                  <p className="text-[11px] text-zinc-500">تحديث الأسعار فورياً عند التقاطها</p>
                </div>
                <button
                  onClick={handleToggleAutoProcess}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                    statusData.autoProcessEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {statusData.autoProcessEnabled ? 'مفعل ✅' : 'معطل ⏸️'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Metrics & Strict Rules */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-[#0b1220]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>الرسائل الملتقطة</span>
                <Radio className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white font-mono">
                {statusData?.messagesReceivedCount || 0}
              </p>
              <p className="text-[10px] text-zinc-500">من قنوات ومجموعات الواتساب</p>
            </div>

            <div className="bg-[#0b1220]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>الأسعار المستخرجة</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {statusData?.ratesExtractedCount || 0}
              </p>
              <p className="text-[10px] text-zinc-500">تمت مطابقتها وتأكيدها</p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#0b1220]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>المحادثات المرصودة</span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white font-mono">
                {statusData?.activeChatsCount || 0}
              </p>
              <p className="text-[10px] text-zinc-500">قنوات ومجموعات نشطة</p>
            </div>
          </div>

          {/* Strict Fetching Rules & Consensus Engine (نفس شروط التيليجرام بدقة) */}
          <div className="bg-[#0b1220]/90 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">
                شروط وضوابط الجلب الدقيقة من الواتساب (مماثلة للتيليجرام 100%)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>1. شرط رسائل اليوم بتوقيت ليبيا:</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  يتم استبعاد أي رسائل مرسلة قبل بداية اليوم الحالي بتوقيت ليبيا (GMT+2) تلقائياً لمنع قراءة أسعار قديمة.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>2. فحص الحدود المنطقية (Sanity Check):</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  فحص كل رقم مستخرج مقابل الحدين الأدنى والأقصى المحددين في إعدادات المنصة (مثل: الدولار 5 - 25 د.ل).
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>3. حظر أرقام الهواتف والتواريخ:</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  فلترة ذكية تحظر أرقام الهواتف (091، 092...)، وبطاقات الشحن، وساعات النشر، لمنع أي استخراج خاطئ.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>4. رفض القفزات الشاذة والتوافق:</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  إذا تجاوزت قفزة السعر 25% فجأة عن السعر الحالي، يُرفض التحديث فوراً ويسجل في سجل الحماية للتأكد من صحته.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>التسجيل الحي:</strong> كل منشور يتم رصده من الواتساب يظهر فورياً في شاشة «التغذية الحية» و«حركة الأسعار» موضحاً باسم المجموعة ونص المنشور والأسعار الملتقطة.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
