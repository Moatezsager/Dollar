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
  Clock,
} from "lucide-react";
import { safeStorage } from "../utils/storage";
import { ThemeToggle } from './ui/ThemeToggle';

interface HeaderProps {
  showSectionNav: boolean;
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
  showSectionNav,
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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showMoreMenu) {
        setShowMoreMenu(false);
        moreMenuRef.current?.querySelector<HTMLButtonElement>('#more-menu-btn')?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [setShowMoreMenu, showMoreMenu]);

  return (
    <header className="app-header sticky top-0 z-50 pt-safe border-b border-slate-800 bg-[#070b14]">
      <div className="header-inner max-w-7xl mx-auto px-3 sm:px-6 min-h-[64px] lg:min-h-[76px] py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Site Title / Brand Bar */}
        <a href="/" aria-label="مؤشر الدينار، الرئيسية"
          className="header-brand flex items-center gap-2 sm:gap-3 select-none min-w-0"
          onClick={(event) => {
            event.preventDefault();
            triggerHaptic(8);
            setCurrentPage('dashboard');
          }}
          onDoubleClick={() => window.location.href = '/admin-panel-secure'}
          title="مؤشر الدينار | الرئيسية"
        >
          {/* Logo */}
          <div className="header-logo w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-emerald-500/10 p-1 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="مؤشر الدينار" className="w-full h-full object-contain rounded-lg" />
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col min-w-0 justify-center">
            <h1 className="header-brand-title text-base sm:text-xl font-bold text-white leading-tight truncate">
              مؤشر الدينار
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="brand-subtitle hidden sm:block text-xs text-zinc-400 font-medium truncate">أسعار العملات في ليبيا</span>
            </div>
          </div>
        </a>
        
        {showSectionNav && (
          <nav aria-label="أقسام لوحة الأسعار" className="header-section-nav">
            {[
              ['rates-section', 'أسعار العملات'],
              ['metals-grid', 'الذهب والمعادن'],
              ['charts-section', 'التحليل'],
              ['currency-converter-section', 'المحول'],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`}>{label}</a>
            ))}
          </nav>
        )}
        {/* Header Action Icons */}
        <div className="header-actions flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="header-theme"><ThemeToggle /></div>

          <div className="header-primary-tools">
          {/* Smart Search Button */}
          <button 
            onClick={() => {
              triggerHaptic(8);
              setShowSearchModal(!showSearchModal);
            }}
            className={`header-tool header-search inline-flex ${showSearchModal ? 'is-selected' : ''}`}
            title="البحث الذكي في الأسعار"
            aria-label="البحث الذكي"
          >
            <Search className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="header-search-label">بحث عن عملة</span>
          </button>

          {/* Refresh Button */}
          <button 
            onClick={() => {
              triggerHaptic(10);
              fetchData(true);
            }}
            className="header-tool header-action-refresh inline-flex"
            title="تحديث البيانات لحظياً"
            aria-label="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* More Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              id="more-menu-btn"
              onClick={() => {
                triggerHaptic(10);
                setShowMoreMenu(!showMoreMenu);
              }}
              className={`header-tool inline-flex ${showMoreMenu ? 'is-selected' : ''}`}
              title="المزيد من الخيارات"
              aria-label="المزيد من الخيارات"
              aria-expanded={showMoreMenu}
              aria-controls="header-more-panel"
            >
              <MoreVertical className="w-4 h-4 shrink-0" />
            </button>

            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  id="header-more-panel"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="header-more-panel absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-160px)] rounded-lg bg-[#0a0f1d] border border-white/10 shadow-lg p-2 z-50 overflow-y-auto overscroll-contain"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="header-menu-sync flex items-center gap-2 px-3 py-3 text-xs text-zinc-400" aria-live="polite">
                      <Clock className="w-4 h-4" aria-hidden="true" />
                      <span>آخر مزامنة</span>
                      <span className="font-mono text-slate-200" dir="ltr">
                        {isRefreshing ? "جاري التحديث..." : (lastFetchTime ? format(lastFetchTime, "HH:mm:ss") : "...")}
                      </span>
                    </div>
                    <div className="compact-theme items-center justify-between px-3 py-2 text-sm">
                      <span>مظهر الواجهة</span>
                      <ThemeToggle />
                    </div>
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
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all w-full text-right"
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
      </div>
    </header>
  );
};
