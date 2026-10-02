import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, ArrowDownRight, Info, X } from "lucide-react";
import { ToastItem } from "../../types/rates";

interface AppToastsProps {
  toasts: ToastItem[];
  onRemoveToast?: (id: string) => void;
  removeToast?: (id: string) => void;
}

export const AppToasts: React.FC<AppToastsProps> = ({ toasts, onRemoveToast, removeToast }) => {
  const handleRemove = (id: string) => {
    if (removeToast) removeToast(id);
    else if (onRemoveToast) onRemoveToast(id);
  };
  return (
    <div className="fixed bottom-28 md:bottom-6 left-6 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto glass-panel-heavy premium-border /90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl flex items-start gap-4"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              toast.type === 'up' ? 'bg-rose-500/10 text-rose-400' : 
              toast.type === 'down' ? 'bg-emerald-500/10 text-emerald-400' : 
              'bg-blue-500/10 text-blue-400'
            }`}>
              {toast.type === 'up' ? <ArrowUpRight className="w-5 h-5" /> : 
               toast.type === 'down' ? <ArrowDownRight className="w-5 h-5" /> : 
               <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white mb-1">{toast.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{toast.body}</p>
            </div>
            <button 
              onClick={() => handleRemove(toast.id)}
              className="text-zinc-600 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
