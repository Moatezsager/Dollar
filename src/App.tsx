import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import { AutoUpdateBanner } from "./components/AutoUpdateBanner";
import { AppTour } from "./components/ui/AppTour";
import { FloatingSocialButtons } from "./components/ui/FloatingSocialButtons";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { IOSInstallPrompt } from "./components/ui/IOSInstallPrompt";
import { PostInstallNotification } from "./components/ui/PostInstallNotification";
import { AppToasts } from "./components/ui/AppToasts";
import { PullToRefreshIndicator } from "./components/ui/PullToRefreshIndicator";
import { ScrollToTop } from "./components/ui/ScrollToTop";
import { Header } from "./components/Header";
import { MobileNav } from "./components/MobileNav";
import { Footer } from "./components/Footer";

// Pages
import { Developers } from "./Developers";
import { Terms } from "./components/Terms";
import { Privacy } from "./components/Privacy";
import { Contact } from "./Contact";
import About from "./components/About";

// Sections
import { MainRatesGrid } from "./components/rates/MainRatesGrid";
import { GoldMetalsSection } from "./components/rates/GoldMetalsSection";
import { AdvancedChartsSection } from "./components/charts/AdvancedChartsSection";
import { CurrencyConverterSection } from "./components/CurrencyConverterSection";
import { MoreTabMobile } from "./components/MoreTabMobile";

// Modals
import { CurrencyChartModal } from "./components/modals/CurrencyChartModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { SearchModal } from "./components/modals/SearchModal";
import { PdfExportModal } from "./components/modals/PdfExportModal";
import { PrintableBulletin } from "./components/PrintableBulletin";

// Custom Hooks
import { useAppSettings } from "./hooks/useAppSettings";
import { useRatesData } from "./hooks/useRatesData";
import { useRatesCalculations } from "./hooks/useRatesCalculations";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { usePWA } from "./hooks/usePWA";
import { useShareImage } from "./hooks/useShareImage";

// Utilities
import { safeStorage } from "./utils/storage";
import { searchRates } from "./utils/smartSearch";
import { logErrorToServer } from "./utils/logger";
import { manualCachePurgeAndReload } from "./utils/autoUpdater";

export default function App() {
  // Navigation & Page State
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about'>('dashboard');
  const [activeTab, setActiveTab] = useState<'main' | 'gold' | 'charts' | 'converter' | 'more'>('main');

  // App Settings Hook
  const {
    hapticEnabled,
    setHapticEnabled,
    soundEnabled,
    setSoundEnabled,
    animationsEnabled,
    setAnimationsEnabled,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    showChart,
    setShowChart,
    compactMode,
    setCompactMode,
    dataSaver,
    setDataSaver,
    defaultMarket,
    setDefaultMarket,
    majorChangesOnly,
    setMajorChangesOnly,
    dailySummaryEnabled,
    setDailySummaryEnabled,
    goldNotificationsEnabled,
    setGoldNotificationsEnabled,
    fontSizePreference,
    setFontSizePreference,
    chartResolution,
    setChartResolution,
    spreadAlertEnabled,
    setSpreadAlertEnabled,
    spreadAlertValue,
    setSpreadAlertValue,
    expandedSections,
    toggleSection,
    triggerHaptic,
    playNotificationSound,
  } = useAppSettings();

  // Rates Data & WebSockets Hook
  const {
    rates,
    history,
    configTerms,
    isRefreshing,
    lastFetchTime,
    isOffline,
    onlineCount,
    appStatus,
    toasts,
    addToast,
    removeToast,
    notificationsEnabled,
    notificationThreshold,
    setNotificationThreshold,
    requestNotificationPermission,
    fetchData,
  } = useRatesData({ playNotificationSound });

  // PWA Hook
  const { isInstalled, promptInstall } = usePWA();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showPostInstall, setShowPostInstall] = useState(false);

  // Selected Rate for Detailed Modal
  const [selectedRate, setSelectedRate] = useState<{
    code: string;
    name: string;
    market: 'official' | 'parallel';
  } | null>(null);

  // Calculations & Derivatives Hook
  const {
    chartRange,
    setChartRange,
    dynamicCurrencies,
    officialCurrencyList,
    chartData,
    chartStats,
    advancedStats,
    trends24h,
    staleCurrencies,
    convActiveField,
    setConvActiveField,
    convInputValue,
    setConvInputValue,
    convCurrency,
    setConvCurrency,
    topAmount,
    parallelAmount,
    officialAmount,
    usdRate,
    prevUsdRate,
    usdFlash,
    usdChecksRate,
    prevUsdChecksRate,
    usdChecksFlash,
    usdChecksLastChanged,
    usdLastChanged,
    officialUsdRate,
    prevOfficialUsdRate,
    officialUsdFlash,
    officialUsdLastChanged,
    usd24hStats,
    usdSparklineData,
    allSearchableItems,
  } = useRatesCalculations({
    rates,
    history,
    configTerms,
    selectedRate,
  });

  // Pull to Refresh Hook
  const {
    pullY,
    pullOpacity,
    pullScale,
    pullRotate,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh(() => fetchData(true), triggerHaptic);

  // Share Image Hook
  const { handleShareCardImage } = useShareImage(history, triggerHaptic, addToast);

  // Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<'all' | 'parallel' | 'metals' | 'checks' | 'official' | 'transfers'>('all');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    let results = searchRates(searchQuery, allSearchableItems);
    if (searchCategory !== 'all') {
      results = results.filter(r => r.item.category === searchCategory);
    }
    return results;
  }, [searchQuery, searchCategory, allSearchableItems]);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications' | 'appearance' | 'advanced'>('general');

  // Header More Menu & Tour
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [runTour, setRunTour] = useState(false);

  // Advanced Charts Section State
  const [chartAnalysisCurrency, setChartAnalysisCurrency] = useState('USD_CASH');
  const [chartAnalysisRange, setChartAnalysisRange] = useState<'1w' | '1m' | '6m' | '1y' | 'all'>('1m');

  // PDF Export Modal & Report State
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedOfficialCurrencies, setSelectedOfficialCurrencies] = useState<string[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Initialize PWA and iOS Prompts
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isInstalled) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosPromptDismissed = safeStorage.getItem('iosPromptDismissed');
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);

    if (isIOSDevice && !iosPromptDismissed && !window.matchMedia('(display-mode: standalone)').matches && !(window.navigator as any).standalone) {
      setTimeout(() => setShowIOSPrompt(true), 3000);
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setShowPostInstall(true);
      triggerHaptic([50, 30, 50]);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, triggerHaptic]);

  // Dynamic Theme Color for Mobile Status Bar
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isOffline ? '#f43f5e' : '#050505');
    }
  }, [isOffline]);

  const handleInstall = async () => {
    triggerHaptic(20);
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setShowInstallBanner(false);
        }
      } catch (err) {
        console.error("Install prompt failed:", err);
      }
    } else {
      promptInstall();
    }
  };

  const handleShare = async () => {
    triggerHaptic(15);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مؤشر الدينار | أسعار العملات في ليبيا',
          text: 'تابع أسعار العملات والذهب في ليبيا لحظة بلحظة عبر منصة مؤشر الدينار.',
          url: 'https://dollar-price-qp14.onrender.com/',
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing', error);
          navigator.clipboard.writeText('https://dollar-price-qp14.onrender.com/');
          addToast('تنبيه', 'تم نسخ الرابط بدلاً من المشاركة', 'info');
        }
      }
    } else {
      navigator.clipboard.writeText('https://dollar-price-qp14.onrender.com/');
      addToast('تم النسخ', 'تم نسخ رابط التطبيق لمشاركته', 'info');
    }
  };

  const handleOpenPdfModal = () => {
    triggerHaptic(15);
    setShowMoreMenu(false);
    
    if (selectedCurrencies.length === 0 && selectedOfficialCurrencies.length === 0) {
      const activeParallelAndMetals = configTerms
        .filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id))
        .map(c => c.id);
      setSelectedCurrencies(activeParallelAndMetals);
      setSelectedOfficialCurrencies([]);
    }
    setShowCurrencyModal(true);
  };

  const generatePDF = async (parallelList?: string[], officialList?: string[]) => {
    const parallelToPrint = parallelList !== undefined ? parallelList : selectedCurrencies;
    const officialToPrint = officialList !== undefined ? officialList : selectedOfficialCurrencies;

    if (parallelToPrint.length === 0 && officialToPrint.length === 0) {
      addToast("تنبيه", "يرجى اختيار عملة أو صنف واحد على الأقل لطباعة النشرة", "info");
      return;
    }

    setIsGeneratingPDF(true);
    addToast("جاري التجهيز للطباعة...", "سيتم جلب أحدث الأسعار وتنسيق النشرة الرسمية", "info");
    
    try {
      await fetchData(true);
      setSelectedCurrencies(parallelToPrint);
      setSelectedOfficialCurrencies(officialToPrint);
      
      setTimeout(() => {
        try {
          window.print();
          addToast("تم التجهيز", "تم فتح نافذة الطباعة/الحفظ بنجاح", "up");
        } catch (err: any) {
          console.error('Error during native print:', err);
          logErrorToServer(err, "App.tsx: generatePDF");
          addToast("خطأ فني في التقرير", "حدث خطأ داخلي أثناء فتح نافذة طباعة المتصفح", "info");
        } finally {
          setIsGeneratingPDF(false);
          setShowCurrencyModal(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Error fetching data for PDF:', err);
      setIsGeneratingPDF(false);
      addToast("خطأ في جلب البيانات", "تعذر تحديث الأسعار للتقرير", "info");
    }
  };

  const isInstallPromptVisible = showInstallBanner || showIOSPrompt;

  return (
    <ErrorBoundary>
      <MotionConfig transition={animationsEnabled ? undefined : { duration: 0 }}>
        <div 
          className={`min-h-screen bg-transparent text-white font-sans selection:bg-emerald-500/20 relative overflow-hidden transition-all duration-300 ${
            fontSizePreference === 'small' ? 'text-xs' : fontSizePreference === 'large' ? 'text-base' : 'text-sm'
          }`} 
          dir="rtl"
        >
          {/* Ambient Background Glows */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />

          {/* Installation Prompts & Banners */}
          <InstallPrompt />
          <PushNotificationPrompt />
          <AutoUpdateBanner />

          {/* App Tour */}
          <AppTour runTour={runTour} setRunTour={setRunTour} triggerHaptic={triggerHaptic} />

          {/* Atmospheric Fixed Backgrounds */}
          <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

          {/* Floating Telegram & Facebook Action Buttons (Desktop Only) */}
          <FloatingSocialButtons isInstallPromptVisible={isInstallPromptVisible} />

          {/* Offline & Stale Data Warnings */}
          <OfflineBanner isOffline={isOffline} appStatus={appStatus} />

          {/* iOS Install Prompt */}
          <IOSInstallPrompt
            showIOSPrompt={showIOSPrompt}
            setShowIOSPrompt={setShowIOSPrompt}
            triggerHaptic={triggerHaptic}
          />

          {/* Post-Install Welcome */}
          {showPostInstall && (
            <PostInstallNotification onClose={() => setShowPostInstall(false)} />
          )}

          {/* Global In-App Toast Notifications */}
          <AppToasts toasts={toasts} removeToast={removeToast} />

          {/* Pull to Refresh Indicator */}
          <PullToRefreshIndicator
            pullY={pullY}
            pullOpacity={pullOpacity}
            pullScale={pullScale}
            pullRotate={pullRotate}
            isRefreshing={isRefreshing}
          />

          {/* Main Top Header */}
          <Header
            isRefreshing={isRefreshing}
            lastFetchTime={lastFetchTime}
            showSearchModal={showSearchModal}
            setShowSearchModal={setShowSearchModal}
            showMoreMenu={showMoreMenu}
            setShowMoreMenu={setShowMoreMenu}
            showInstallBanner={showInstallBanner}
            isStandalone={isInstalled}
            handleInstall={handleInstall}
            handleShare={handleShare}
            fetchData={fetchData}
            triggerHaptic={triggerHaptic}
            setCurrentPage={setCurrentPage}
            setRunTour={setRunTour}
            handleOpenPdfModal={handleOpenPdfModal}
            isGeneratingPDF={isGeneratingPDF}
            setShowSettingsModal={setShowSettingsModal}
          />

          {/* Page Routing / Subpages View */}
          <AnimatePresence mode="wait">
            {currentPage === 'api' ? (
              <motion.div key="api" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Developers onBack={() => setCurrentPage('dashboard')} />
              </motion.div>
            ) : currentPage === 'terms' ? (
              <motion.div key="terms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Terms onBack={() => setCurrentPage('dashboard')} />
              </motion.div>
            ) : currentPage === 'privacy' ? (
              <motion.div key="privacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Privacy onBack={() => setCurrentPage('dashboard')} />
              </motion.div>
            ) : currentPage === 'contact' ? (
              <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Contact onBack={() => setCurrentPage('dashboard')} />
              </motion.div>
            ) : currentPage === 'about' ? (
              <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <About onBack={() => setCurrentPage('dashboard')} />
              </motion.div>
            ) : (
              /* Main Dashboard Content */
              <motion.main
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ y: pullY }}
                data-compact={compactMode}
                data-animations={animationsEnabled}
                className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-2.5 sm:pt-6 pb-24 md:pb-16 relative z-10"
              >
                {/* ===================== TAB: MAIN ===================== */}
                <MainRatesGrid
                  activeTab={activeTab}
                  rates={rates}
                  configTerms={configTerms}
                  dynamicCurrencies={dynamicCurrencies}
                  staleCurrencies={staleCurrencies}
                  trends24h={trends24h}
                  usdRate={usdRate}
                  prevUsdRate={prevUsdRate}
                  usdFlash={usdFlash}
                  usdLastChanged={usdLastChanged}
                  usdChecksRate={usdChecksRate}
                  prevUsdChecksRate={prevUsdChecksRate}
                  usdChecksFlash={usdChecksFlash}
                  usdChecksLastChanged={usdChecksLastChanged}
                  officialUsdRate={officialUsdRate}
                  prevOfficialUsdRate={prevOfficialUsdRate}
                  officialUsdFlash={officialUsdFlash}
                  officialUsdLastChanged={officialUsdLastChanged}
                  usd24hStats={usd24hStats}
                  usdSparklineData={usdSparklineData}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  setSelectedRate={setSelectedRate}
                />

                {/* ===================== TAB: GOLD ===================== */}
                <GoldMetalsSection
                  activeTab={activeTab}
                  rates={rates}
                  configTerms={configTerms}
                  staleCurrencies={staleCurrencies}
                  trends24h={trends24h}
                  setSelectedRate={setSelectedRate}
                />

                {/* ===================== TAB: CHARTS ===================== */}
                <AdvancedChartsSection
                  activeTab={activeTab}
                  chartAnalysisCurrency={chartAnalysisCurrency}
                  setChartAnalysisCurrency={setChartAnalysisCurrency}
                  chartAnalysisRange={chartAnalysisRange}
                  setChartAnalysisRange={setChartAnalysisRange}
                  history={history}
                />

                {/* ===================== TAB: CONVERTER ===================== */}
                <CurrencyConverterSection
                  activeTab={activeTab}
                  configTerms={configTerms}
                  convCurrency={convCurrency}
                  setConvCurrency={setConvCurrency}
                  convActiveField={convActiveField}
                  setConvActiveField={setConvActiveField}
                  convInputValue={convInputValue}
                  setConvInputValue={setConvInputValue}
                  topAmount={topAmount}
                  parallelAmount={parallelAmount}
                  officialAmount={officialAmount}
                  triggerHaptic={triggerHaptic}
                />

                {/* ===================== TAB: MORE (Mobile) ===================== */}
                <MoreTabMobile
                  activeTab={activeTab}
                  triggerHaptic={triggerHaptic}
                  setShowSettingsModal={setShowSettingsModal}
                  handleOpenPdfModal={handleOpenPdfModal}
                  handleShare={handleShare}
                  setSettingsTab={setSettingsTab}
                  setCurrentPage={setCurrentPage}
                  onlineCount={onlineCount}
                />

                {/* Desktop Inner Footer */}
                <Footer
                  onlineCount={onlineCount}
                  triggerHaptic={triggerHaptic}
                  setCurrentPage={setCurrentPage}
                  addToast={addToast}
                  manualCachePurgeAndReload={manualCachePurgeAndReload}
                />
              </motion.main>
            )}
          </AnimatePresence>

          {/* Mobile Bottom Navigation Bar */}
          <MobileNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            triggerHaptic={triggerHaptic}
          />

          {/* ===================== MODALS & DIALOGS ===================== */}

          {/* Currency Chart Details Modal */}
          <CurrencyChartModal
            selectedRate={selectedRate}
            setSelectedRate={setSelectedRate}
            rates={rates}
            configTerms={configTerms}
            chartData={chartData}
            chartStats={chartStats}
            advancedStats={advancedStats}
            chartRange={chartRange}
            setChartRange={setChartRange}
            triggerHaptic={triggerHaptic}
            handleShareCardImage={handleShareCardImage}
          />

          {/* Settings Modal */}
          <SettingsModal
            showSettingsModal={showSettingsModal}
            setShowSettingsModal={setShowSettingsModal}
            hapticEnabled={hapticEnabled}
            setHapticEnabled={setHapticEnabled}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            autoRefreshEnabled={autoRefreshEnabled}
            setAutoRefreshEnabled={setAutoRefreshEnabled}
            showChart={showChart}
            setShowChart={setShowChart}
            notificationsEnabled={notificationsEnabled}
            requestNotificationPermission={requestNotificationPermission}
            notificationThreshold={notificationThreshold}
            setNotificationThreshold={setNotificationThreshold}
            majorChangesOnly={majorChangesOnly}
            setMajorChangesOnly={setMajorChangesOnly}
            dailySummaryEnabled={dailySummaryEnabled}
            setDailySummaryEnabled={setDailySummaryEnabled}
            goldNotificationsEnabled={goldNotificationsEnabled}
            setGoldNotificationsEnabled={setGoldNotificationsEnabled}
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            animationsEnabled={animationsEnabled}
            setAnimationsEnabled={setAnimationsEnabled}
            fontSizePreference={fontSizePreference}
            setFontSizePreference={setFontSizePreference}
            dataSaver={dataSaver}
            setDataSaver={setDataSaver}
            defaultMarket={defaultMarket}
            setDefaultMarket={setDefaultMarket}
            chartResolution={chartResolution}
            setChartResolution={setChartResolution}
            spreadAlertEnabled={spreadAlertEnabled}
            setSpreadAlertEnabled={setSpreadAlertEnabled}
            spreadAlertValue={spreadAlertValue}
            setSpreadAlertValue={setSpreadAlertValue}
            triggerHaptic={triggerHaptic}
            addToast={addToast}
          />

          {/* Global Smart Search Modal */}
          <SearchModal
            showSearchModal={showSearchModal}
            setShowSearchModal={setShowSearchModal}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            triggerHaptic={triggerHaptic}
            setSelectedRate={setSelectedRate}
            handleShareCardImage={handleShareCardImage}
          />

          {/* PDF Customization & Export Modal */}
          <PdfExportModal
            showCurrencyModal={showCurrencyModal}
            setShowCurrencyModal={setShowCurrencyModal}
            configTerms={configTerms}
            staleCurrencies={staleCurrencies}
            officialCurrencyList={officialCurrencyList}
            selectedCurrencies={selectedCurrencies}
            setSelectedCurrencies={setSelectedCurrencies}
            selectedOfficialCurrencies={selectedOfficialCurrencies}
            setSelectedOfficialCurrencies={setSelectedOfficialCurrencies}
            rates={rates}
            triggerHaptic={triggerHaptic}
            generatePDF={generatePDF}
          />

          {/* Hidden PDF Printable Bulletin */}
          <PrintableBulletin
            ref={reportRef}
            rates={rates}
            configTerms={configTerms}
            staleCurrencies={staleCurrencies}
            officialCurrencyList={officialCurrencyList}
            selectedCurrencies={selectedCurrencies}
            selectedOfficialCurrencies={selectedOfficialCurrencies}
            usdRate={usdRate}
            prevUsdRate={prevUsdRate}
            usdChecksRate={usdChecksRate}
            prevUsdChecksRate={prevUsdChecksRate}
          />

          {/* Scroll To Top Floating Button */}
          <ScrollToTop triggerHaptic={triggerHaptic} />
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
