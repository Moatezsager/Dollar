import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { onUpdateAvailable, purgeAllCachesAndReload } from '../utils/autoUpdater';

export const AutoUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });

    const handleCustomEvent = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('dinar:update-available', handleCustomEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('dinar:update-available', handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable || isUpdating) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerUpdate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [updateAvailable, isUpdating]);

  const triggerUpdate = async () => {
    setIsUpdating(true);
    await purgeAllCachesAndReload();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-md"
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl shadow-emerald-500/10 rounded-2xl p-4 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">تحديث جديد للواجهة!</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                </div>
                <span className="text-xs text-slate-400">
                  {isUpdating ? 'جاري مسح الكاش وتحديث الصفحة...' : `التحديث التلقائي خلال ${countdown} ثوانٍ`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerUpdate}
                disabled={isUpdating}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>تحديث الآن</span>
              </button>

              <button
                onClick={() => setUpdateAvailable(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
