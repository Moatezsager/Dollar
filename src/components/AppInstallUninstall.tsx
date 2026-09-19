import React, { useState } from 'react';
import { Download, Trash2, X, Share, PlusSquare, AlertCircle, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWA } from '../hooks/usePWA';

export default function AppInstallUninstall() {
  const { isInstalled, canInstall, promptInstall, os } = usePWA();
  const [showUninstallInfo, setShowUninstallInfo] = useState(false);
  const [showIOSInstallInfo, setShowIOSInstallInfo] = useState(false);
  const [showDesktopInstallInfo, setShowDesktopInstallInfo] = useState(false);

  const handleInstallClick = () => {
    if (os === 'ios') {
      setShowIOSInstallInfo(true);
    } else if (canInstall) {
      promptInstall();
    } else {
      // Fallback if beforeinstallprompt hasn't fired
      if (os === 'desktop' || os === 'unknown') {
        setShowDesktopInstallInfo(true);
      } else {
        alert('الرجاء استخدام خيار "تثبيت التطبيق" أو "الإضافة للشاشة الرئيسية" من قائمة المتصفح.');
      }
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 w-full">
        {!isInstalled ? (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            <Download className="w-4 h-4" />
            <span className="font-bold text-sm">تثبيت التطبيق</span>
          </button>
        ) : (
          <button
            onClick={() => setShowUninstallInfo(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]"
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-bold text-sm">إلغاء التثبيت</span>
          </button>
        )}
      </div>

      <AnimatePresence>

        {showDesktopInstallInfo && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
              dir="rtl"
            >
              <button 
                onClick={() => setShowDesktopInstallInfo(false)}
                className="absolute top-4 left-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30 text-emerald-400">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">تثبيت التطبيق على الكمبيوتر</h3>
              <p className="text-sm text-zinc-400 mb-6">يبدو أن المتصفح لم يظهر رسالة التثبيت التلقائية. يمكنك التثبيت يدوياً:</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0 font-bold font-mono">
                    ⋮
                  </div>
                  <p className="text-sm text-zinc-300">1. اضغط على أيقونة <strong>النقاط الثلاث</strong> أعلى يسار/يمين المتصفح (Chrome/Edge).</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-zinc-300">2. ابحث عن خيار <strong>تثبيت التطبيق (Install App)</strong> أو <strong>Save and Share &gt; Install</strong>.</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 shrink-0 font-bold text-xl pb-2">
                    ⤓
                  </div>
                  <p className="text-sm text-zinc-300">ملاحظة: يمكنك أيضاً إيجاد أيقونة التثبيت <strong>مباشرة في شريط العنوان (URL bar)</strong> بجانب النجمة.</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowDesktopInstallInfo(false)}
                className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </div>
        )}
        {showIOSInstallInfo && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
              dir="rtl"
            >
              <button 
                onClick={() => setShowIOSInstallInfo(false)}
                className="absolute top-4 left-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30 text-emerald-400">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">تثبيت التطبيق على آيفون (iOS)</h3>
              <p className="text-sm text-zinc-400 mb-6">اتبع الخطوات البسيطة التالية لإضافة مؤشر الدينار إلى شاشتك الرئيسية:</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                    <Share className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-zinc-300">1. اضغط على زر <strong>المشاركة</strong> في أسفل شاشة المتصفح.</p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-zinc-300">2. اختر <strong>إضافة إلى الشاشة الرئيسية</strong> من القائمة.</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowIOSInstallInfo(false)}
                className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </div>
        )}

        {showUninstallInfo && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
              dir="rtl"
            >
              <button 
                onClick={() => setShowUninstallInfo(false)}
                className="absolute top-4 left-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/30 text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">إلغاء تثبيت التطبيق</h3>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400/90 leading-relaxed">
                  لا يمكن للمتصفح حذف التطبيق تلقائياً لدواعي أمنية. يرجى اتباع الخطوات الخاصة بجهازك:
                </p>
              </div>

              <div className="space-y-3">
                {os === 'android' && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      أندرويد (Android)
                    </h4>
                    <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                      <li>اذهب إلى الشاشة الرئيسية لهاتفك.</li>
                      <li>اضغط مطولاً على أيقونة <strong>مؤشر الدينار</strong>.</li>
                      <li>اختر <strong>إلغاء التثبيت</strong> أو اسحب الأيقونة إلى سلة المهملات.</li>
                    </ul>
                  </div>
                )}
                
                {os === 'ios' && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      آيفون (iOS)
                    </h4>
                    <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                      <li>اذهب إلى الشاشة الرئيسية لهاتفك.</li>
                      <li>اضغط مطولاً على أيقونة <strong>مؤشر الدينار</strong>.</li>
                      <li>اختر <strong>حذف التطبيق</strong> أو اضغط على علامة (X).</li>
                    </ul>
                  </div>
                )}
                
                {(os === 'desktop' || os === 'unknown') && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      الكمبيوتر (Chrome/Edge)
                    </h4>
                    <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                      <li>افتح التطبيق.</li>
                      <li>في الشريط العلوي للمتصفح، اضغط على <strong>النقاط الثلاث (⋮)</strong> بجانب رابط الموقع.</li>
                      <li>اختر <strong>إلغاء تثبيت مؤشر الدينار...</strong>.</li>
                    </ul>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowUninstallInfo(false)}
                className="w-full mt-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
