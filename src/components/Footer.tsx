import React from "react";
import { RefreshCw } from "lucide-react";
import AppInstallUninstall from "./AppInstallUninstall";

interface FooterProps {
  onlineCount: number;
  triggerHaptic: (pattern?: number | number[]) => void;
  setCurrentPage: (page: 'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about') => void;
  addToast: (title: string, message: string, type?: 'info' | 'up' | 'down') => void;
  manualCachePurgeAndReload: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onlineCount,
  triggerHaptic,
  setCurrentPage,
  addToast,
  manualCachePurgeAndReload,
}) => {
  return (
    <>
      {/* Footer - Desktop inside main container */}
      <footer className="hidden md:flex pt-16 pb-12 border-t border-slate-800/60 flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
            <span className="text-xs font-mono tracking-[0.2em] uppercase text-slate-400">Dinar Index Libya</span>
          </div>
          
          {/* Online Count Badge - Elegant Style */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-slate-800/60 shadow-inner">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></div>
                <div className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></div>
              </div>
              <span className="text-xs font-mono text-slate-300 tracking-tighter">
                {onlineCount.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-3 bg-white/10"></div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">متواجد الآن</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500 font-light tracking-wide">
            by <span className="text-white font-medium">GreenBox</span> © 2026
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-1 h-1 rounded-full bg-emerald-500/30"></div>
            <div className="w-1 h-1 rounded-full bg-emerald-500/50"></div>
            <div className="w-1 h-1 rounded-full bg-emerald-500/30"></div>
          </div>
        </div>
      </footer>

      {/* ====== DESKTOP FOOTER (Hidden on Mobile) ====== */}
      <footer className="hidden md:flex flex-col items-center justify-center py-10 mt-12 border-t border-slate-700/50 bg-[#020617] relative z-10 w-full px-6 max-w-7xl mx-auto">
        <div className="w-full max-w-2xl mx-auto mb-10 pb-10 border-b border-slate-800/60">
           <div className="text-center mb-4">
             <h3 className="text-lg font-bold text-white mb-2">تطبيق مؤشر الدينار</h3>
             <p className="text-slate-400 text-sm">احصل على أسرع وأفضل تجربة للمنصة من خلال التثبيت على جهازك.</p>
           </div>
           <AppInstallUninstall />
        </div>
        
        <div className="flex items-center justify-center gap-8 mb-8">
          <button onClick={() => { window.scrollTo(0,0); setCurrentPage('terms'); }} className="text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors">
            شروط الاستخدام
          </button>
          <button onClick={() => { window.scrollTo(0,0); setCurrentPage('privacy'); }} className="text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors">
            سياسة الخصوصية
          </button>
          <button onClick={() => { window.scrollTo(0,0); setCurrentPage('contact'); }} className="text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors">
            اتصل بنا
          </button>
          <button onClick={() => { window.scrollTo(0,0); setCurrentPage('about'); }} className="text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors">
            عن المنصة
          </button>
        </div>
        
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={async () => {
              triggerHaptic(10);
              addToast('تحديث الواجهة', 'جاري تفريغ الذاكرة المؤقتة وتحديث المتصفح...', 'info');
              setTimeout(() => {
                manualCachePurgeAndReload();
              }, 300);
            }} 
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-slate-700/50 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>التحقق من التحديثات وتفريغ الكاش</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-slate-700/50">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full" />
          </div>
          <span className="text-xs text-slate-500 font-medium">مؤشر الدينار &copy; {new Date().getFullYear()} - جميع الحقوق محفوظة</span>
        </div>
      </footer>
    </>
  );
};
