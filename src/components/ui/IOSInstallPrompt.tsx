import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share2, PlusSquare, X } from "lucide-react";
import { safeStorage } from "../../utils/storage";

interface IOSInstallPromptProps {
  showIOSPrompt: boolean;
  setShowIOSPrompt: (show: boolean) => void;
  triggerHaptic: (pattern?: number | number[]) => void;
}

export const IOSInstallPrompt: React.FC<IOSInstallPromptProps> = ({
  showIOSPrompt,
  setShowIOSPrompt,
  triggerHaptic,
}) => {
  return (
    <AnimatePresence>
      {showIOSPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-[100] bg-slate-900/80/98 border border-slate-700/50 p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-slate-700/50 shrink-0">
              <img src="/logo.png" alt="App Icon" className="w-10 h-10 rounded-full shadow-lg" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold text-base">ثبّت "مؤشر الدينار" على هاتفك</h4>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                للوصول السريع ومتابعة الأسعار حتى بدون إنترنت:
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 p-2 rounded-xl">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                    <Share2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span>اضغط على زر المشاركة في متصفح سفاري</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 p-2 rounded-xl">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                    <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span>اختر "إضافة إلى الشاشة الرئيسية"</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                triggerHaptic(5);
                setShowIOSPrompt(false);
                safeStorage.setItem('iosPromptDismissed', 'true');
              }}
              className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Indicator Arrow for Safari Share Button */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900/80 rotate-45 border-r border-b border-slate-700/50"></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
