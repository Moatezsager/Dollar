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
    <div aria-live="polite" aria-relevant="additions" className="fixed bottom-32 md:bottom-6 left-4 right-4 md:right-auto z-[200] flex flex-col gap-3 md:w-96 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="app-toast pointer-events-auto flex items-start gap-3"
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
              <h4>{toast.title}</h4>
              <p>{toast.body}</p>
            </div>
            <button 
              aria-label="إغلاق التنبيه"
              onClick={() => handleRemove(toast.id)}
              className="app-toast-close flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
