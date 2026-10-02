import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { WifiOff, AlertCircle } from "lucide-react";
import { AppStatus } from "../../types/rates";

interface OfflineBannerProps {
  isOffline: boolean;
  appStatus: AppStatus | null;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, appStatus }) => {
  return (
    <>
      {/* Offline & Stale Data Warning - Top Banner */}
      <AnimatePresence>
        {(isOffline || appStatus?.status === 'stale') && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`relative z-[60] border-b overflow-hidden shadow-lg pt-safe ${
              isOffline 
                ? 'bg-rose-500 border-rose-400 text-white' 
                : 'bg-amber-500 border-amber-400 text-black'
            }`}
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isOffline ? 'bg-white/20' : 'bg-black/10'} animate-pulse`}>
                  {isOffline ? <WifiOff className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest">
                    {isOffline ? "أنت الآن في وضع عدم الاتصال" : "تنبيه: البيانات قديمة"}
                  </span>
                  <p className="text-xs opacity-90 font-medium leading-tight">
                    {isOffline ? (
                      "يرجى التحقق من اتصال الإنترنت للحصول على آخر التحديثات اللحظية."
                    ) : (
                      appStatus?.minutesSinceLastChange && appStatus.minutesSinceLastChange > 60 ? (
                        `آخر تغيير في الأسعار كان منذ ${Math.floor(appStatus.minutesSinceLastChange / 60)} ساعة. قد تختلف الأسعار الحالية.`
                      ) : (
                        `آخر تحديث للبيانات كان منذ أكثر من 12 ساعة. الأسعار قد تختلف.`
                      )
                    )}
                  </p>
                </div>
              </div>
              
              {isOffline && (
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white text-rose-600 text-xs font-black rounded-xl hover:bg-zinc-100 transition-all active:scale-95 shadow-md shrink-0"
                >
                  تحديث الصفحة
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Offline Pill Indicator */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold whitespace-nowrap"
          >
            <WifiOff className="w-4 h-4" />
            أنت الآن غير متصل بالإنترنت
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
