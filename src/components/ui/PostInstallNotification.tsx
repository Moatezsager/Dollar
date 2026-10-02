import React, { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, X, Copy } from "lucide-react";

export const PostInstallNotification = ({ onClose }: { onClose: () => void }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-[400px] z-[100]"
    >
      <div className="relative overflow-hidden rounded-3xl glass-panel-heavy premium-border border border-emerald-500/30 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.3)] p-6 backdrop-blur-xl">
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full" />
        
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-right">
                <h3 className="text-white font-bold text-lg">تم التثبيت بنجاح!</h3>
                <p className="text-slate-400 text-xs">شكراً لتثبيت تطبيق مؤشر الدينار</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-800/60 text-right">
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              يمكنك الآن الوصول السريع لأسعار الصرف من شاشتك الرئيسية. شارك التطبيق مع أصدقائك!
            </p>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-slate-800/60 text-slate-500 text-xs font-mono truncate text-left">
                {window.location.origin}
              </div>
              <button
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  copied 
                    ? 'bg-emerald-500 text-black' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    نسخ الرابط
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
