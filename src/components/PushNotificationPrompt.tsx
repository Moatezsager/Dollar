import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, ChevronRight, Share, PlusSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ----------------------------------------------------------------
// Helper: تحويل VAPID public key إلى Uint8Array
// ----------------------------------------------------------------
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type Step = 'idle' | 'prompt' | 'ios-guide' | 'loading' | 'success' | 'denied';

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function PushNotificationPrompt() {
  const [step, setStep]       = useState<Step>('idle');
  const [isIos, setIsIos]     = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- كشف البيئة وتحديد هل نُظهر البرومبت ----
  useEffect(() => {
    const init = async () => {
      // تأخير 4 ثوانٍ حتى لا يُزعج المستخدم فور الدخول
      await new Promise(r => setTimeout(r, 4000));

      const dismissedAt = localStorage.getItem('pushPromptDismissed_v4');
      if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 30 * 24 * 60 * 60 * 1000) return;

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const _isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const _isStandalone =
        window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;

      setIsIos(_isIos);
      setIsStandalone(_isStandalone);

      // لو الإذن ممنوح مسبقاً → جدّد الاشتراك فقط بصمت
      if (Notification.permission === 'granted') {
        silentResubscribe();
        return;
      }

      // لو الإذن مرفوض → لا نسأل مرة أخرى
      if (Notification.permission === 'denied') return;

      setStep('prompt');
    };

    init();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // ---- تجديد صامت للاشتراك ----
  const silentResubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub   = await reg.pushManager.getSubscription();

      if (!sub) {
        const keyRes  = await fetch('/api/push/public-key');
        if (!keyRes.ok) return;
        const contentType = keyRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;
        const keyData = await keyRes.json();
        if (!keyData?.publicKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
        });
        await saveSubscription(sub);
      } else {
        await fetch('/api/push/active', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint })
        });
      }
    } catch (e) {
      console.warn('[Push] silentResubscribe failed:', e);
    }
  };

  // ---- حفظ الاشتراك على السيرفر ----
  const saveSubscription = async (sub: PushSubscription) => {
    await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub })
    });
  };

  // ---- زر "تفعيل" الرئيسي ----
  const handleSubscribe = async () => {
    // iOS في وضع متصفح عادي → أرشد للتثبيت
    if (isIos && !isStandalone) {
      setStep('ios-guide');
      return;
    }

    setStep('loading');
    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const keyRes  = await fetch('/api/push/public-key');
        if (!keyRes.ok) throw new Error("Failed to fetch public key");
        const contentType = keyRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) throw new Error("Invalid response");
        const keyData = await keyRes.json();
        if (!keyData?.publicKey) throw new Error("No public key returned");
        const reg     = await navigator.serviceWorker.ready;

        // إلغاء أي اشتراك قديم أولاً (تجنباً للتعارض)
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe();

        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
        });
        await saveSubscription(newSub);
        setStep('success');
        timerRef.current = setTimeout(() => setStep('idle'), 3000);
      } else {
        setStep('denied');
        timerRef.current = setTimeout(() => setStep('idle'), 4000);
      }
    } catch (e) {
      console.error('[Push] Subscribe failed:', e);
      setStep('denied');
      timerRef.current = setTimeout(() => setStep('idle'), 4000);
    }
    localStorage.setItem('pushPromptDismissed_v4', Date.now().toString());
  };

  // ---- إغلاق / تجاهل ----
  const handleDismiss = () => {
    setStep('idle');
    localStorage.setItem('pushPromptDismissed_v4', Date.now().toString());
  };

  if (step === 'idle') return null;

  return (
    <AnimatePresence mode="wait">
      {/* ===== البرومبت الرئيسي ===== */}
      {step === 'prompt' && (
        <motion.div
          key="prompt"
          initial={{ opacity: 0, y: 60, x: '-50%' }}
          animate={{ opacity: 1, y: 0,  x: '-50%' }}
          exit={{    opacity: 0, y: 30, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="fixed bottom-[110px] left-1/2 w-[calc(100%-2rem)] max-w-sm z-[95]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.7)] bg-gradient-to-br from-[#141414] to-[#0b0b0b]">
            {/* خط علوي متوهج */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
            {/* دائرة ضوء خلفية */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="p-4 flex items-start gap-3">
              {/* أيقونة */}
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-[0_0_24px_rgba(37,99,235,0.45)] border border-blue-400/20">
                <Bell className="w-5 h-5 text-white" />
              </div>

              {/* النص */}
              <div className="flex-1 text-right min-w-0">
                <p className="text-white font-bold text-sm leading-tight">تفعيل التنبيهات الفورية</p>
                <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">
                  {isIos && !isStandalone
                    ? 'لتفعيل التنبيهات على iOS، ثبِّت التطبيق أولاً'
                    : 'كن أول من يعلم بتغير أسعار الدولار والذهب'}
                </p>
              </div>

              {/* زر الإغلاق */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1.5 text-white/30 hover:text-white/70 hover:bg-white/8 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* الأزرار */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={handleSubscribe}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-95 text-white font-bold text-sm transition-all shadow-[0_0_18px_rgba(37,99,235,0.35)] border border-blue-500/30"
              >
                {isIos && !isStandalone ? 'كيف أثبّت؟' : 'تفعيل الآن 🔔'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 text-sm transition-colors border border-white/8"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== دليل تثبيت iOS ===== */}
      {step === 'ios-guide' && (
        <motion.div
          key="ios-guide"
          initial={{ opacity: 0, y: 60, x: '-50%' }}
          animate={{ opacity: 1, y: 0,  x: '-50%' }}
          exit={{    opacity: 0, y: 30, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="fixed bottom-[110px] left-1/2 w-[calc(100%-2rem)] max-w-sm z-[95]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.7)] bg-gradient-to-br from-[#141414] to-[#0b0b0b]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={handleDismiss} className="p-1.5 text-white/30 hover:text-white/60 rounded-xl transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <p className="text-white font-bold text-sm">تثبيت التطبيق على iPhone</p>
              </div>

              {/* الخطوات */}
              <div className="space-y-3">
                {[
                  { icon: <Share className="w-4 h-4 text-blue-400" />, text: 'اضغط على زر المشاركة في الأسفل' },
                  { icon: <PlusSquare className="w-4 h-4 text-blue-400" />, text: 'اختر "إضافة إلى الشاشة الرئيسية"' },
                  { icon: <Bell className="w-4 h-4 text-blue-400" />, text: 'افتح التطبيق وفعّل التنبيهات' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <p className="text-zinc-300 text-sm text-right flex-1">{item.text}</p>
                    <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 rotate-180" />
                  </div>
                ))}
              </div>

              <button
                onClick={handleDismiss}
                className="mt-4 w-full py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                فهمت، شكراً
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== جاري التفعيل ===== */}
      {step === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, scale: 0.9, x: '-50%' }}
          animate={{ opacity: 1, scale: 1,   x: '-50%' }}
          exit={{    opacity: 0, scale: 0.9, x: '-50%' }}
          className="fixed bottom-[110px] left-1/2 w-[calc(100%-2rem)] max-w-sm z-[95]"
        >
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141414] to-[#0b0b0b] p-5 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-zinc-300 text-sm text-right">جاري تفعيل التنبيهات...</p>
          </div>
        </motion.div>
      )}

      {/* ===== تم التفعيل بنجاح ===== */}
      {step === 'success' && (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.8, x: '-50%' }}
          animate={{ opacity: 1, scale: 1,   x: '-50%' }}
          exit={{    opacity: 0, scale: 0.9, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="fixed bottom-[110px] left-1/2 w-[calc(100%-2rem)] max-w-sm z-[95]"
        >
          <div className="rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-950/60 to-[#0b0b0b] p-5 flex items-center gap-3 shadow-[0_0_30px_rgba(34,197,94,0.12)]">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="text-right">
              <p className="text-white font-bold text-sm">تم تفعيل التنبيهات! 🎉</p>
              <p className="text-zinc-400 text-xs mt-0.5">ستصلك تنبيهات فورية عند تغيير الأسعار</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== تم الرفض ===== */}
      {step === 'denied' && (
        <motion.div
          key="denied"
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0,  x: '-50%' }}
          exit={{    opacity: 0, y: 10, x: '-50%' }}
          className="fixed bottom-[110px] left-1/2 w-[calc(100%-2rem)] max-w-sm z-[95]"
        >
          <div className="rounded-3xl border border-yellow-500/15 bg-gradient-to-br from-yellow-950/40 to-[#0b0b0b] p-4">
            <p className="text-zinc-400 text-sm text-right">
              لتفعيل التنبيهات لاحقاً، اذهب إلى إعدادات المتصفح وأعطِ الموقع إذن الإشعارات.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
