import React from "react";
import {
  Settings2,
  FileText,
  Share2,
  Bell,
  Send,
  Facebook,
  Mail,
  ArrowRight,
  Code2,
  Info,
  ShieldAlert,
  Lock,
} from "lucide-react";
import AppInstallUninstall from "./AppInstallUninstall";

interface MoreTabMobileProps {
  activeTab: string;
  triggerHaptic: (pattern?: number | number[]) => void;
  setShowSettingsModal: (show: boolean) => void;
  handleOpenPdfModal: () => void;
  handleShare: () => void;
  setSettingsTab: (tab: 'general' | 'notifications' | 'appearance' | 'advanced') => void;
  setCurrentPage: (page: 'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about') => void;
  onlineCount: number;
}

export const MoreTabMobile: React.FC<MoreTabMobileProps> = ({
  activeTab,
  triggerHaptic,
  setShowSettingsModal,
  handleOpenPdfModal,
  handleShare,
  setSettingsTab,
  setCurrentPage,
  onlineCount,
}) => {
  return (
    <div className={activeTab === 'more' ? 'block md:hidden' : 'hidden'}>
      <div className="space-y-6 pt-2 pb-8">
        {/* App Info Card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-[#111111] border border-slate-800/60 p-6 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-slate-700/50 flex items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
              <img src="/logo.png" alt="App" className="w-12 h-12 rounded-full relative z-10 drop-shadow-md" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">مؤشر الدينار</h2>
              <p className="text-xs text-emerald-400 font-mono mt-1 uppercase tracking-[0.2em]">Dinar Index Libya</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-medium">v2.1.0</span>
                <span className="text-xs text-slate-500">by GreenBox © 2026</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-800/60">
            <AppInstallUninstall />
          </div>
        </div>

        {/* Section: أدوات المنصة */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">أدوات المنصة</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { triggerHaptic(10); setShowSettingsModal(true); }}
              className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-[#111111] border border-slate-800/60 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-[1rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Settings2 className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="text-sm font-bold text-white">الإعدادات</span>
            </button>

            <button
              onClick={handleOpenPdfModal}
              className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-[#111111] border border-slate-800/60 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-[1rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-white">طباعة PDF</span>
            </button>

            <button
              onClick={() => { triggerHaptic(10); handleShare(); }}
              className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-[#111111] border border-slate-800/60 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-[1rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-white">مشاركة</span>
            </button>

            <button
              onClick={() => { triggerHaptic(10); setShowSettingsModal(true); setSettingsTab('notifications'); }}
              className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-[#111111] border border-slate-800/60 active:scale-95 transition-transform relative overflow-hidden"
            >
              {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              )}
              <div className="w-12 h-12 rounded-[1rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <span className="text-sm font-bold text-white">التنبيهات</span>
            </button>
          </div>
        </div>

        {/* Section: تواصل معنا */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">التواصل والمتابعة</h3>
          <div className="bg-[#111111] rounded-3xl border border-slate-800/60 overflow-hidden">
            <a
              href="https://t.me/libya_index_dollar"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors border-b border-slate-800/60 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-[#24A1DE]/10 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-[#24A1DE]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">قناة التيليجرام</p>
                <p className="text-xs text-slate-400 mt-0.5">@libya_index_dollar</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </a>

            <a
              href="https://www.facebook.com/profile.php?id=61593953519936"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors border-b border-slate-800/60 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center shrink-0">
                <Facebook className="w-5 h-5 text-[#1877F2]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">صفحة الفيسبوك</p>
                <p className="text-xs text-slate-400 mt-0.5">مؤشر الدينار</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </a>

            <button
              onClick={() => { triggerHaptic(10); setCurrentPage('contact'); }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">اتصل بنا</p>
                <p className="text-xs text-slate-400 mt-0.5">للتواصل مع فريق التطوير</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Section: قانوني ومطورين */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">معلومات أخرى</h3>
          <div className="bg-[#111111] rounded-3xl border border-slate-800/60 overflow-hidden">
            <button
              onClick={() => { triggerHaptic(10); setCurrentPage('api'); }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors border-b border-slate-800/60 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <Code2 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">بوابة المطورين (API)</p>
                <p className="text-xs text-slate-400 mt-0.5">الوصول البرمجي للأسعار</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </button>

            <button
              onClick={() => { triggerHaptic(10); setCurrentPage('about'); }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors border-b border-slate-800/60 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">عن المنصة</p>
                <p className="text-xs text-slate-400 mt-0.5">من نحن وكيف نعمل</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </button>

            <button
              onClick={() => { triggerHaptic(10); setCurrentPage('terms'); }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors border-b border-slate-800/60 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">سياسة الاستخدام</p>
                <p className="text-xs text-slate-400 mt-0.5">الشروط والأحكام</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </button>

            <button
              onClick={() => { triggerHaptic(10); setCurrentPage('privacy'); }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">سياسة الخصوصية</p>
                <p className="text-xs text-slate-400 mt-0.5">كيفية حماية بياناتك</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Online count */}
        <div className="flex items-center justify-center pt-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] border border-slate-800/60 shadow-inner">
            <div className="relative flex h-2 w-2">
              <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <div className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </div>
            <span className="text-xs font-mono text-slate-300 tracking-wider">{onlineCount.toLocaleString()}</span>
            <span className="text-xs text-slate-500 uppercase">متواجد الآن</span>
          </div>
        </div>
      </div>
    </div>
  );
};
