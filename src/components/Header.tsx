import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
  BookOpen,
  Download,
  Search,
  RefreshCw,
  MoreVertical,
  FileText,
  Share2,
  Code2,
  Info,
  Mail,
  Settings2,
} from "lucide-react";
import { safeStorage } from "../utils/storage";

interface HeaderProps {
  isRefreshing: boolean;
  lastFetchTime: Date | null;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (show: boolean) => void;
  showInstallBanner: boolean;
  isStandalone: boolean;
  handleInstall: () => void;
  handleShare: () => void;
  fetchData: (force?: boolean) => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  setCurrentPage: (page: 'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about') => void;
  setRunTour: (run: boolean) => void;
  handleOpenPdfModal: () => void;
  isGeneratingPDF: boolean;
  setShowSettingsModal: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRefreshing,
  lastFetchTime,
  showSearchModal,
  setShowSearchModal,
  showMoreMenu,
  setShowMoreMenu,
  showInstallBanner,
  isStandalone,
  handleInstall,
  handleShare,
  fetchData,
  triggerHaptic,
  setCurrentPage,
  setRunTour,
  handleOpenPdfModal,
  isGeneratingPDF,
  setShowSettingsModal,
}) => {
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowMoreMenu]);

  return (
    <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-[#070b14]/90 backdrop-blur-2xl pt-safe shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 sm:h-18 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Site Title / Brand Bar */}
        <div 
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none min-w-0"
          onClick={() => {
            triggerHaptic(8);
            setCurrentPage('dashboard');
          }}
          onDoubleClick={() => window.location.href = '/admin-panel-secure'}
          title="الرئيسية (انقر مرتين للإدارة)"
        >
          {/* Logo */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-1 flex items-center justify-center shadow-sm shrink-0 hover:scale-105 active:scale-95 transition-transform">
            <img src="/logo.png" alt="مؤشر الدينار" className="w-full h-full object-contain rounded-lg" />
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col min-w-0 justify-center">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight hover:text-emerald-300 transition-colors truncate">
              مؤشر الدينار
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-zinc-400 font-medium truncate">أسعار السوق الموازي والرسمي</span>
            </div>
          </div>
        </div>
        
        {/* Header Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Live Clock / Status Badge (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-xs font-mono text-zinc-400">
            {isRefreshing ? (
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            ) : (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            )}
            <span className="tracking-wider uppercase" dir="ltr">
              {isRefreshing ? "جاري التحديث..." : (lastFetchTime ? format(lastFetchTime, "HH:mm:ss") : "...")}
            </span>
          </div>

          {/* Comprehensive Guide Button (Desktop Only) */}
          <button 
            onClick={() => {
              triggerHaptic(10);
              setRunTour(true);
              safeStorage.removeItem('tourCompleted');
            }}
            className="hidden sm:flex h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-emerald-500/10 active:scale-95 border border-white/[0.08] hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-300 transition-all items-center justify-center gap-1.5 shadow-sm"
            title="الدليل الشامل"
            aria-label="الدليل الشامل"
          >
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">الدليل</span>
          </button>
          
          {/* Install Button (PWA) (Desktop / Tablet) */}
          {showInstallBanner && !isStandalone && (
            <button 
              onClick={handleInstall}
              className="hidden sm:flex h-9 px-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 active:scale-95 border border-blue-500/30 text-blue-300 hover:text-white transition-all items-center justify-center gap-1.5 shadow-sm"
              title="تثبيت التطبيق على جهازك"
              aria-label="تثبيت التطبيق"
            >
              <Download className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold">تثبيت</span>
            </button>
          )}

          {/* Smart Search Button */}
          <button 
            onClick={() => {
              triggerHaptic(8);
              setShowSearchModal(!showSearchModal);
            }}
            className={`w-9 h-9 sm:w-auto sm:h-9 sm:px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
              showSearchModal 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]' 
                : 'bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-300'
            }`}
            title="البحث الذكي في الأسعار"
            aria-label="البحث الذكي"
          >
            <Search className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-xs font-semibold hidden md:inline">بحث</span>
          </button>

          {/* Refresh Button */}
          <button 
            onClick={() => {
              triggerHaptic(10);
              fetchData(true);
            }}
            className="w-9 h-9 sm:w-auto sm:h-9 sm:px-3 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 active:scale-95 border border-white/[0.08] hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-300 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            title="تحديث البيانات لحظياً"
            aria-label="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs font-semibold hidden md:inline">تحديث</span>
          </button>

          {/* More Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              id="more-menu-btn"
              onClick={() => {
                triggerHaptic(10);
                setShowMoreMenu(!showMoreMenu);
              }}
              className="w-9 h-9 sm:w-9 sm:h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white transition-all flex items-center justify-center shadow-sm"
              title="المزيد من الخيارات"
              aria-label="المزيد من الخيارات"
            >
              <MoreVertical className="w-4 h-4 shrink-0" />
            </button>

            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-[#0a0f1d]/95 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 overflow-hidden"
                >
                  <div className="flex flex-col gap-0.5">
                    {/* Guide item for Mobile */}
                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        setRunTour(true);
                        safeStorage.removeItem('tourCompleted');
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">الدليل الشامل للتطبيق</span>
                    </button>

                    {showInstallBanner && !isStandalone && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          handleInstall();
                        }}
                        className="flex sm:hidden items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                          <Download className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">تثبيت التطبيق على هاتفك</span>
                      </button>
                    )}

                    <button
                      id="export-pdf-btn"
                      onClick={handleOpenPdfModal}
                      disabled={isGeneratingPDF}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">{isGeneratingPDF ? 'جاري التحميل...' : 'طباعة نشرة PDF'}</span>
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        handleShare();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">مشاركة التطبيق</span>
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        setCurrentPage('api');
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">بوابة المطورين (API)</span>
                    </button>

                    <div className="h-px bg-white/[0.08] my-1 mx-2" />

                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        setCurrentPage('about');
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Info className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">عن المنصة</span>
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        setCurrentPage('contact');
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">اتصل بنا وملاحظاتك</span>
                    </button>

                    <div className="h-px bg-white/[0.08] my-1 mx-2" />

                    <button
                      id="notification-settings-btn"
                      onClick={() => {
                        triggerHaptic(10);
                        setShowMoreMenu(false);
                        setShowSettingsModal(true);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 text-zinc-300 flex items-center justify-center shrink-0">
                        <Settings2 className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">الإعدادات والتنبيهات</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
