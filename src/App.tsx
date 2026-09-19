import About from "./components/About";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate, MotionConfig } from "motion/react";
import { toPng } from "html-to-image";
import Joyride, { Step, CallBackProps, STATUS, TooltipRenderProps } from 'react-joyride';
import {
  LayoutGrid,
  Calculator,
  Home,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Activity,
  Building2,
  LineChart,
  Coins,
  Clock,
  Bell,
  FileText,
  TrendingUp,
  Globe,
  Settings2,
  X,
  CheckCircle2,
  Copy,
  AlertCircle,
  Info,
  BookOpen,
  WifiOff,
  Zap,
  Send,
  Share2,
  Download,
  Smartphone,
  PlusSquare,
  Disc,
  ArrowUp,
  MoreVertical,
  ChevronDown,
  Code2,
  Mail,
  Minus,
  Facebook,
  ShieldAlert,
  Lock,
  Printer
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { logErrorToServer } from "./utils/logger";
import { FlagIcon } from "./components/FlagIcon";
import { Developers } from "./Developers";
import { Contact } from "./Contact";
import { Terms } from "./components/Terms";
import { Privacy } from "./components/Privacy";
import { decodeData } from "./utils/security";
import { io } from "socket.io-client";
import { RateCell } from "./components/RateCell";
import { usePriceFlash } from "./hooks/usePriceFlash";
import InstallPrompt from "./components/InstallPrompt";
import AppInstallUninstall from "./components/AppInstallUninstall";
import PushNotificationPrompt from "./components/PushNotificationPrompt";


interface Rates {
  official: Record<string, number>;
  parallel: Record<string, number>;
  previousOfficial?: Record<string, number>;
  previousParallel?: Record<string, number>;
  lastUpdated: string;
  lastChanged?: {
    official: Record<string, string>;
    parallel: Record<string, string>;
  };
}

interface HistoryPoint {
  time: string;
  usdParallel: number;
  usdOfficial: number;
  ratesParallel?: Record<string, number>;
  ratesOfficial?: Record<string, number>;
}

const CURRENCIES = [
  { code: "USD", name: "دولار أمريكي", flag: "us" },
  { code: "EUR", name: "يورو", flag: "eu" },
  { code: "GBP", name: "جنيه إسترليني", flag: "gb" },
  { code: "TND", name: "دينار تونسي", flag: "tn" },
  { code: "TRY", name: "ليرة تركية", flag: "tr" },
  { code: "EGP", name: "جنيه مصري", flag: "eg" },
  { code: "JOD", name: "دينار أردني", flag: "jo" },
  { code: "BHD", name: "دينار بحريني", flag: "bh" },
  { code: "KWD", name: "دينار كويتي", flag: "kw" },
  { code: "AED", name: "درهم إماراتي", flag: "ae" },
  { code: "SAR", name: "ريال سعودي", flag: "sa" },
  { code: "QAR", name: "ريال قطري", flag: "qa" },
  { code: "CNY", name: "يوان صيني", flag: "cn" },
];

const PARALLEL_DETAILS = [
  { code: "USD_TR", name: "حوالات تركيا", flag: "tr", unit: "د.ل" },
  { code: "USD_AE", name: "حوالات دبي", flag: "ae", unit: "د.ل" },
  { code: "USD_CN", name: "حوالات الصين", flag: "cn", unit: "د.ل" },
];

const METAL_IDS = [
  "GOLD_CAST_18",
  "GOLD_CAST_24",
  "GOLD_EXT_18",
  "GOLD_EXT_21",
  "GOLD_SCRAP_18",
  "GOLD_SCRAP_21",
  "GOLD_LIRA_8G",
  "GOLD_LIRA_14G",
  "GOLD_MUJARA_14G",
  "SILVER_CAST_1000"
];

const PostInstallNotification = ({ onClose }: { onClose: () => void }) => {
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
      <div className="relative overflow-hidden rounded-3xl  glass-panel-heavy premium-border  border border-emerald-500/30 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.3)] p-6 backdrop-blur-xl">
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

const ScrollToTop = ({ triggerHaptic }: { triggerHaptic: (p?: number) => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    triggerHaptic(15);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 z-[100] w-12 h-12 rounded-full bg-emerald-500 text-black shadow-lg flex items-center justify-center hover:bg-emerald-400 transition-colors"
          title="العودة للأعلى"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

const RateSkeleton = () => (
  <div className="flex flex-col p-2.5 rounded-2xl skeleton-pulse -m-2.5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/5" />
        <div className="w-16 h-3 bg-white/5 rounded-full" />
      </div>
      <div className="w-10 h-3 bg-white/5 rounded-full" />
    </div>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-24 h-8 bg-white/5 rounded-xl" />
    </div>
    <div className="flex items-center justify-between gap-2">
      <div className="w-12 h-2 bg-white/5 rounded-full" />
      <div className="w-16 h-2 bg-white/5 rounded-full" />
    </div>
  </div>
);

const SkeletonRates = () => (
  <div className="space-y-16">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
      {[...Array(10)].map((_, i) => <RateSkeleton key={i} />)}
    </div>
  </div>
);

export default function App() {
  const [rates, setRates] = useState<Rates | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [selectedRate, setSelectedRate] = useState<{ code: string, name: string, market: 'official' | 'parallel' } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isInstallPromptVisible, setIsInstallPromptVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about'>('dashboard');
  const [activeTab, setActiveTab] = useState<'main' | 'gold' | 'charts' | 'converter' | 'more'>('main');


  const [chartAnalysisCurrency, setChartAnalysisCurrency] = useState('USD_CASH');
  const [chartAnalysisRange, setChartAnalysisRange] = useState<'1w' | '1m' | '6m' | '1y' | 'all'>('1m');
  const [hapticEnabled, setHapticEnabled] = useState(() => {
    const saved = localStorage.getItem('hapticEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('autoRefreshEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [showChart, setShowChart] = useState(() => {
    const saved = localStorage.getItem('showChart');
    return saved !== null ? saved === 'true' : true;
  });
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Network Status Listener
  // Analytics Tracker
  useEffect(() => {
    const sessionId = sessionStorage.getItem('__sessionId') || (Math.random().toString(36).substring(2) + Date.now().toString(36));
    sessionStorage.setItem('__sessionId', sessionId);
    
    let deviceId = localStorage.getItem('__deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('__deviceId', deviceId);
    }

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        visitorId: deviceId,
        pagePath: window.location.pathname,
        referrer: document.referrer
      })
    }).catch(e => console.log('Analytics tracking issue:', e));
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Haptic Feedback Helper
  const triggerHaptic = (pattern: number | number[] = 10) => {
    console.log('triggerHaptic called, enabled:', hapticEnabled, 'supported:', !!window.navigator.vibrate);
    if (hapticEnabled && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  };

  useEffect(() => {
    const handleInstallPrompt = (e: any) => setIsInstallPromptVisible(e.detail);
    window.addEventListener('installPromptVisibility', handleInstallPrompt);
    return () => window.removeEventListener('installPromptVisibility', handleInstallPrompt);
  }, []);

  // PWA Install Logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Check iOS prompt
    const iosPromptDismissed = localStorage.getItem('iosPromptDismissed');
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice && !iosPromptDismissed && !window.matchMedia('(display-mode: standalone)').matches && !(window.navigator as any).standalone) {
      setTimeout(() => setShowIOSPrompt(true), 3000);
    }

    // Handle app installed event
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
  }, []);

  // Dynamic Theme Color for Mobile Status Bar
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isOffline ? '#f43f5e' : '#050505');
    }
  }, [isOffline]);

  const handleInstall = async () => {
    triggerHaptic(20);
    if (!deferredPrompt) return;
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
        // Ignore AbortError (user canceled)
        if (error.name !== 'AbortError') {
          console.error('Error sharing', error);
          // Fallback to clipboard if share fails for other reasons
          navigator.clipboard.writeText('https://dollar-price-qp14.onrender.com/');
          addToast('تنبيه', 'تم نسخ الرابط بدلاً من المشاركة', 'info');
        }
      }
    } else {
      navigator.clipboard.writeText('https://dollar-price-qp14.onrender.com/');
      addToast('تم النسخ', 'تم نسخ رابط التطبيق لمشاركته', 'info');
    }
  };
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications' | 'appearance' | 'advanced'>('general');
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem('compactMode');
    return saved !== null ? saved === 'true' : false;
  });
  const [dataSaver, setDataSaver] = useState(() => {
    const saved = localStorage.getItem('dataSaver');
    return saved !== null ? saved === 'true' : false;
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    foreign: false,
    checks: false,
    metals: false,
    transfers: false,
    official: false
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
    triggerHaptic(10);
  };
  const [chartRange, setChartRange] = useState<'24h' | '7d' | 'all'>('7d');
  const [defaultMarket, setDefaultMarket] = useState<'parallel' | 'official'>(() => {
    const saved = localStorage.getItem('defaultMarket');
    return (saved as 'parallel' | 'official') || 'parallel';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('animationsEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [showPostInstall, setShowPostInstall] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(0.001);
  
  // New premium settings states to activate and enhance everything
  const [majorChangesOnly, setMajorChangesOnly] = useState(() => {
    const saved = localStorage.getItem('majorChangesOnly');
    return saved !== null ? saved === 'true' : false;
  });
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(() => {
    const saved = localStorage.getItem('dailySummaryEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [goldNotificationsEnabled, setGoldNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('goldNotificationsEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [fontSizePreference, setFontSizePreference] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('fontSizePreference') as 'small' | 'medium' | 'large') || 'medium';
  });
  const [chartResolution, setChartResolution] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('chartResolution') as 'low' | 'medium' | 'high') || 'medium';
  });
  const [spreadAlertEnabled, setSpreadAlertEnabled] = useState(() => {
    const saved = localStorage.getItem('spreadAlertEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  const [spreadAlertValue, setSpreadAlertValue] = useState(() => {
    const saved = localStorage.getItem('spreadAlertValue');
    return saved !== null ? parseFloat(saved) : 1.5;
  });

  const [toasts, setToasts] = useState<{ id: string, title: string, body: string, type: 'up' | 'down' | 'info' }[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [appStatus, setAppStatus] = useState<{ 
    status: string, 
    minutesSinceLastScrape: number,
    minutesSinceLastChange?: number,
    lastUpdated?: string
  } | null>(null);
  const [configTerms, setConfigTerms] = useState<any[]>([]);
  const [runTour, setRunTour] = useState(false);

  // Pull to Refresh Logic
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 80], [0, 1]);
  const pullScale = useTransform(pullY, [0, 80], [0.5, 1]);
  const pullRotate = useTransform(pullY, [0, 80], [0, 360]);

  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      pullY.set(Math.min(diff * 0.5, 100)); // Add resistance
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (pullY.get() > 80) {
      triggerHaptic(20);
      fetchData(true);
    }
    animate(pullY, 0, { type: "spring", stiffness: 300, damping: 20 });
  };

  const [tourSteps] = useState<Step[]>([
    {
      target: 'body',
      title: 'مرحباً بك في منصة المؤشر!',
      content: 'أهلاً بك في منصة المؤشر لأسعار الصرف. دليلك الشامل لمتابعة أسعار العملات في ليبيا لحظة بلحظة. دعنا نأخذك في جولة سريعة للتعرف على أهم الميزات.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#main-rates-grid',
      title: 'أسعار السوق الموازي',
      content: 'هنا يمكنك متابعة أحدث أسعار العملات الأجنبية في السوق الموازي، مع مؤشرات توضح اتجاه السعر (ارتفاع أو انخفاض) مقارنة بآخر تحديث.',
      placement: 'bottom',
    },
    {
      target: '#checks-grid',
      title: 'أسعار الصكوك',
      content: 'في هذا القسم، نعرض لك أسعار الدولار مقابل صكوك المصارف التجارية المختلفة (مثل التجارة والتنمية، الوحدة، الجمهورية).',
      placement: 'bottom',
    },
    {
      target: '#transfers-grid',
      title: 'حوالات العملة (خارج ليبيا)',
      content: 'هنا تجد أسعار حوالات العملة إلى أهم الوجهات التجارية (مثل تركيا، دبي، والصين) لتسهيل متابعة تكاليف الاستيراد.',
      placement: 'bottom',
    },
    {
      target: '#metals-grid',
      title: 'أسعار الذهب والمعادن الثمينة',
      content: 'قسم مخصص يعرض أسعار الذهب والفضة (كسر، مسبوك، ليرات) بالدينار الليبي بحديث لحظي يواكب البورصة والأسواق المحلية.',
      placement: 'top',
    },
    {
      target: '#official-rates-grid',
      title: 'أسعار السوق الرسمي',
      content: 'يعرض هذا القسم أسعار الصرف الرسمية المعتمدة من مصرف ليبيا المركزي للعملات الرئيسية، ويتم تحديثها تلقائياً.',
      placement: 'top',
    },
    {
      target: '#historical-chart',
      title: 'الرسم البياني للتغيرات',
      content: 'رسم بياني تفاعلي يعرض مسار تغير سعر الدولار في السوق الموازي خلال الفترة الماضية ليعطيك نظرة عامة سريعة على اتجاه السوق.',
      placement: 'bottom',
    },
    {
      target: '#currency-converter-section',
      title: 'محول العملات الذكي',
      content: 'أداة قوية لحساب القيم بين الدينار الليبي والعملات الأخرى. تعرض لك النتيجة في السوق الموازي والسعر الرسمي في نفس الوقت للمقارنة.',
      placement: 'top',
    },
    {
      target: '#converter-input',
      title: 'إدخال المبلغ والتبديل',
      content: 'أدخل المبلغ هنا، واختر العملة. يمكنك استخدام زر التبديل (الأسهم) لعكس عملية التحويل بين العملة الأجنبية والدينار الليبي بسهولة.',
      placement: 'top',
    },
    {
      target: '#mobile-bottom-nav',
      title: 'شريط التنقل السريع للهواتف',
      content: 'على الهواتف، يتيح لك هذا الشريط السفلي التنقل الفوري والمرن بين أسعار العملات، الذهب، الحاسبة، والرسوم الإحصائية بضغطة زر.',
      placement: 'top',
    },
    {
      target: '#more-menu-btn',
      title: 'خيارات إضافية',
      content: 'من هنا يمكنك مشاركة التطبيق مع الآخرين، تحميل تقرير PDF احترافي للأسعار الحالية، أو تخصيص إعدادات التنبيهات الذكية.',
      placement: 'bottom',
    }
  ]);

  const CustomTooltip = ({
    continuous,
    index,
    step,
    size,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    isLastStep,
  }: TooltipRenderProps) => {
    const isFirstStep = index === 0;
    
    return (
      <div 
        {...tooltipProps} 
        className="relative glass-panel-heavy premium-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[360px] max-w-[92vw] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden" 
        dir="rtl"
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

        {/* Header */}
        <div className="flex items-start justify-between mb-3 sm:mb-4 relative z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <span className="text-emerald-400 font-black text-base sm:text-lg">{index + 1}</span>
            </div>
            <h3 className="text-white font-black text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-white to-zinc-400">
              {step.title}
            </h3>
          </div>
          
          <button 
            {...closeProps} 
            className="text-slate-500 hover:text-white hover:bg-white/10 transition-all p-1 sm:p-1.5 rounded-full shrink-0 group -mr-1"
            onClick={(e) => {
              if (closeProps.onClick) closeProps.onClick(e);
              setRunTour(false);
              localStorage.setItem('tourCompleted', 'true');
            }}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="text-slate-400 text-sm leading-relaxed mb-6 sm:mb-8 font-medium relative z-10 px-1 sm:px-2">
          {step.content}
        </div>

        {/* Progress & Actions */}
        <div className="flex flex-col gap-4 relative z-10">
          {/* Custom Progress Bar */}
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-l from-emerald-500 to-blue-500 rounded-full transition-all duration-500 relative"
              style={{ width: `${((index + 1) / size) * 100}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-row items-center justify-between mt-1 sm:mt-2">
            <div className="flex items-center gap-1 sm:gap-2">
              {!isFirstStep && (
                <button {...backProps} className="px-2 sm:px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/5 rounded-lg sm:rounded-xl transition-all uppercase tracking-widest">
                  السابق
                </button>
              )}
              {isFirstStep && (
                <button {...skipProps} className="px-2 sm:px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/5 rounded-lg sm:rounded-xl transition-all uppercase tracking-widest">
                  تخطي
                </button>
              )}
            </div>
            
            <button 
              {...primaryProps} 
              className="group px-4 sm:px-6 py-2 sm:py-2.5 text-xs font-black bg-gradient-to-l from-emerald-500 to-emerald-400 text-[#050505] rounded-lg sm:rounded-xl hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] active:scale-95 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2"
            >
              {isLastStep ? 'إنهاء' : 'التالي'}
              {!isLastStep && <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 -scale-x-100 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status) || action === 'close') {
      setRunTour(false);
      localStorage.setItem('tourCompleted', 'true');
    }
  };

  useEffect(() => {
    const tourCompleted = localStorage.getItem('tourCompleted');
    if (!tourCompleted) {
      // Small delay to ensure DOM is ready
      setTimeout(() => setRunTour(true), 1500);
    }

    // Listen for PWA installation
    const handleAppInstalled = () => {
      console.log('App was installed');
      setShowPostInstall(true);
      // Auto hide after 15 seconds if not interacted with
      setTimeout(() => setShowPostInstall(false), 15000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  const reportRef = useRef<HTMLDivElement>(null);
  const ratesRef = useRef<Rates | null>(null);
  const thresholdRef = useRef<number>(0.001);
  const lastNotifiedRef = useRef<Record<string, number>>({});
  const configTermsRef = useRef<any[]>([]);

  // Derive dynamic currencies from configTerms to support user-added currencies
  const dynamicCurrencies = useMemo(() => {
    if (configTerms.length === 0) return CURRENCIES;
    return configTerms
      .filter(t => t.id !== "OFFICIAL_USD" && !t.id.startsWith("USD_") && !METAL_IDS.includes(t.id))
      .map(t => ({ code: t.id, name: t.name, flag: t.flag }));
  }, [configTerms]);

  // Keep refs in sync with state to avoid closure issues in setInterval
  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);

  useEffect(() => {
    configTermsRef.current = configTerms;
  }, [configTerms]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/config?t=${Date.now()}`);
      if (!response.ok) return;
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;
      const data = await response.json();
      if (data && data.terms) {
        setConfigTerms(data.terms);
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
      logErrorToServer(error, "App.tsx: fetchConfig");
    }
  };

  useEffect(() => {
    fetchConfig().catch(() => {});
  }, []);

  useEffect(() => {
    thresholdRef.current = notificationThreshold;
  }, [notificationThreshold]);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playNotificationSound = (type: 'up' | 'down') => {
    if (!soundEnabledRef.current) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'up') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.15); // A3
      }
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  };

  const addToast = (title: string, body: string, type: 'up' | 'down' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const showPriceNotification = async (code: string, name: string, oldPrice: number, newPrice: number) => {
    const diff = newPrice - oldPrice;
    const absDiff = Math.abs(diff);
    
    // 1. تحقق من حد التغيير (Threshold)
    if (absDiff < thresholdRef.current) return;

    // 2. منع التكرار الذكي: تحقق من آخر سعر تم التنبيه به وآخر وقت
    try {
      const lastNotifyData = localStorage.getItem(`last_notify_${code}`);
      if (lastNotifyData) {
        const { price, time } = JSON.parse(lastNotifyData);
        const timeDiff = Date.now() - time;
        
        // إذا كان السعر هو نفسه ولم يمر 10 دقائق، لا تكرر الإشعار
        if (price === newPrice && timeDiff < 10 * 60 * 1000) {
          console.log(`[Notification] Skipping duplicate for ${code}`);
          return;
        }
      }
    } catch (e) {
      console.warn("Notification storage check failed", e);
    }

    const direction = diff > 0 ? 'ارتفاع' : 'انخفاض';
    const arrow = diff > 0 ? '📈' : '📉';
    const title = `${arrow} ${direction} في سعر ${name}`;
    const body = `السعر الجديد: ${newPrice.toFixed(2)} د.ل (تغير بمقدار ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`;

    // تسجيل التنبيه الحالي لمنع التكرار
    try {
      localStorage.setItem(`last_notify_${code}`, JSON.stringify({
        price: newPrice,
        time: Date.now()
      }));
    } catch (e) {
      console.warn("Failed to save notification state to localStorage", e);
    }

    // In-app toast (دائماً يظهر للمستخدم النشط)
    addToast(title, body, diff > 0 ? 'up' : 'down');
    playNotificationSound(diff > 0 ? 'up' : 'down');

    // Native notification
    try {
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: 'https://flagcdn.com/w80/ly.png',
            badge: 'https://flagcdn.com/w80/ly.png',
            vibrate: [200, 100, 200],
            tag: `price-change-${code}`, // استخدام Tag لمنع تراكم الإشعارات لنفس العملة
            renotify: true,
            data: { url: 'https://dollar-price-qp14.onrender.com/' },
            silent: false,
            dir: 'rtl',
            actions: [
              { action: 'open', title: 'فتح التطبيق' }
            ]
          } as any);
        }
      }
    } catch (err) {
      console.error("Failed to show notification:", err);
      logErrorToServer(err, "App.tsx: showNotification");
    }
  };

  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedOfficialCurrencies, setSelectedOfficialCurrencies] = useState<string[]>([]);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [pdfCategoryTab, setPdfCategoryTab] = useState<'all' | 'parallel' | 'metals' | 'official'>('all');

  // Comprehensive official currency list
  const officialCurrencyList = useMemo(() => {
    const list = [...CURRENCIES];
    dynamicCurrencies.forEach(dc => {
      if (!list.some(item => item.code === dc.code)) {
        list.push({ code: dc.code, name: dc.name, flag: dc.flag });
      }
    });
    return list;
  }, [dynamicCurrencies]);

  // Handle opening PDF customization modal with smart initial selection
  const handleOpenPdfModal = () => {
    triggerHaptic(15);
    setShowMoreMenu(false);
    
    // If no prior selection exists, initialize with active parallel currencies and metals
    // Official market is NOT added automatically per user request, but can be freely added!
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
      // Force a fresh data fetch from server before printing to ensure latest database values
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

  const requestNotificationPermission = async () => {
    try {
      if (!("Notification" in window)) {
        addToast("غير مدعوم", "متصفحك لا يدعم الإشعارات", "info");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        addToast("تم تفعيل التنبيهات", "ستصلك إشعارات عند تغير الأسعار الهامة", "info");
      } else {
        addToast("تم رفض التنبيهات", "يرجى تفعيل الإشعارات من إعدادات المتصفح", "info");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      logErrorToServer(error, "App.tsx: requestNotificationPermission");
      addToast("خطأ", "تعذر تفعيل الإشعارات", "info");
    }
  };

  useEffect(() => {
    let socket: any = null;

    const connect = () => {
      try {
        let deviceId = localStorage.getItem('__deviceId');
        if (!deviceId) {
          deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('__deviceId', deviceId);
        }
        socket = io('/', {
          query: { deviceId },
          transports: ['polling', 'websocket'],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          timeout: 15000
        });

        socket.on('online_count', (data: any) => {
          setOnlineCount(data.count);
        });

        socket.on('rates_update', (data: any) => {
          const decodedRates = decodeData(data.rates);
          if (decodedRates) {
            setRates(decodedRates);
          }
        });

        socket.on('connect_error', (err: any) => {
          console.warn('Socket.io connection notice (polling fallback active):', err?.message || err);
        });
      } catch (err) {
        console.warn('Socket.io initialization notice:', err);
      }
    };

    connect();

    // Fallback polling for online count
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/stats/active');
        if (res.ok) {
          const data = await res.json();
          setOnlineCount(data.count);
        }
      } catch (err) {
        // Silently ignore polling network errors (e.g. adblockers or offline)
        console.debug("Polling active users failed", err);
      }
    }, 30000);

    return () => {
      if (socket) {
        socket.disconnect();
      }
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Load from local storage on mount
    try {
      const savedRates = localStorage.getItem('lyd_rates');
      const savedHistory = localStorage.getItem('lyd_history');
      if (savedRates) setRates(JSON.parse(savedRates));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (err) {
      console.warn("LocalStorage not available:", err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchData = async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      if (forceRefresh) {
        await fetchConfig();
      }
      const [ratesResult, historyResult] = await Promise.allSettled([
        fetch(forceRefresh ? "/api/rates?refresh=true" : "/api/rates", { signal: AbortSignal.timeout(30000) }),
        fetch("/api/history", { signal: AbortSignal.timeout(30000) }),
      ]);
      
      if (ratesResult.status === 'rejected') {
        throw ratesResult.reason;
      }
      if (historyResult.status === 'rejected') {
        throw historyResult.reason;
      }

      const ratesRes = ratesResult.value;
      const historyRes = historyResult.value;

      if (!ratesRes.ok || !historyRes.ok) {
        if (ratesRes.status === 502 || historyRes.status === 502) return;
        throw new Error("Network response was not ok");
      }

      const ratesContentType = ratesRes.headers.get("content-type");
      const historyContentType = historyRes.headers.get("content-type");

      if (!ratesContentType?.includes("application/json") || !historyContentType?.includes("application/json")) {
        return;
      }

      const ratesJson = await ratesRes.json();
      const historyJson = await historyRes.json();
      
      const newRates: Rates | null = typeof ratesJson === 'string' ? decodeData(ratesJson) : ratesJson;
      const newHistory = typeof historyJson === 'string' ? decodeData(historyJson) : historyJson;
      
      if (!newRates || !newHistory) {
        console.error("Failed to decode rates or history");
        setIsRefreshing(false);
        return;
      }
      
      // Check for price changes to notify using the ref to get the latest state
      let hasChanges = false;
      const currentRates = ratesRef.current;
      
      if (currentRates) {
        // Only notify if the change is significant and the new date is newer than what we have
        const isNewer = new Date(newRates.lastUpdated).getTime() > new Date(currentRates.lastUpdated).getTime();
        
        if (isNewer) {
          // Check all parallel currencies
          const currenciesToCheck = Object.keys(newRates.parallel);
          const changes: { code: string; name: string; oldPrice: number; newPrice: number; priority: number }[] = [];
          
          // Define priority currencies (USD, USD_JBANK, USD_CHECKS, EUR, GOLD)
          const priorityIds = ["USD", "USD_JBANK", "USD_CHECKS", "EUR", "GOLD"];
          
          currenciesToCheck.forEach(code => {
            const oldPrice = currentRates.parallel[code];
            const newPrice = newRates.parallel[code];
            
            // Significant change threshold (0.001 Dinar)
            if (oldPrice && newPrice && Math.abs(oldPrice - newPrice) >= thresholdRef.current) {
              // Avoid notifying the same price twice if it hasn't changed since last notify
              if (lastNotifiedRef.current[code] !== newPrice) {
                const term = configTermsRef.current.find(t => t.id === code);
                const name = term ? term.name : code;
                const priority = priorityIds.indexOf(code);
                
                changes.push({ 
                  code, 
                  name, 
                  oldPrice, 
                  newPrice, 
                  priority: priority === -1 ? 999 : priority 
                });
                lastNotifiedRef.current[code] = newPrice;
              }
            }
          });

          if (changes.length > 0) {
            hasChanges = true;
            // Sort by priority (lower number first)
            changes.sort((a, b) => a.priority - b.priority);
            
            // Show up to 3 individual notifications for the most important changes
            const maxIndividual = 3;
            const toNotify = changes.slice(0, maxIndividual);
            const remainingCount = changes.length - maxIndividual;
            
            for (const change of toNotify) {
              showPriceNotification(change.code, change.name, change.oldPrice, change.newPrice).catch(err => {
                console.error("Error showing notification:", err);
              });
            }
            
            // If there are more changes, show a summary notification
            if (remainingCount > 0) {
              const summaryTitle = "📊 تحديثات أسعار إضافية";
              const summaryBody = `بالإضافة للعملات الرئيسية، تم رصد تغيرات في أسعار ${remainingCount} عملات وأصناف أخرى في السوق.`;
              
              addToast(summaryTitle, summaryBody, "info");
              
              // Also show native notification for summary if possible
              try {
                if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
                  const registration = await navigator.serviceWorker.ready;
                  if (registration) {
                    await registration.showNotification(summaryTitle, {
                      body: summaryBody,
                      icon: 'https://flagcdn.com/w80/ly.png',
                      badge: 'https://flagcdn.com/w80/ly.png',
                      tag: 'price-change-summary',
                      renotify: true,
                      dir: 'rtl'
                    } as any);
                  }
                }
              } catch (err) {
                console.error("Failed to show summary notification:", err);
              }
            }
          }
        }
      }

      setRates(newRates);
      setHistory(newHistory);
      // We use server-provided lastUpdated for business logic, but keep track of sync time
      setLastFetchTime(new Date());

      // Fetch status
      try {
        const statusRes = await fetch("/api/status");
        if (statusRes.ok) {
          const contentType = statusRes.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const statusData = await statusRes.json();
            setAppStatus(statusData);
          }
        }
      } catch (err) {
        logErrorToServer(err, "App.tsx: fetchStatus");
      }

      // Persist to local storage
      try {
        localStorage.setItem('lyd_rates', JSON.stringify(newRates));
        localStorage.setItem('lyd_history', JSON.stringify(newHistory));
      } catch (err) {
        console.warn("Failed to save to localStorage:", err);
      }

      if (hasChanges) {
        addToast("تم تحديث الأسعار", "تم رصد تغييرات جديدة في السوق وتحديث البيانات", "info");
      }
    } catch (error) {
      const errName = error && typeof error === 'object' ? (error as any).name : '';
      const errMsg = error && typeof error === 'object' ? (error as any).message : '';
      
      if (error instanceof TypeError && errMsg === "Failed to fetch") {
        console.warn("Server might be restarting or network is down...");
      } else if (errName === 'AbortError' || errName === 'TimeoutError' || (typeof errMsg === 'string' && errMsg.includes('signal timed out'))) {
        console.warn("Fetch request timed out");
      } else {
        const isNetworkError = typeof errMsg === 'string' && errMsg.includes("Network response was not ok");
        
        if (!isNetworkError) {
          console.error("Failed to fetch data:", error);
          logErrorToServer(error, "App.tsx: fetchData");
        } else {
          console.warn("Fetch data failed: Network response was not ok");
        }
        
        // Only show toast if it was a manual refresh
        if (forceRefresh) {
          addToast("خطأ في التحديث", "تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً", "info");
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData().catch(() => {});
    // Polling removed in favor of Socket.io real-time updates
  }, []);

  const filteredHistory = useMemo(() => {
    if (!history.length) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    
    if (chartRange === '24h') {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (chartRange === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    if (!cutoff) return history;
    return history.filter(h => new Date(h.time) >= cutoff!);
  }, [history, chartRange]);

  const chartData = useMemo(() => {
    const targetRate = selectedRate || { code: 'USD', name: 'دولار أمريكي', market: 'parallel' as const };
    if (!filteredHistory.length) return [];
    
    const data = filteredHistory.map(h => {
      const rateObj = targetRate.market === 'parallel' ? h.ratesParallel : h.ratesOfficial;
      let value = 0;
      
      // Attempt to get value from JSONB object first
      if (rateObj && rateObj[targetRate.code] !== undefined && rateObj[targetRate.code] !== null) {
        value = Number(rateObj[targetRate.code]);
      } 
      
      // Fallback for main USD if not in JSONB
      if (value === 0 && targetRate.code === 'USD') {
        value = targetRate.market === 'parallel' ? h.usdParallel : h.usdOfficial;
      }
      
      return {
        time: h.time,
        value: value
      };
    }).filter(d => d.value > 0);

    // CRITICAL: Recharts needs data in ASCENDING order of time
    const sorted = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    // If only 1 data point, duplicate it so the chart can draw a line
    if (sorted.length === 1) {
      return [
        { ...sorted[0], time: new Date(new Date(sorted[0].time).getTime() - 60000).toISOString() },
        sorted[0]
      ];
    }
    
    return sorted;
  }, [selectedRate, filteredHistory]);

  const chartStats = useMemo(() => {
    if (!chartData.length) return { max: 0, min: 0, avg: 0, isUp: true, change: 0, changePercent: 0 };
    const values = chartData.map(d => d.value);
    const first = values[0];
    const last = values[values.length - 1];
    const isUp = last >= first;
    const change = last - first;
    const changePercent = first !== 0 ? (change / first) * 100 : 0;
    return {
      max: Math.max(...values),
      min: Math.min(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      isUp,
      change,
      changePercent
    };
  }, [chartData]);

  const advancedStats = useMemo(() => {
    const targetRate = selectedRate || { code: 'USD', name: 'دولار أمريكي', market: 'parallel' as const };
    if (!history.length) return { ma30: 0, support: 0, resistance: 0 };
    
    const now = new Date();
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const elements30d = history.filter(h => new Date(h.time) >= cutoff30d).map(h => {
      const rateObj = targetRate.market === 'parallel' ? h.ratesParallel : h.ratesOfficial;
      let value = 0;
      if (rateObj && rateObj[targetRate.code] !== undefined && rateObj[targetRate.code] !== null) {
        value = Number(rateObj[targetRate.code]);
      } 
      if (value === 0 && targetRate.code === 'USD') {
        value = targetRate.market === 'parallel' ? h.usdParallel : h.usdOfficial;
      }
      return value;
    }).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    
    if (elements30d.length === 0) return { ma30: 0, support: 0, resistance: 0 };
    
    const sum = elements30d.reduce((a, b) => a + b, 0);
    const avg = sum / elements30d.length;
    const support = Math.min(...elements30d);
    const resistance = Math.max(...elements30d);
    
    return {
      ma30: avg,
      support,
      resistance
    };
  }, [history, selectedRate]);

  // حساب التغير خلال 24 ساعة لجميع العملات
  const trends24h = useMemo(() => {
    if (!history.length || !rates) return {};
    
    // العثور على أقرب سجل منذ 24 ساعة
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const record24h = history.find(h => new Date(h.time) >= oneDayAgo) || history[0];
    if (!record24h) return {};

    const trends: Record<string, { parallel?: number, official?: number }> = {};

    // معالجة السوق الموازي
    Object.keys(rates.parallel).forEach(code => {
      const current = rates.parallel[code];
      const previous = record24h.ratesParallel?.[code] || (code === 'USD' ? record24h.usdParallel : null);
      if (current && previous) {
        trends[code] = { ...trends[code], parallel: ((current - previous) / previous) * 100 };
      }
    });

    // معالجة السوق الرسمي
    dynamicCurrencies.forEach(curr => {
      const current = rates.official[curr.code];
      const previous = record24h.ratesOfficial?.[curr.code] || (curr.code === 'USD' ? record24h.usdOfficial : null);
      if (current && previous) {
        trends[curr.code] = { ...trends[curr.code], official: ((current - previous) / previous) * 100 };
      }
    });

    return trends;
  }, [history, rates]);

  // الأسعار التي لم تتغير منذ أكثر من 7 أيام
  const staleCurrencies = useMemo(() => {
    const result = new Set<string>();
    if (!history.length || configTerms.length === 0) return result;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    configTerms.forEach(term => {
      if (term.id === "USD" || term.id === "OFFICIAL_USD") return;

      const termPoints = history.map(h => ({
        time: new Date(h.time),
        value: h.ratesParallel ? (h.ratesParallel[term.id] || 0) : 0
      })).filter(h => h.value > 0);
      
      if (termPoints.length === 0) {
        result.add(term.id);
        return;
      }
      
      termPoints.sort((a, b) => a.time.getTime() - b.time.getTime());
      
      const latestValue = termPoints[termPoints.length - 1].value;
      const latestTime = termPoints[termPoints.length - 1].time;
      
      if (latestTime.getTime() < sevenDaysAgo.getTime()) {
        result.add(term.id);
        return;
      }
      
      let lastDifferentTime = null;
      for (let i = termPoints.length - 2; i >= 0; i--) {
        if (termPoints[i].value !== latestValue) {
          lastDifferentTime = termPoints[i].time;
          break;
        }
      }
      
      if (!lastDifferentTime) {
         if (termPoints[0].time.getTime() < sevenDaysAgo.getTime()) {
             result.add(term.id);
         }
      } else {
         if (lastDifferentTime.getTime() < sevenDaysAgo.getTime()) {
             result.add(term.id);
         }
      }
    });

    return result;
  }, [history, configTerms]);

  const marketStatus = useMemo(() => {
    const usdTrend = trends24h['USD']?.parallel || 0;
    const absChange = Math.abs(usdTrend);
    
    if (absChange < 0.5) {
      return { 
        label: 'مستقر', 
        description: 'السوق يشهد استقراراً نسبياً',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: Minus
      };
    } else if (absChange <= 2) {
      return { 
        label: 'متذبذب', 
        description: 'تغيرات ملحوظة في أسعار الصرف',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: Activity
      };
    } else {
      return { 
        label: 'شديد التقلب', 
        description: 'تقلبات حادة في السوق اليوم',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        icon: TrendingUp
      };
    }
  }, [trends24h]);

  // منطق محول العملات الذكي
  const [convActiveField, setConvActiveField] = useState<'top' | 'parallel' | 'official'>('top');
  const [convInputValue, setConvInputValue] = useState<string>('100');
  const [convCurrency, setConvCurrency] = useState<string>('USD');

  const detectCurrency = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('$') || lower.includes('usd') || lower.includes('دولار')) return 'USD';
    if (lower.includes('€') || lower.includes('eur') || lower.includes('يورو')) return 'EUR';
    if (lower.includes('£') || lower.includes('gbp') || lower.includes('باوند') || lower.includes('استرليني')) return 'GBP';
    if (lower.includes('tnd') || lower.includes('تونسي')) return 'TND';
    if (lower.includes('egp') || lower.includes('جنيه') || lower.includes('مصر')) return 'EGP';
    if (lower.includes('try') || lower.includes('₺') || lower.includes('ليرة') || lower.includes('تركي')) return 'TRY';
    if (lower.includes('cad') || lower.includes('كندي')) return 'CAD';
    if (lower.includes('aed') || lower.includes('درهم') || lower.includes('اماراتي')) return 'AED';
    if (lower.includes('sar') || lower.includes('ريال') || lower.includes('سعودي')) return 'SAR';
    if (lower.includes('lyd') || lower.includes('د.ل') || lower.includes('دينار') || lower.includes('ليبي')) return 'LYD';
    return null;
  };

  const extractNumber = (text: string) => {
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const { topAmount, parallelAmount, officialAmount } = useMemo(() => {
    if (!rates) return { topAmount: 0, parallelAmount: 0, officialAmount: 0 };
    
    const parallelRate = rates.parallel[convCurrency] || 1;
    const officialRate = rates.official[convCurrency] || 1;
    
    let top = 0;
    let parallel = 0;
    let official = 0;
    
    const parsedInput = extractNumber(convInputValue);
    const detected = detectCurrency(convInputValue);

    if (convActiveField === 'top') {
      if (detected === 'LYD') {
        parallel = parsedInput;
        top = parallelRate ? parallel / parallelRate : 0;
        official = top * officialRate;
      } else {
        top = parsedInput;
        parallel = top * parallelRate;
        official = top * officialRate;
      }
    } else if (convActiveField === 'parallel') {
      parallel = parsedInput;
      top = parallelRate ? parallel / parallelRate : 0;
      official = top * officialRate;
    } else if (convActiveField === 'official') {
      official = parsedInput;
      top = officialRate ? official / officialRate : 0;
      parallel = top * parallelRate;
    }
    
    return { topAmount: top, parallelAmount: parallel, officialAmount: official };
  }, [convActiveField, convInputValue, convCurrency, rates]);

  const usdRate = rates?.parallel["USD"] || 0;
  const usdFlash = usePriceFlash(usdRate);
  const prevUsdRate = rates?.previousParallel?.["USD"] || usdRate;
  const usdIsUp = usdRate > prevUsdRate;
  const usdIsDown = usdRate < prevUsdRate;
  const usdChange = Math.abs(usdRate - prevUsdRate);

  const LastChangedBadge = ({ date, className = "" }: { date?: string, className?: string }) => {
    if (!date) return null;
    try {
      return (
        <span className={`text-[11px] font-medium text-zinc-500 flex items-center gap-1 ${className}`}>
          <Clock className="w-2.5 h-2.5 opacity-50" />
          {formatDistanceToNow(new Date(date), { addSuffix: true, locale: ar })}
        </span>
      );
    } catch (e) {
      return null;
    }
  };

  const usdChecksRate = rates?.parallel["USD_JBANK"] || rates?.parallel["USD_NCB"] || rates?.parallel["USD_CHECKS"] || 0;
  const prevUsdChecksRate = rates?.previousParallel?.["USD_JBANK"] || rates?.previousParallel?.["USD_NCB"] || rates?.previousParallel?.["USD_CHECKS"] || usdChecksRate;
  const usdChecksIsUp = usdChecksRate > prevUsdChecksRate;
  const usdChecksIsDown = usdChecksRate < prevUsdChecksRate;

  const PdfFlagIcon = ({ flagCode, size = 24 }: { flagCode?: string, size?: number }) => {
    const code = flagCode?.trim().toLowerCase();
    
    if (code === 'gold') {
      return (
        <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#fef08a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eab308', flexShrink: 0, fontSize: `${size * 0.6}px` }}>
          ✨
        </div>
      );
    }
    
    if (code === 'silver') {
      return (
        <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #94a3b8', flexShrink: 0, fontSize: `${size * 0.6}px` }}>
          🪙
        </div>
      );
    }

    if (!code || code === "undefined" || code === "null") {
      return (
        <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', flexShrink: 0 }}>
          <Coins size={size * 0.6} color="#94a3b8" />
        </div>
      );
    }
    
    let objectPosition = "center";
    if (["ae", "us", "jo", "ps", "dz", "kw", "om", "qa"].includes(code)) {
      objectPosition = "left center";
    }

    return (
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
        <img 
          src={`https://flagcdn.com/w160/${code}.png`} 
          alt="flag"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, transform: 'scale(1.05)' }}
          crossOrigin="anonymous"
        />
      </div>
    );
  };


  const [isGeneratingShareImage, setIsGeneratingShareImage] = useState(false);
  const [shareData, setShareData] = useState<any>(null);

  const handleShareCardImage = async (code: string, name: string, price: number, isGold = false) => {
    setIsGeneratingShareImage(true);
    triggerHaptic(10);
    try {
      // Calculate stats for the last 24h
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const values = history
        .filter(h => new Date(h.time) >= cutoff)
        .map(h => {
          if (isGold) return h.ratesParallel?.[code] || h.rates?.gold?.karat18 || 0;
          if (code === 'USD_CASH') return h.usdParallel || h.ratesParallel?.USD || 0;
          if (code === 'USD_CHECKS') return h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
          return h.ratesParallel?.[code] || 0;
        })
        .filter(v => v > 0);

      const max = values.length > 0 ? Math.max(...values) : price;
      const min = values.length > 0 ? Math.min(...values) : price;
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : price;
      const trend = price >= (values[0] || price) ? 'up' : 'down';

      setShareData({ code, name, price, max, min, avg, trend, isGold });

      // Wait a tick for the hidden component to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const node = document.getElementById('share-card-node');
      if (node) {
        const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 3, quality: 1 });
        
        // Try web share first
        if (navigator.share) {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], 'share.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'مؤشر الدينار',
              text: `سعر ${name} الآن: ${price.toFixed(2)} د.ل`,
              files: [file]
            });
            setIsGeneratingShareImage(false);
            setShareData(null);
            return;
          }
        }
        
        // Fallback to download
        const link = document.createElement('a');
        link.download = `dinar-index-${code}.png`;
        link.href = dataUrl;
        link.click();
        addToast('تم الحفظ', 'تم حفظ صورة السعر بنجاح', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('خطأ', 'فشل إنشاء الصورة للمشاركة', 'down');
    }
    setIsGeneratingShareImage(false);
    setShareData(null);
  };

  return (
    <MotionConfig transition={animationsEnabled ? undefined : { duration: 0 }}>
      <div className={`min-h-screen bg-transparent text-white font-sans selection:bg-emerald-500/20 relative overflow-hidden transition-all duration-300 ${
        fontSizePreference === 'small' ? 'text-xs' : fontSizePreference === 'large' ? 'text-base' : 'text-sm'
      }`} dir="rtl">
        {/* Ambient Background Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />

        <InstallPrompt />
        <PushNotificationPrompt />
        {/* No more Splash Screen - Skeletons show the structure immediately */}

      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        callback={handleJoyrideCallback}
        tooltipComponent={CustomTooltip}
        spotlightPadding={12}
        scrollOffset={100}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
            },
            arrow: {
              length: 8,
              spread: 16,
            }
          }
        }}
        styles={{
          options: {
            zIndex: 1000,
            overlayColor: 'rgba(0, 0, 0, 0.75)',
            arrowColor: '#121212',
          }
        }}
      />
      {/* Atmospheric Backgrounds */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Telegram Floating Action Button */}
      <motion.a
        href="https://t.me/libya_index_dollar"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1 }}
        whileHover={{ scale: 1.1, y: -4 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed left-6 z-[999] md:flex hidden items-center justify-center w-14 h-14 bg-[#24A1DE] text-white rounded-full shadow-[0_8px_30px_rgb(36,161,222,0.4)] hover:shadow-[0_8px_40px_rgb(36,161,222,0.6)] border border-slate-700/50 group overflow-hidden transition-all duration-500 ${isInstallPromptVisible ? 'bottom-56 md:bottom-52' : 'bottom-48 md:bottom-24'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_100%)]"></div>
        <Send className="w-6 h-6 relative z-10 mr-1 -mt-0.5 group-hover:scale-110 transition-transform duration-300" />
      </motion.a>

      {/* Facebook Floating Action Button */}
      <motion.a
        href="https://www.facebook.com/profile.php?id=61593953519936"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.1 }}
        whileHover={{ scale: 1.1, y: -4 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed left-6 z-[999] md:flex hidden items-center justify-center w-14 h-14 bg-[#1877F2] text-white rounded-full shadow-[0_8px_30px_rgb(24,119,242,0.4)] hover:shadow-[0_8px_40px_rgb(24,119,242,0.6)] border border-slate-700/50 group overflow-hidden transition-all duration-500 ${isInstallPromptVisible ? 'bottom-36 md:bottom-32' : 'bottom-28 md:bottom-6'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_100%)]"></div>
        <Facebook className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform duration-300" />
      </motion.a>

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


      {/* iOS Install Prompt */}
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
                  localStorage.setItem('iosPromptDismissed', 'true');
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

      {/* Post-Install Welcome */}
      <AnimatePresence>
        {showPostInstall && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <div className="glass-panel premium-border p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-gradient tracking-tight mb-3">تم التثبيت بنجاح!</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                شكراً لتثبيت تطبيق مؤشر الدينار. يمكنك الآن متابعة الأسعار مباشرة من شاشتك الرئيسية في أي وقت.
              </p>
              <button
                onClick={() => setShowPostInstall(false)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl transition-all"
              >
                ابدأ الاستخدام
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Offline Indicator */}
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

      {/* Scroll to Top Button */}
      <ScrollToTop triggerHaptic={triggerHaptic} />

      {/* Pull to Refresh Indicator */}
      <motion.div
        style={{ y: pullY }}
        className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
      >
        <motion.div
          style={{ 
            opacity: pullOpacity,
            scale: pullScale,
            rotate: pullRotate
          }}
          className="mt-4 w-10 h-10 rounded-full bg-emerald-500 text-black shadow-lg flex items-center justify-center"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </motion.div>
      </motion.div>

      {/* Header */}
      <header className="border-b border-slate-800/60 sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer overflow-hidden p-1"
              onClick={() => setCurrentPage('dashboard')}
              onDoubleClick={() => window.location.href = '/admin-panel-secure'}
              title="لوحة التحكم (انقر مرتين)"
            >
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div 
              className="flex flex-col cursor-pointer"
              onClick={() => setCurrentPage('dashboard')}
            >
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-white">المؤشر</h1>
              <p className="text-[11px] text-emerald-500/70 font-mono uppercase tracking-[0.2em] mt-0.5">Al-Moasher</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full border border-slate-800/60 bg-white/[0.02]">
              {isRefreshing ? (
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
              <span className="text-xs font-mono text-slate-400 tracking-wider uppercase hidden sm:block" dir="ltr">
                {isRefreshing ? "جاري التحديث..." : (lastFetchTime ? format(lastFetchTime, "HH:mm:ss") : "...")}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-white/10 hidden md:block mx-1"></div>

            <button 
              onClick={() => {
                triggerHaptic(10);
                setRunTour(true);
                localStorage.removeItem('tourCompleted');
              }}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/10 transition-all gap-1"
              title="الدليل الشامل"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">الدليل الشامل</span>
            </button>
            
            {showInstallBanner && !isStandalone && (
              <button 
                onClick={handleInstall}
                className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                title="تثبيت التطبيق"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline sm:mr-2">تثبيت</span>
              </button>
            )}
            
            <div className="h-4 w-[1px] bg-white/10 mx-0.5 sm:mx-1"></div>
            
            <button 
              onClick={() => {
                triggerHaptic(10);
                fetchData(true);
              }}
              className={`flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline sm:mr-2">تحديث</span>
            </button>

            <div className="relative" ref={moreMenuRef}>
              <button
                id="more-menu-btn"
                onClick={() => {
                  triggerHaptic(10);
                  setShowMoreMenu(!showMoreMenu);
                }}
                className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="المزيد"
              >
                <MoreVertical className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline sm:mr-2">المزيد</span>
              </button>

              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-48 rounded-2xl glass-panel border border-slate-700/50 shadow-xl overflow-hidden z-50"
                  >
                    <div className="py-1 flex flex-col">
                      <button
                        id="export-pdf-btn"
                        onClick={handleOpenPdfModal}
                        disabled={isGeneratingPDF}
                        className={`flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">{isGeneratingPDF ? 'جاري التحميل...' : 'طباعة PDF'}</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic(10);
                          setShowMoreMenu(false);
                          handleShare();
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right"
                      >
                        <Share2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium">مشاركة التطبيق</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic(10);
                          setShowMoreMenu(false);
                          setCurrentPage('api');
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right"
                      >
                        <Code2 className="w-4 h-4 text-purple-400" />
                        <span className="font-medium">بوابة المطورين</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic(10);
                          setShowMoreMenu(false);
                          setCurrentPage('about');
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right"
                      >
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">عن المنصة</span>
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic(10);
                          setShowMoreMenu(false);
                          setCurrentPage('contact');
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right"
                      >
                        <Mail className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium">اتصل بنا</span>
                      </button>

                      <div className="h-[1px] bg-white/10 my-1"></div>

                      <button
                        id="notification-settings-btn"
                        onClick={() => {
                          triggerHaptic(10);
                          setShowMoreMenu(false);
                          setShowSettingsModal(true);
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full text-right"
                      >
                        <Settings2 className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">الإعدادات</span>
                      </button>


                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {currentPage === 'api' ? (
          <motion.div key="api" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Developers onBack={() => setCurrentPage('dashboard')} /></motion.div>
        ) : currentPage === 'terms' ? (
          <motion.div key="terms" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Terms onBack={() => setCurrentPage('dashboard')} /></motion.div>
        ) : currentPage === 'privacy' ? (
          <motion.div key="privacy" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Privacy onBack={() => setCurrentPage('dashboard')} /></motion.div>
        ) : currentPage === 'contact' ? (
          <motion.div key="contact" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Contact onBack={() => setCurrentPage('dashboard')} /></motion.div>
        ) : currentPage === 'about' ? (
          <motion.div key="about" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><About onBack={() => setCurrentPage('dashboard')} /></motion.div>
        ) : (
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
            className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16 relative z-10 pb-24 md:pb-16"
          >

        {/* ===================== TAB: MAIN ===================== */}
        <div className={activeTab === 'main' ? 'space-y-16 sm:space-y-24' : 'hidden md:block md:space-y-16 md:space-y-24'}>

        {/* Market Status Alert */}
        <div className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border ${marketStatus.bg} ${marketStatus.border}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${marketStatus.bg} ${marketStatus.border}`}>
            <marketStatus.icon className={`w-4 h-4 ${marketStatus.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-xs sm:text-sm font-bold ${marketStatus.color}`}>حالة السوق: {marketStatus.label}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{marketStatus.description}</p>
          </div>
        </div>

        {/* Hero Section: Parallel USD */}
        <section className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 lg:gap-12">
          <div className="w-full lg:w-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0">
                <FlagIcon flagCode="us" name="US Flag" className="w-full h-full" />
              </div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-medium text-emerald-400 tracking-wide">السوق الموازي • دولار أمريكي</h2>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-black text-emerald-500 uppercase tracking-wider">Live</span>
                </div>
              </div>
            </div>
            
            <div 
              className="flex items-baseline gap-3 sm:gap-4 cursor-pointer group relative"
              onClick={() => setSelectedRate({ code: 'USD', name: 'دولار أمريكي (نقدي)', market: 'parallel' })}
            >
              {!rates ? (
                <div className="w-64 h-24 sm:h-32 lg:h-[140px] skeleton-pulse mb-2" />
              ) : (
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={usdRate}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className={`text-6xl sm:text-8xl lg:text-[140px] font-light tracking-tighter font-mono leading-none transition-colors relative z-10 ${
                      usdFlash === 'up' ? 'text-rose-400 font-bold drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]' : 
                      usdFlash === 'down' ? 'text-emerald-400 font-bold drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 
                      'text-white group-hover:text-emerald-400'
                    }`}
                  >
                    {usdRate.toFixed(2)}
                  </motion.span>
                </AnimatePresence>
              )}
              <span className="text-xl sm:text-3xl lg:text-4xl text-slate-500 font-light">د.ل</span>
              
              {rates && <LastChangedBadge date={rates?.lastChanged?.parallel["USD"]} className="absolute -bottom-6 right-0" />}

              {/* Subtle pulsing glow behind the price */}
              <motion.div 
                animate={{ 
                  opacity: [0.1, 0.2, 0.1],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute -inset-4 bg-emerald-500/5 blur-2xl rounded-full -z-0 pointer-events-none"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 sm:mt-8">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">السعر السابق</span>
                <span className="font-mono text-slate-300 text-base" dir="ltr">{prevUsdRate.toFixed(2)}</span>
              </div>
              {usdIsUp ? (
                <div className="flex items-center gap-1.5 text-rose-400 text-sm font-medium bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="font-mono" dir="ltr">+{usdChange.toFixed(2)}</span>
                </div>
              ) : usdIsDown ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <ArrowDownRight className="w-4 h-4" />
                  <span className="font-mono" dir="ltr">-{usdChange.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400 text-sm font-medium bg-zinc-500/10 px-2.5 py-1 rounded-full border border-zinc-500/20">
                  <span className="font-mono" dir="ltr">0.00</span>
                </div>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); handleShareCardImage('USD_CASH', 'دولار أمريكي', usdRate, false); }}
                className="mr-auto w-10 h-10 rounded-full bg-white/5 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                title="مشاركة الصورة"
              >
                {isGeneratingShareImage && shareData?.code === 'USD_CASH' ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            {/* USD Checks Card */}
            <div 
              onClick={() => setSelectedRate({ code: 'USD_CHECKS', name: 'دولار أمريكي (صكوك)', market: 'parallel' })}
              className="mt-8 flex items-center gap-4 sm:gap-6 bg-white/[0.02] border border-slate-800/60 rounded-2xl p-4 sm:p-5 w-full sm:w-fit hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <FlagIcon flagCode="us" name="دولار أمريكي (صكوك)" className="w-10 h-10" fallbackType="building" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-medium mb-1">دولار (صكوك)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-light text-white font-mono leading-none group-hover:text-emerald-400 transition-colors">{usdChecksRate.toFixed(2)}</span>
                    {usdChecksIsUp ? <ArrowUpRight className="w-4 h-4 text-rose-400" /> : usdChecksIsDown ? <ArrowDownRight className="w-4 h-4 text-emerald-400" /> : null}
                  </div>
                  <LastChangedBadge date={rates?.lastChanged?.parallel["USD_CHECKS"]} className="mt-1" />
                </div>
              </div>
              <div className="w-px h-12 bg-white/10 mx-2"></div>
              <div className="flex flex-col justify-center">
                <span className="text-xs text-zinc-500 mb-1">السعر السابق</span>
                <span className="text-sm text-slate-400 font-mono" dir="ltr">{prevUsdChecksRate.toFixed(2)}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleShareCardImage('USD_CHECKS', 'دولار أمريكي (صكوك)', usdChecksRate, false); }}
                className="mr-auto w-10 h-10 rounded-full bg-white/5 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all"
                title="مشاركة الصورة"
              >
                {isGeneratingShareImage && shareData?.code === 'USD_CHECKS' ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            {rates?.lastUpdated && (
              <div className="flex flex-wrap items-center gap-2 mt-6 text-xs text-slate-500 bg-white/5 w-fit px-3 py-1.5 rounded-full border border-slate-800/60">
                <Clock className="w-3.5 h-3.5 text-emerald-500/70" />
                <span>آخر تحديث: {formatDistanceToNow(new Date(rates.lastUpdated), { addSuffix: true, locale: ar })}</span>
                <div className="w-1 h-1 rounded-full bg-zinc-600 hidden sm:block"></div>
                <span className="font-mono text-xs hidden sm:block" dir="ltr">{format(new Date(rates.lastUpdated), "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
          </div>

          {/* Mini Sparkline Chart */}
          {showChart && (
            <div className="flex flex-col gap-3 mt-8 lg:mt-0 w-full lg:w-auto">
              <div className="flex items-center justify-start lg:justify-end gap-2 mb-1">
                {(['24h', '7d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setChartRange(range);
                      triggerHaptic(5);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all border ${
                      chartRange === range 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                        : 'bg-white/5 border-slate-800/60 text-slate-500 hover:bg-white/10'
                    }`}
                  >
                    {range === '24h' ? '24 ساعة' : range === '7d' ? '7 أيام' : 'الكل'}
                  </button>
                ))}
              </div>
              <div id="historical-chart" className="w-full lg:w-[400px] h-[140px] sm:h-[180px] min-w-0 min-h-0 opacity-80 hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={usdIsUp ? "#f43f5e" : "#10b981"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={usdIsUp ? "#f43f5e" : "#10b981"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[(dataMin: number) => dataMin - 0.02, (dataMax: number) => dataMax + 0.02]} hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#050505", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)" }}
                      itemStyle={{ color: usdIsUp ? "#f43f5e" : "#10b981", fontFamily: "monospace", fontSize: "16px" }}
                      labelStyle={{ color: "#71717a", fontSize: "12px", marginBottom: "4px" }}
                      labelFormatter={(label) => {
                        try {
                          return format(new Date(label), "dd MMM - HH:mm", { locale: ar });
                        } catch (e) {
                          return label;
                        }
                      }}
                      formatter={(value: number) => [value.toFixed(2) + ' د.ل', 'السعر']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={usdIsUp ? "#f43f5e" : "#10b981"}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorUsd)"
                      isAnimationActive={chartData.length < 200}
                      activeDot={{ r: 4, fill: "#050505", stroke: usdIsUp ? "#f43f5e" : "#10b981", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Advanced Stats Dashboard */}
              <div className="mt-4 grid grid-cols-3 gap-2 w-full lg:w-[400px]">
                <div className="bg-white/5 rounded-2xl p-3 text-center border border-slate-800/60 flex flex-col justify-center">
                  <p className="text-[11px] text-slate-400 font-medium mb-1">متوسط 30 يوم</p>
                  <p className="text-sm font-mono font-bold text-white">{advancedStats.ma30 > 0 ? advancedStats.ma30.toFixed(4) : '-'}</p>
                </div>
                <div className="bg-emerald-500/5 rounded-2xl p-3 text-center border border-emerald-500/10 flex flex-col justify-center">
                  <p className="text-[11px] text-slate-400 font-medium mb-1">مقاومة (أعلى سعر)</p>
                  <p className="text-sm font-mono font-bold text-emerald-400">{advancedStats.resistance > 0 ? advancedStats.resistance.toFixed(4) : '-'}</p>
                </div>
                <div className="bg-rose-500/5 rounded-2xl p-3 text-center border border-rose-500/10 flex flex-col justify-center">
                  <p className="text-[11px] text-slate-400 font-medium mb-1">دعم (أدنى سعر)</p>
                  <p className="text-sm font-mono font-bold text-rose-400">{advancedStats.support > 0 ? advancedStats.support.toFixed(4) : '-'}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Data Grid: Other Parallel Currencies (Foreign Currencies + Checks + Transfers, NO METALS) */}
        <section id="main-rates-grid" className="space-y-16">
          {/* 1. Foreign Currencies Group */}
          <div>
            <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('foreign')}>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:scale-105 transition-transform duration-300">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gradient tracking-wide">السوق الموازي</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">عملات أجنبية</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.foreign ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
              {(!rates || configTerms.length === 0) ? (
                Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
              ) : (
                configTerms.filter(t => t.id !== "USD" && t.id !== "OFFICIAL_USD" && !t.id.startsWith("USD_") && !METAL_IDS.includes(t.id) && !staleCurrencies.has(t.id))
                  .slice(0, expandedSections.foreign ? undefined : 5)
                  .map(term => {
                  const rate = rates?.parallel[term.id] || 0;
                  const prevRate = rates?.previousParallel?.[term.id] || rate;
                  const isUp = rate > prevRate;
                  const isDown = rate < prevRate;

                  return (
                    <RateCell
                      key={`parallel-${term.id}`}
                      term={term}
                      rate={rate}
                      prevRate={prevRate}
                      trend={trends24h[term.id]?.parallel}
                      lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                      onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                      onShare={(e) => { e.stopPropagation(); handleShareCardImage(term.id, term.name, rate, false); }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Bank Checks Group */}
          <div id="checks-grid">
            <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('checks')}>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-105 transition-transform duration-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gradient tracking-wide">صكوك المصارف</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">دولار أمريكي (USD)</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.checks ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
              {(!rates || configTerms.length === 0) ? (
                Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
              ) : (
                configTerms.filter(t => t.id.startsWith("USD_") && !["USD_AE", "USD_TR", "USD_CN"].includes(t.id) && !staleCurrencies.has(t.id))
                  .slice(0, expandedSections.checks ? undefined : 5)
                  .map(term => {
                  const rate = rates?.parallel[term.id] || 0;
                  const prevRate = rates?.previousParallel?.[term.id] || rate;
                  const isUp = rate > prevRate;
                  const isDown = rate < prevRate;

                  return (
                    <RateCell
                      key={`parallel-${term.id}`}
                      term={term}
                      rate={rate}
                      prevRate={prevRate}
                      trend={trends24h[term.id]?.parallel}
                      lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                      onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                      onShare={(e) => { e.stopPropagation(); handleShareCardImage(term.id, term.name, rate, false); }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Transfers Group */}
          <div id="transfers-grid">
            <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('transfers')}>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-105 transition-transform duration-300">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gradient tracking-wide">حوالات العملة</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">تحويلات خارج ليبيا</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.transfers ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
              {(!rates || configTerms.length === 0) ? (
                Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
              ) : (
                configTerms.filter(t => ["USD_AE", "USD_TR", "USD_CN"].includes(t.id) && !staleCurrencies.has(t.id))
                  .slice(0, expandedSections.transfers ? undefined : 5)
                  .map(term => {
                  const rate = rates?.parallel[term.id] || 0;
                  const prevRate = rates?.previousParallel?.[term.id] || rate;
                  const isUp = rate > prevRate;
                  const isDown = rate < prevRate;

                  return (
                    <RateCell
                      key={`parallel-${term.id}`}
                      term={term}
                      rate={rate}
                      prevRate={prevRate}
                      trend={trends24h[term.id]?.parallel}
                      lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                      fallbackType="send"
                      onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                    />
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Official Market Table */}
        <section id="official-rates-grid">
          <div className="flex items-center justify-between mb-6 cursor-pointer group" onClick={() => toggleSection('official')}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)] group-hover:scale-105 transition-transform duration-300">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gradient tracking-wide">السوق الرسمي</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">مصرف ليبيا المركزي</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedSections.official ? 'rotate-180' : ''}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-12">
            {(!rates || dynamicCurrencies.length === 0) ? (
              Array(6).fill(0).map((_, i) => <RateSkeleton key={i} />)
            ) : (
              dynamicCurrencies
                .slice(0, expandedSections.official ? undefined : 6)
                .map(currency => {
                const rate = rates?.official[currency.code] || 0;
                const prevRate = rates?.previousOfficial?.[currency.code] || rate;
                const isUp = rate > prevRate;
                const isDown = rate < prevRate;

                return (
                  <RateCell
                    key={`official-${currency.code}`}
                    term={{ id: currency.code, name: currency.code, flag: currency.flag }}
                    rate={rate}
                    prevRate={prevRate}
                    trend={trends24h[currency.code]?.official}
                    lastChangedDate={rates?.lastChanged?.official[currency.code]}
                    onClick={() => setSelectedRate({ code: currency.code, name: currency.name, market: 'official' })}
                  />
                );
              })
            )}
          </div>
        </section>
        </div> {/* END TAB: MAIN */}

        {/* ===================== TAB: GOLD ===================== */}
        <div className={activeTab === 'gold' ? 'block space-y-8 md:space-y-16' : 'hidden md:block md:space-y-16'}>
          {/* Mobile Gold Header */}
          <div className="flex items-center gap-4 mb-2 md:hidden">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">المعادن الثمينة</h2>
              <p className="text-xs text-slate-400 mt-0.5">أسعار الذهب والفضة لحظياً</p>
            </div>
          </div>

          <section id="metals-grid">
            <div className="flex items-center justify-between mb-6 group hidden md:flex">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gradient tracking-wide">المعادن الثمينة</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">أسعار الذهب والفضة</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
              {(!rates || configTerms.length === 0) ? (
                Array(5).fill(0).map((_, i) => <RateSkeleton key={i} />)
              ) : (
                configTerms.filter(t => METAL_IDS.includes(t.id) && !staleCurrencies.has(t.id))
                  .map(term => {
                  const rate = rates?.parallel[term.id] || 0;
                  const prevRate = rates?.previousParallel?.[term.id] || rate;
                  const isSilver = term.id.includes('SILVER');

                  return (
                    <RateCell
                      key={`parallel-${term.id}`}
                      term={term}
                      rate={rate}
                      prevRate={prevRate}
                      trend={trends24h[term.id]?.parallel}
                      lastChangedDate={rates?.lastChanged?.parallel[term.id]}
                      decimals={isSilver ? 2 : 0}
                      onClick={() => setSelectedRate({ code: term.id, name: term.name, market: 'parallel' })}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* ===================== TAB: CONVERTER ===================== */}
        {/* Improved Currency Converter - Bottom Section */}
        
        {/* التحليل والرسوم البيانية */}
        <section id="charts-section" className={`mt-16 ${activeTab === 'charts' ? '' : 'hidden md:block'}`}>
          <div className="mb-8">
            <h2 className="text-3xl font-black text-gradient tracking-tight tracking-tight flex items-center gap-3 mb-2">
              <LineChart className="w-8 h-8 text-fuchsia-500" />
              التحليل المتقدم
            </h2>
            <p className="text-slate-400">تابع اتجاهات السوق وحركة الأسعار زمنياً</p>
          </div>
          
          <div className=" glass-panel-heavy rounded-3xl premium-border  p-4 sm:p-6 shadow-2xl relative overflow-hidden">
            {/* الخلفية الزخرفية */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* العملة */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-slate-800/60 w-full sm:w-auto overflow-x-auto">
                  {['USD_CASH', 'USD_CHECKS', 'EUR', 'GOLD_SCRAP_18'].map(curr => (
                    <button
                      key={curr}
                      onClick={() => setChartAnalysisCurrency(curr)}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${chartAnalysisCurrency === curr ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {curr === 'USD_CASH' ? 'دولار كاش' : curr === 'USD_CHECKS' ? 'دولار شيك' : curr === 'EUR' ? 'يورو' : curr === 'GOLD_SCRAP_18' ? 'ذهب كسر 18' : curr}
                    </button>
                  ))}
                </div>
                
                {/* النطاق الزمني */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-slate-800/60 w-full sm:w-auto">
                  {[
                    { id: '1w', label: 'أسبوع' },
                    { id: '1m', label: 'شهر' },
                    { id: '6m', label: '6 أشهر' },
                    { id: '1y', label: 'سنة' },
                    { id: 'all', label: 'الكل' }
                  ].map(range => (
                    <button
                      key={range.id}
                      onClick={() => setChartAnalysisRange(range.id as any)}
                      className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold transition-all ${chartAnalysisRange === range.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* الرسم البياني */}
              <div className="w-full h-[300px] sm:h-[400px]">
                {history.length > 0 ? (() => {
                  // تحضير البيانات
                  const now = new Date();
                  let cutoff = new Date(0);
                  if (chartAnalysisRange === '1w') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  if (chartAnalysisRange === '1m') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  if (chartAnalysisRange === '6m') cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                  if (chartAnalysisRange === '1y') cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                  
                  const filteredData = history
                    .filter(h => new Date(h.time) >= cutoff)
                    .map(h => {
                      let val = 0;
                      if (chartAnalysisCurrency === 'USD_CASH') val = h.usdParallel || h.ratesParallel?.USD || 0;
                      if (chartAnalysisCurrency === 'USD_CHECKS') val = h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
                      if (chartAnalysisCurrency === 'EUR') val = h.ratesParallel?.EUR || 0;
                      if (chartAnalysisCurrency === 'GOLD_SCRAP_18') val = h.ratesParallel?.GOLD_SCRAP_18 || 0;
                      
                      return {
                        time: format(new Date(h.time), "yyyy-MM-dd HH:mm"),
                        rawTime: h.time,
                        value: val
                      };
                    })
                    .filter(d => d.value > 0);

                  if (filteredData.length < 2) {
                    return <div className="w-full h-full flex items-center justify-center text-slate-500">لا توجد بيانات كافية لهذه الفترة</div>;
                  }

                  const firstVal = filteredData[0].value;
                  const lastVal = filteredData[filteredData.length - 1].value;
                  const isUp = lastVal >= firstVal;
                  const color = isUp ? "#10b981" : "#f43f5e";

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAnalysis" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="time" 
                          hide={false} 
                          tick={{ fill: '#71717a', fontSize: 10 }}
                          tickFormatter={(tick) => tick.split(' ')[0]} // Show just date
                          minTickGap={30}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          hide={false}
                          orientation="right"
                          tick={{ fill: '#71717a', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#050505", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)" }}
                          itemStyle={{ color: color, fontFamily: "monospace", fontSize: "16px", fontWeight: "bold" }}
                          labelStyle={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "4px" }}
                          formatter={(val: number) => [`${val.toFixed(2)} د.ل`, chartAnalysisCurrency === 'GOLD' ? 'جرام كسر 18' : chartAnalysisCurrency]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke={color} 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorAnalysis)"
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })() : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
                  </div>
                )}
              </div>
              
              {/* ملخص الإحصائيات أسفل الرسم */}
              {history.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                  {[
                    { label: 'أعلى سعر', calc: (arr: number[]) => Math.max(...arr) },
                    { label: 'أقل سعر', calc: (arr: number[]) => Math.min(...arr) },
                    { label: 'متوسط السعر', calc: (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length },
                    { label: 'التغير', calc: (arr: number[]) => arr[arr.length-1] - arr[0] }
                  ].map((stat, i) => {
                    const now = new Date();
                    let cutoff = new Date(0);
                    if (chartAnalysisRange === '1w') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (chartAnalysisRange === '1m') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    if (chartAnalysisRange === '6m') cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                    if (chartAnalysisRange === '1y') cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    
                    const values = history
                      .filter(h => new Date(h.time) >= cutoff)
                      .map(h => {
                        if (chartAnalysisCurrency === 'USD_CASH') return h.usdParallel || h.ratesParallel?.USD || 0;
                        if (chartAnalysisCurrency === 'USD_CHECKS') return h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
                        if (chartAnalysisCurrency === 'EUR') return h.ratesParallel?.EUR || 0;
                        if (chartAnalysisCurrency === 'GOLD_SCRAP_18') return h.ratesParallel?.GOLD_SCRAP_18 || 0;
                        return 0;
                      }).filter(v => v > 0);
                      
                    const val = values.length > 0 ? stat.calc(values) : 0;
                    const isChange = i === 3;
                    const isPositive = val > 0;
                    
                    return (
                      <div key={i} className="bg-white/5 rounded-2xl p-3 border border-slate-800/60 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{stat.label}</span>
                        <span className={`font-mono font-bold ${isChange ? (isPositive ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
                          {isChange ? (isPositive ? '+' : '') : ''}{val.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>


        <section id="currency-converter-section" className={`mt-16 ${activeTab === 'converter' ? '' : 'hidden md:block'}`}>
          <div className="relative max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner ring-1 ring-blue-500/20">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">المحول الذكي</h3>
                <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-mono font-bold">Premium Exchange Calculator</p>
              </div>
            </div>

            <div className="relative flex flex-col gap-2 z-10">
              
              {/* TOP CARD: Foreign Currency */}
              <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-700/60 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden group focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <RefreshCw className="w-40 h-40 text-blue-400 rotate-12" />
                </div>
                
                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="w-full sm:w-1/3">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">
                      اختر العملة
                    </label>
                    <div className="relative">
                      <select 
                        value={convCurrency}
                        onChange={(e) => {
                          setConvCurrency(e.target.value);
                          if (convActiveField !== 'top') {
                            setConvActiveField('top');
                            setConvInputValue(topAmount.toString());
                          }
                        }}
                        className="w-full bg-[#1e293b]/80 border border-slate-600/50 rounded-2xl py-4 pl-4 pr-10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-[#1e293b] transition-colors"
                      >
                        {configTerms.filter(t => !METAL_IDS.includes(t.id) && t.id !== "OFFICIAL_USD").map(t => (
                          <option key={t.id} value={t.id} className="bg-[#0f172a]">{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex-1 w-full text-left" dir="ltr">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block text-right sm:text-left" dir="rtl">
                      المبلغ بالعملة الأجنبية
                    </label>
                    <motion.input 
                      whileFocus={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      type="text"
                      value={convActiveField === 'top' ? convInputValue : (topAmount ? (topAmount % 1 === 0 ? topAmount : topAmount.toFixed(2)) : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConvActiveField('top');
                        setConvInputValue(val);
                        const detected = detectCurrency(val);
                        if (detected && detected !== 'LYD') {
                          setConvCurrency(detected);
                        }
                      }}
                      className="w-full bg-transparent text-white font-mono text-5xl sm:text-6xl tracking-tighter font-light focus:outline-none appearance-none text-right sm:text-left placeholder-slate-700"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* FLOATING SWAP BUTTON */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.9, rotate: -180 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => {
                    triggerHaptic(10);
                    // Just visual swap effect and set focus to LYD
                    setConvActiveField('parallel');
                  }}
                  className="w-14 h-14 rounded-full bg-blue-600 border-4 border-[#09090b] shadow-[0_10px_30px_rgba(37,99,235,0.5)] flex items-center justify-center text-white outline-none focus:outline-none group"
                >
                  <ArrowUpDown className="w-6 h-6" />
                </motion.button>
              </div>

              {/* BOTTOM CARD: Local Currency (LYD) */}
              <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-700/60 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                <div className="absolute bottom-0 left-0 p-8 opacity-5">
                  <Coins className="w-40 h-40 text-emerald-400 -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-emerald-400/80 font-bold uppercase tracking-widest">
                      القيمة بالدينار الليبي (LYD)
                    </label>
                    <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                      العملة المحلية
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Parallel Market */}
                    <div className="bg-white/5 border border-slate-700/50 rounded-2xl p-4 focus-within:bg-emerald-500/10 focus-within:border-emerald-500/30 transition-colors">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">السوق الموازي</span>
                      <div className="flex items-center gap-2" dir="ltr">
                        <span className="text-emerald-400 font-bold">LYD</span>
                        <motion.input
                          whileFocus={{ scale: 1.05, x: 10 }}
                          type="number"
                          value={convActiveField === 'parallel' ? convInputValue : (parallelAmount ? (parallelAmount % 1 === 0 ? parallelAmount : parallelAmount.toFixed(2)) : '')}
                          onChange={(e) => {
                            setConvActiveField('parallel');
                            setConvInputValue(e.target.value);
                          }}
                          className="w-full bg-transparent text-3xl font-mono tracking-tighter text-white focus:outline-none appearance-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Official Market */}
                    <div className="bg-white/5 border border-slate-700/50 rounded-2xl p-4 focus-within:bg-indigo-500/10 focus-within:border-indigo-500/30 transition-colors">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">السعر الرسمي</span>
                      <div className="flex items-center gap-2" dir="ltr">
                        <span className="text-indigo-400 font-bold">LYD</span>
                        <motion.input
                          whileFocus={{ scale: 1.05, x: 10 }}
                          type="number"
                          value={convActiveField === 'official' ? convInputValue : (officialAmount ? (officialAmount % 1 === 0 ? officialAmount : officialAmount.toFixed(2)) : '')}
                          onChange={(e) => {
                            setConvActiveField('official');
                            setConvInputValue(e.target.value);
                          }}
                          className="w-full bg-transparent text-3xl font-mono tracking-tighter text-white focus:outline-none appearance-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* ===================== TAB: MORE (mobile only) ===================== */}
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
                  {Notification.permission !== 'granted' && (
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

        {/* Footer - Desktop only */}
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
          </motion.main>
        )}
      </AnimatePresence>


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
        <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-slate-700/50">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full" />
          </div>
          <span className="text-xs text-slate-500 font-medium">مؤشر الدينار &copy; {new Date().getFullYear()} - جميع الحقوق محفوظة</span>
        </div>
      </footer>

            {/* ====== BOTTOM NAVIGATION BAR (Mobile Only) ====== */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-[90] pb-safe pointer-events-none flex justify-center">
        <nav
          id="mobile-bottom-nav"
          dir="rtl"
          className="pointer-events-auto w-full max-w-[380px] bg-[#060913]/95 backdrop-blur-3xl border border-slate-700/60 rounded-full p-2 flex items-center justify-between shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-black/50"
        >
          {[
            { id: 'main', icon: Home, label: 'الرئيسية', color: 'emerald' },
            { id: 'gold', icon: Coins, label: 'الذهب', color: 'amber' },
            { id: 'converter', icon: Calculator, label: 'المحول', color: 'blue' },
            { id: 'charts', icon: LineChart, label: 'التحليل', color: 'fuchsia' },
            { id: 'more', icon: LayoutGrid, label: 'المزيد', color: 'indigo' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            
            const colorMap = {
              emerald: 'text-emerald-400',
              amber: 'text-amber-400',
              blue: 'text-blue-400',
              fuchsia: 'text-fuchsia-400',
              indigo: 'text-indigo-400',
            };
            
            const bgMap = {
              emerald: 'bg-emerald-500/15',
              amber: 'bg-amber-500/15',
              blue: 'bg-blue-500/15',
              fuchsia: 'bg-fuchsia-500/15',
              indigo: 'bg-indigo-500/15',
            };
            
            return (
              <button
                key={tab.id}
                onClick={() => { triggerHaptic(8); setActiveTab(tab.id as any); }}
                className={`relative flex items-center justify-center h-12 rounded-full transition-all duration-300 outline-none select-none ${
                  isActive 
                    ? `px-5 ${bgMap[tab.color as keyof typeof bgMap]} ${colorMap[tab.color as keyof typeof colorMap]} shadow-inner`
                    : 'w-12 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon strokeWidth={isActive ? 2.5 : 2} className={`${isActive ? 'w-5 h-5' : 'w-5 h-5'} transition-all duration-300`} />
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: 'auto', marginLeft: 4 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs font-bold tracking-wide overflow-hidden whitespace-nowrap"
                        style={{ fontFamily: 'Cairo, sans-serif' }}
                      >
                        {tab.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {/* Active Indicator Glow */}
                {isActive && (
                  <motion.div
                    layoutId="nav-glow"
                    className={`absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full ${bgMap[tab.color as keyof typeof bgMap].replace('/15', '/50')} blur-[2px]`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* In-App Toasts */}
      <div className="fixed bottom-28 md:bottom-6 left-6 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto  glass-panel-heavy premium-border /90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl flex items-start gap-4"
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
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Post-Installation Notification */}
      <AnimatePresence>
        {showPostInstall && (
          <PostInstallNotification onClose={() => setShowPostInstall(false)} />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md  glass-panel-heavy premium-border  border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-medium">الإعدادات</h3>
                </div>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800/60 overflow-x-auto custom-scrollbar">
                <button
                  onClick={() => setSettingsTab('general')}
                  className={`flex-none px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${settingsTab === 'general' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  عام
                </button>
                <button
                  onClick={() => setSettingsTab('notifications')}
                  className={`flex-none px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${settingsTab === 'notifications' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  التنبيهات
                </button>
                <button
                  onClick={() => setSettingsTab('appearance')}
                  className={`flex-none px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${settingsTab === 'appearance' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  المظهر
                </button>
                <button
                  onClick={() => setSettingsTab('advanced')}
                  className={`flex-none px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${settingsTab === 'advanced' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  متقدم
                </button>
              </div>

              <div className="p-6 space-y-8 min-h-[300px]">
                {settingsTab === 'general' && (
                  <div className="space-y-6">
                    {/* Haptic Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">الاهتزاز (Haptic Feedback)</p>
                        <p className="text-xs text-slate-500 mt-1">تفعيل أو تعطيل الاهتزاز عند التفاعل مع التطبيق</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !hapticEnabled;
                          setHapticEnabled(newVal);
                          localStorage.setItem('hapticEnabled', String(newVal));
                          if (newVal && window.navigator.vibrate) window.navigator.vibrate(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${hapticEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">المؤثرات الصوتية</p>
                        <p className="text-xs text-slate-500 mt-1">تفعيل أو تعطيل الأصوات عند تغير الأسعار</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !soundEnabled;
                          setSoundEnabled(newVal);
                          localStorage.setItem('soundEnabled', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${soundEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Auto Refresh Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">التحديث التلقائي</p>
                        <p className="text-xs text-slate-500 mt-1">تحديث الأسعار تلقائياً كل 10 ثوانٍ</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !autoRefreshEnabled;
                          setAutoRefreshEnabled(newVal);
                          localStorage.setItem('autoRefreshEnabled', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${autoRefreshEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Show Chart Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">المخطط البياني</p>
                        <p className="text-xs text-slate-500 mt-1">إظهار المخطط البياني المصغر في الشاشة الرئيسية</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !showChart;
                          setShowChart(newVal);
                          localStorage.setItem('showChart', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${showChart ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Clear Cache */}
                    <div className="pt-4 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          triggerHaptic(10);
                          localStorage.removeItem('lyd_rates');
                          localStorage.removeItem('lyd_history');
                          fetchData(true);
                          addToast('تم بنجاح', 'تم مسح الذاكرة المؤقتة وتحديث البيانات', 'info');
                        }}
                        className="w-full py-3 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                      >
                        مسح الذاكرة المؤقتة وتحديث البيانات
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === 'notifications' && (
                  <>
                    {/* Permission Status */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-slate-800/60">
                      <div className="flex items-center gap-3">
                        {notificationsEnabled ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">حالة التنبيهات</p>
                          <p className="text-xs text-slate-500">{notificationsEnabled ? 'مفعلة على هذا الجهاز' : 'غير مفعلة حالياً'}</p>
                        </div>
                      </div>
                      {!notificationsEnabled && (
                        <button 
                          onClick={requestNotificationPermission}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          تفعيل الآن
                        </button>
                      )}
                    </div>

                    {/* Threshold Slider */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">حساسية التنبيه (Threshold)</label>
                        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                          {notificationThreshold.toFixed(2)} د.ل
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0.001" 
                        max="0.1" 
                        step="0.001" 
                        value={notificationThreshold}
                        onChange={(e) => setNotificationThreshold(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        سيقوم التطبيق بإرسال تنبيه فقط إذا تغير السعر بمقدار أكبر من القيمة المحددة أعلاه. القيمة الحالية ({notificationThreshold.toFixed(3)}) تجعل التنبيهات حساسة جداً لأي تغيير.
                      </p>
                    </div>

                    {/* Major Changes Only */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                      <div>
                        <p className="text-sm font-medium text-slate-200">التغيرات الكبرى فقط</p>
                        <p className="text-xs text-slate-500 mt-1">تلقي تنبيهات فقط عند حدوث قفزات تزيد عن 0.05 د.ل</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !majorChangesOnly;
                          setMajorChangesOnly(newVal);
                          localStorage.setItem('majorChangesOnly', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${majorChangesOnly ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Daily Summary */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">الملخص اليومي للأسعار</p>
                        <p className="text-xs text-slate-500 mt-1">تلقي تقرير يومي شامل بحركة العملات والمعادن الساعة 8:00 مساءً</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !dailySummaryEnabled;
                          setDailySummaryEnabled(newVal);
                          localStorage.setItem('dailySummaryEnabled', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${dailySummaryEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Gold and Metals Specific Alert */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">تنبيهات أسعار الذهب والكسر</p>
                        <p className="text-xs text-slate-500 mt-1">تفعيل أو تعطيل تنبيهات سوق الصاغة والمعادن الثمينة</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !goldNotificationsEnabled;
                          setGoldNotificationsEnabled(newVal);
                          localStorage.setItem('goldNotificationsEnabled', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${goldNotificationsEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  </>
                )}

                {settingsTab === 'appearance' && (
                  <div className="space-y-6">
                    {/* Compact Mode Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">الوضع المضغوط</p>
                        <p className="text-xs text-slate-500 mt-1">تصغير حجم البطاقات لعرض المزيد من البيانات</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !compactMode;
                          setCompactMode(newVal);
                          localStorage.setItem('compactMode', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${compactMode ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Animations Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">الحركات التفاعلية</p>
                        <p className="text-xs text-slate-500 mt-1">تفعيل أو تعطيل الحركات والانتقالات في التطبيق</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !animationsEnabled;
                          setAnimationsEnabled(newVal);
                          localStorage.setItem('animationsEnabled', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${animationsEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Font Size Preference */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                      <div>
                        <p className="text-sm font-medium text-slate-200">حجم خط العرض</p>
                        <p className="text-xs text-slate-500 mt-1">تعديل حجم النصوص والأسعار المعروضة في الشاشة</p>
                      </div>
                      <select
                        value={fontSizePreference}
                        onChange={(e) => {
                          const val = e.target.value as 'small' | 'medium' | 'large';
                          setFontSizePreference(val);
                          localStorage.setItem('fontSizePreference', val);
                          triggerHaptic(10);
                        }}
                        className="bg-white/5 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
                      >
                        <option value="small" className="bg-slate-900 text-white">صغير</option>
                        <option value="medium" className="bg-slate-900 text-white">متوسط (افتراضي)</option>
                        <option value="large" className="bg-slate-900 text-white">كبير</option>
                      </select>
                    </div>
                  </div>
                )}

                {settingsTab === 'advanced' && (
                  <div className="space-y-6">
                    {/* Data Saver Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">توفير البيانات</p>
                        <p className="text-xs text-slate-500 mt-1">تقليل استهلاك البيانات بإيقاف التحديثات التلقائية السريعة</p>
                      </div>
                      <button
                        onClick={() => {
                          const newVal = !dataSaver;
                          setDataSaver(newVal);
                          localStorage.setItem('dataSaver', String(newVal));
                          triggerHaptic(10);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${dataSaver ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Default Market Select */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-200">السوق الافتراضي</p>
                        <p className="text-xs text-slate-500 mt-1">تحديد السوق المفضل لعرض الأسعار</p>
                      </div>
                      <select
                        value={defaultMarket}
                        onChange={(e) => {
                          const val = e.target.value as 'parallel' | 'official';
                          setDefaultMarket(val);
                          localStorage.setItem('defaultMarket', val);
                          triggerHaptic(10);
                        }}
                        className="bg-white/5 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
                      >
                        <option value="parallel">السوق الموازي</option>
                        <option value="official">السوق الرسمي</option>
                      </select>
                    </div>

                    {/* Chart Resolution */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                      <div>
                        <p className="text-sm font-medium text-slate-200">دقة تفاصيل المخطط</p>
                        <p className="text-xs text-slate-500 mt-1">تحديد مستوى دقة وتفاصيل المخططات البيانية</p>
                      </div>
                      <select
                        value={chartResolution}
                        onChange={(e) => {
                          const val = e.target.value as 'low' | 'medium' | 'high';
                          setChartResolution(val);
                          localStorage.setItem('chartResolution', val);
                          triggerHaptic(10);
                        }}
                        className="bg-white/5 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
                      >
                        <option value="low" className="bg-slate-900 text-white">منخفض (يومي)</option>
                        <option value="medium" className="bg-slate-900 text-white">متوسط (كل 6 ساعات)</option>
                        <option value="high" className="bg-slate-900 text-white">مرتفع (لحظي)</option>
                      </select>
                    </div>

                    {/* Spread Gap Alert */}
                    <div className="pt-4 border-t border-slate-800/60 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-200">تنبيه فجوة السعر الموازي/الرسمي</p>
                          <p className="text-xs text-slate-500 mt-1">التنبيه عند تجاوز الفرق بين السعر الموازي والرسمي حداً معيناً</p>
                        </div>
                        <button
                          onClick={() => {
                            const newVal = !spreadAlertEnabled;
                            setSpreadAlertEnabled(newVal);
                            localStorage.setItem('spreadAlertEnabled', String(newVal));
                            triggerHaptic(10);
                          }}
                          className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${spreadAlertEnabled ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                        >
                          <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>

                      {spreadAlertEnabled && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-slate-800/60">
                          <span className="text-xs text-slate-400">نبهني عندما تزيد الفجوة عن:</span>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <input
                              type="number"
                              min="0.1"
                              max="10.0"
                              step="0.1"
                              value={spreadAlertValue}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.5;
                                setSpreadAlertValue(val);
                                localStorage.setItem('spreadAlertValue', String(val));
                              }}
                              className="w-16 bg-white/10 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-xs font-mono text-indigo-400">د.ل</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-slate-800/60">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-3 bg-white text-black text-sm font-bold rounded-2xl hover:bg-zinc-200 transition-colors"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Currency Chart Modal */}
      <AnimatePresence>
        {selectedRate && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRate(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl  glass-panel-heavy premium-border  border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-800/60 flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className={`absolute inset-0 opacity-10 ${chartStats.isUp ? 'bg-gradient-to-r from-rose-500/50 to-transparent' : 'bg-gradient-to-r from-emerald-500/50 to-transparent'}`}></div>
                <div className="flex items-center gap-4 relative z-10">
                  <FlagIcon 
                    flagCode={configTerms.find(t => t.id === selectedRate.code)?.flag || CURRENCIES.find(c => c.code === selectedRate.code)?.flag} 
                    name={selectedRate.name} 
                    className="w-10 h-10 text-emerald-400" 
                    fallbackType="coins" 
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedRate.name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">
                      {selectedRate.market === 'parallel' ? 'السوق الموازي' : 'السوق الرسمي'} • {selectedRate.code}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRate(null)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all relative z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">سعر الصرف الحالي</span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                        {(selectedRate.market === 'parallel' ? rates?.parallel[selectedRate.code] : rates?.official[selectedRate.code])?.toFixed(2)}
                      </span>
                      <span className="text-sm text-slate-500">د.ل</span>
                    </div>
                    {chartStats.change !== 0 && (
                      <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${chartStats.isUp ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {chartStats.isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span className="font-mono" dir="ltr">
                          {chartStats.isUp ? '+' : ''}{chartStats.change.toFixed(2)} ({chartStats.isUp ? '+' : ''}{chartStats.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {(['24h', '7d', 'all'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setChartRange(range);
                          triggerHaptic(5);
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all border ${
                          chartRange === range 
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                            : 'bg-white/5 border-slate-800/60 text-slate-500 hover:bg-white/10'
                        }`}
                      >
                        {range === '24h' ? '24 ساعة' : range === '7d' ? '7 أيام' : 'الكل'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-[250px] sm:h-[350px] min-h-[250px] sm:min-h-[350px] shrink-0 relative mt-4">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" key={selectedRate.code}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="modalChartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartStats.isUp ? "#f43f5e" : "#10b981"} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={chartStats.isUp ? "#f43f5e" : "#10b981"} stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          vertical={false} 
                          stroke="rgba(255,255,255,0.03)" 
                          strokeDasharray="3 3" 
                        />
                        <XAxis 
                          dataKey="time" 
                          hide 
                        />
                        <YAxis 
                          domain={[(dataMin: number) => dataMin - (dataMin * 0.01), (dataMax: number) => dataMax + (dataMax * 0.01)]} 
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => val.toFixed(2)}
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: "#0a0a0a", 
                            border: "1px solid rgba(255,255,255,0.1)", 
                            borderRadius: "16px", 
                            color: "#fff", 
                            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.5)",
                            padding: "12px"
                          }}
                          itemStyle={{ color: chartStats.isUp ? "#f43f5e" : "#10b981", fontFamily: "monospace", fontSize: "18px", fontWeight: "bold" }}
                          labelStyle={{ color: "#71717a", fontSize: "11px", marginBottom: "6px", fontWeight: "medium" }}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "eeee, dd MMMM - HH:mm", { locale: ar });
                            } catch (e) {
                              return label;
                            }
                          }}
                          formatter={(value: number) => [value.toFixed(3) + ' د.ل', 'السعر']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={chartStats.isUp ? "#f43f5e" : "#10b981"}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#modalChartGradient)"
                          dot={{ r: 3, fill: chartStats.isUp ? "#f43f5e" : "#10b981", stroke: "#0a0a0a", strokeWidth: 2, fillOpacity: 1 }}
                          activeDot={{ r: 6, fill: chartStats.isUp ? "#f43f5e" : "#10b981", stroke: "#0a0a0a", strokeWidth: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2 opacity-20">
                        <TrendingUp className="w-8 h-8" />
                        <p className="text-xs font-mono">لا توجد بيانات تاريخية كافية</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-800/60 flex flex-col items-center text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">أعلى قيمة</p>
                    <p className="text-lg sm:text-xl font-mono font-bold text-white">
                      {chartStats.max.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-800/60 flex flex-col items-center text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">أدنى قيمة</p>
                    <p className="text-lg sm:text-xl font-mono font-bold text-white">
                      {chartStats.min.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-800/60 flex flex-col items-center text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">المتوسط</p>
                    <p className="text-lg sm:text-xl font-mono font-bold text-white">
                      {chartStats.avg.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Advanced Tech Analysis (30 Days) */}
                <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center text-center">
                    <p className="text-[11px] text-emerald-500/70 font-medium mb-1 line-clamp-1">مقاومة (30 يوم)</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                      {advancedStats.resistance > 0 ? advancedStats.resistance.toFixed(4) : '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center text-center">
                    <p className="text-[11px] text-rose-500/70 font-medium mb-1 line-clamp-1">دعم (30 يوم)</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-rose-400">
                      {advancedStats.support > 0 ? advancedStats.support.toFixed(4) : '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-slate-700/50 flex flex-col items-center text-center">
                    <p className="text-[11px] text-slate-400 font-medium mb-1 line-clamp-1">متوسط (30 يوم)</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-white">
                      {advancedStats.ma30 > 0 ? advancedStats.ma30.toFixed(4) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-slate-800/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-3 h-3" />
                  <span>تحديثات السوق لآخر 24 ساعة</span>
                </div>
                <button 
                  onClick={() => setSelectedRate(null)}
                  className="px-6 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Currency Selection Modal for PDF */}
      <AnimatePresence>
        {showCurrencyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-panel border border-slate-700/60 rounded-3xl p-5 sm:p-7 w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-white">تخصيص وطباعة نشرة الأسعار (PDF)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">اختر العملات والأصناف المطلوب تضمينها — يدعم الموازي والمعادن والسوق الرسمي</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCurrencyModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Actions Bar */}
              <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-800/60 shrink-0">
                <span className="text-xs text-slate-400 font-bold ml-1">تحديد سريع:</span>
                <button
                  onClick={() => {
                    const allParallelAndMetals = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id)).map(c => c.id);
                    const allOfficial = officialCurrencyList.map(c => c.code);
                    setSelectedCurrencies(allParallelAndMetals);
                    setSelectedOfficialCurrencies(allOfficial);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  تحديد الكل ({configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id)).length + officialCurrencyList.length})
                </button>
                <button
                  onClick={() => {
                    const parallelOnly = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id)).map(c => c.id);
                    setSelectedCurrencies(parallelOnly);
                    setSelectedOfficialCurrencies([]);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                >
                  السوق الموازي فقط
                </button>
                <button
                  onClick={() => {
                    const metalsOnly = configTerms.filter(c => METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id)).map(c => c.id);
                    setSelectedCurrencies(metalsOnly);
                    setSelectedOfficialCurrencies([]);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                >
                  الذهب والمعادن فقط
                </button>
                <button
                  onClick={() => {
                    setSelectedCurrencies([]);
                    setSelectedOfficialCurrencies(officialCurrencyList.map(c => c.code));
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
                >
                  السوق الرسمي (المركزي) فقط
                </button>
                <button
                  onClick={() => {
                    setSelectedCurrencies([]);
                    setSelectedOfficialCurrencies([]);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors mr-auto"
                >
                  إلغاء التحديد
                </button>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex gap-2 py-3 shrink-0 overflow-x-auto">
                <button
                  onClick={() => setPdfCategoryTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    pdfCategoryTab === 'all'
                      ? 'bg-white text-black'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>الكل</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                    {selectedCurrencies.length + selectedOfficialCurrencies.length}
                  </span>
                </button>

                <button
                  onClick={() => setPdfCategoryTab('parallel')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    pdfCategoryTab === 'parallel'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>السوق الموازي</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                    {configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length}
                  </span>
                </button>

                <button
                  onClick={() => setPdfCategoryTab('metals')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    pdfCategoryTab === 'metals'
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>الذهب والمعادن</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                    {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length}
                  </span>
                </button>

                <button
                  onClick={() => setPdfCategoryTab('official')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    pdfCategoryTab === 'official'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>السوق الرسمي (المركزي)</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 font-mono">
                    {selectedOfficialCurrencies.length}
                  </span>
                </button>
              </div>

              {/* Currencies & Items Selection Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-2 max-h-[360px] custom-scrollbar">
                {/* 1. Parallel Market Currencies */}
                {(pdfCategoryTab === 'all' || pdfCategoryTab === 'parallel') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        عملات السوق الموازي (الكاش والصكوك)
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} محدد
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {configTerms
                        .filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id))
                        .map(c => {
                          const isSelected = selectedCurrencies.includes(c.id);
                          const rate = rates?.parallel[c.id] || 0;
                          return (
                            <button
                              key={`modal-par-${c.id}`}
                              onClick={() => {
                                triggerHaptic(8);
                                setSelectedCurrencies(prev => 
                                  isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                );
                              }}
                              className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-emerald-500/15 border-emerald-500/60 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                  : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <PdfFlagIcon flagCode={c.flag} size={22} />
                                <div className="text-right truncate">
                                  <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}</p>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-700 bg-transparent'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 2. Gold & Precious Metals */}
                {(pdfCategoryTab === 'all' || pdfCategoryTab === 'metals') && (
                  <div>
                    <div className="flex items-center justify-between mb-2 mt-4">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        الذهب والمعادن الثمينة (سوق الصاغة)
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} محدد
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {configTerms
                        .filter(c => METAL_IDS.includes(c.id) && !staleCurrencies.has(c.id))
                        .map(c => {
                          const isSelected = selectedCurrencies.includes(c.id);
                          const rate = rates?.parallel[c.id] || 0;
                          return (
                            <button
                              key={`modal-metal-${c.id}`}
                              onClick={() => {
                                triggerHaptic(8);
                                setSelectedCurrencies(prev => 
                                  isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                );
                              }}
                              className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                  : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <PdfFlagIcon flagCode={c.flag} size={22} />
                                <div className="text-right truncate">
                                  <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                                  <p className="text-[10px] text-amber-500/80 font-mono">{rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}</p>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-700 bg-transparent'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 3. Official Central Bank Currencies */}
                {(pdfCategoryTab === 'all' || pdfCategoryTab === 'official') && (
                  <div>
                    <div className="flex items-center justify-between mb-2 mt-4">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        أسعار الصرف الرسمية (مصرف ليبيا المركزي)
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {selectedOfficialCurrencies.length} محدد
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {officialCurrencyList.map(c => {
                        const isSelected = selectedOfficialCurrencies.includes(c.code);
                        const rate = rates?.official[c.code] || 0;
                        return (
                          <button
                            key={`modal-off-${c.code}`}
                            onClick={() => {
                              triggerHaptic(8);
                              setSelectedOfficialCurrencies(prev => 
                                isSelected ? prev.filter(code => code !== c.code) : [...prev, c.code]
                              );
                            }}
                            className={`p-2.5 rounded-2xl border text-right flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-blue-500/15 border-blue-500/60 text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                                : 'bg-white/[0.03] border-slate-800/80 text-slate-400 hover:bg-white/[0.07] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <PdfFlagIcon flagCode={c.flag} size={22} />
                              <div className="text-right truncate">
                                <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                                <p className="text-[10px] text-blue-400/80 font-mono">{rate > 0 ? `${rate.toFixed(3)} د.ل` : c.code}</p>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700 bg-transparent'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-400 text-right w-full sm:w-auto">
                  <span>تم تحديد: </span>
                  <span className="text-white font-bold font-mono">
                    {selectedCurrencies.length + selectedOfficialCurrencies.length}
                  </span>
                  <span> صنف </span>
                  <span className="text-slate-500 text-[11px]">
                    ({configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} موازي، {configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id)).length} معادن، {selectedOfficialCurrencies.length} رسمي)
                  </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setShowCurrencyModal(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => generatePDF(selectedCurrencies, selectedOfficialCurrencies)}
                    disabled={selectedCurrencies.length === 0 && selectedOfficialCurrencies.length === 0}
                    className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                      selectedCurrencies.length === 0 && selectedOfficialCurrencies.length === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة النشرة الرسمية ({selectedCurrencies.length + selectedOfficialCurrencies.length})</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden PDF Template - Professional Financial Bulletin Unlocked by @media print */}
      <div 
        id="pdf-report-container"
        ref={reportRef} 
        className="opacity-0 pointer-events-none absolute top-[-9999px] left-[-9999px] print:opacity-100 print:pointer-events-auto print:static print:block"
        style={{ 
          width: '210mm',
          minHeight: '297mm',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: "'Cairo', 'Arial', sans-serif",
          lineHeight: '1.5',
          direction: 'rtl',
          margin: '0',
          padding: '15mm 15mm',
          boxSizing: 'border-box'
        }}
        dir="rtl"
      >
        {/* Institutional Masthead with Official Logo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '3px solid #0f172a', marginBottom: '20px' }}>
          {/* Right: Official Logo & Network Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '64px', height: '64px', border: '2px solid #0f172a', padding: '2px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/logo.png" alt="شعار مؤشر الدينار" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', margin: '0', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
                شبكة مؤشر الدينار الإحصائية
              </h1>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', margin: '4px 0 0' }}>
                النشرة الإحصائية المعتمدة لأسعار الصرف والمعادن الثمينة في ليبيا
              </p>
              <p style={{ fontSize: '11px', color: '#475569', margin: '2px 0 0', fontWeight: '600' }}>
                منصة الرصد والتحليل الاقتصادي اللحظي | dinar-index.ly
              </p>
            </div>
          </div>

          {/* Left: Document Verification & Publication Metadata */}
          <div style={{ textAlign: 'left', border: '1.5px solid #0f172a', padding: '10px 14px', backgroundColor: '#f8fafc', minWidth: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>رقم النشرة:</span>
              <span style={{ fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}>
                DI-LY-{format(new Date(), "yyyyMMdd")}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>تاريخ الإصدار:</span>
              <span style={{ fontWeight: 'bold', color: '#0f172a' }}>
                {format(new Date(), "dd MMMM yyyy", { locale: ar })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>وقت الرصد:</span>
              <span style={{ fontWeight: 'bold', color: '#059669' }}>
                {format(new Date(), "HH:mm")} (توقيت طرابلس)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '10px', color: '#059669', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
              <span>حالة الاعتماد:</span>
              <span style={{ fontWeight: 'bold' }}>بيانات معتمدة رسمياً</span>
            </div>
          </div>
        </div>

        {/* Dynamic Executive Highlights Strip (Only shown for items the user selected!) */}
        {(() => {
          const selectedParallel = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          const selectedMetals = configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          const selectedOfficial = officialCurrencyList.filter(c => selectedOfficialCurrencies.includes(c.code));

          const highlights: Array<{
            id: string;
            title: string;
            market: string;
            rate: number;
            prevRate: number;
            flagCode?: string;
            accentColor: string;
          }> = [];

          // 1. USD Cash if selected
          const usdTerm = configTerms.find(c => c.id === 'USD_CASH' || c.id === 'USD');
          if (usdTerm && selectedCurrencies.includes(usdTerm.id)) {
            const r = rates?.parallel[usdTerm.id] || usdRate || 0;
            const p = rates?.previousParallel?.[usdTerm.id] || prevUsdRate || r;
            highlights.push({ id: usdTerm.id, title: "الدولار الموازي (كاش)", market: "السوق الموازي", rate: r, prevRate: p, flagCode: "us", accentColor: "#059669" });
          }

          // 2. USD Checks if selected
          const chkTerm = configTerms.find(c => c.id === 'USD_CHECKS' || c.id === 'USD_JBANK' || c.id === 'USD_NCB');
          if (chkTerm && selectedCurrencies.includes(chkTerm.id)) {
            const r = rates?.parallel[chkTerm.id] || usdChecksRate || 0;
            const p = rates?.previousParallel?.[chkTerm.id] || prevUsdChecksRate || r;
            highlights.push({ id: chkTerm.id, title: "الدولار (صكوك)", market: "المقاصة المصرفية", rate: r, prevRate: p, flagCode: "us", accentColor: "#1d4ed8" });
          }

          // 3. Gold 18 if selected
          const goldTerm = configTerms.find(c => c.id === 'GOLD_SCRAP_18' || c.id === 'GOLD_CAST_18');
          if (goldTerm && selectedCurrencies.includes(goldTerm.id)) {
            const r = rates?.parallel[goldTerm.id] || 0;
            const p = rates?.previousParallel?.[goldTerm.id] || r;
            highlights.push({ id: goldTerm.id, title: "ذهب كسر 18", market: "سوق الصاغة / جرام", rate: r, prevRate: p, flagCode: "gold", accentColor: "#b45309" });
          }

          // 4. Official USD if selected
          if (selectedOfficialCurrencies.includes('USD')) {
            const r = rates?.official['USD'] || 0;
            const p = rates?.previousOfficial?.['USD'] || r;
            highlights.push({ id: 'OFF_USD', title: "الدولار الرسمي", market: "مصرف ليبيا المركزي", rate: r, prevRate: p, flagCode: "us", accentColor: "#475569" });
          }

          // Backfill up to 3 items if fewer than 3 were matched
          if (highlights.length < 3) {
            for (const p of selectedParallel) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === p.id)) continue;
              const r = rates?.parallel[p.id] || 0;
              const prev = rates?.previousParallel?.[p.id] || r;
              highlights.push({ id: p.id, title: p.name, market: "السوق الموازي", rate: r, prevRate: prev, flagCode: p.flag, accentColor: "#059669" });
            }
          }
          if (highlights.length < 3) {
            for (const m of selectedMetals) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === m.id)) continue;
              const r = rates?.parallel[m.id] || 0;
              const prev = rates?.previousParallel?.[m.id] || r;
              highlights.push({ id: m.id, title: m.name, market: "سوق المعادن", rate: r, prevRate: prev, flagCode: m.flag, accentColor: "#b45309" });
            }
          }
          if (highlights.length < 3) {
            for (const off of selectedOfficial) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === `OFF_${off.code}`)) continue;
              const r = rates?.official[off.code] || 0;
              const prev = rates?.previousOfficial?.[off.code] || r;
              highlights.push({ id: `OFF_${off.code}`, title: `${off.name} (رسمي)`, market: "مصرف المركزي", rate: r, prevRate: prev, flagCode: off.flag, accentColor: "#1d4ed8" });
            }
          }

          if (highlights.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '10px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${highlights.length}, 1fr)`, gap: '14px' }}>
                {highlights.map(item => {
                  const diff = item.rate - item.prevRate;
                  const isUp = diff > 0.0001;
                  const isDown = diff < -0.0001;
                  const pct = item.prevRate > 0 ? (Math.abs(diff) / item.prevRate * 100).toFixed(2) : '0.00';

                  return (
                    <div 
                      key={`pdf-high-${item.id}`}
                      style={{ 
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #0f172a',
                        borderRight: `5px solid ${item.accentColor}`,
                        padding: '12px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PdfFlagIcon flagCode={item.flagCode} size={18} />
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{item.title}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold' }}>{item.market}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>
                          {item.rate.toFixed(item.id.startsWith('OFF_') ? 3 : 2)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>د.ل</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontSize: '11px' }}>
                        <span style={{ color: '#475569' }}>السابق: {item.prevRate.toFixed(item.id.startsWith('OFF_') ? 3 : 2)}</span>
                        <span style={{ fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr' }}>
                          {!isUp && !isDown ? '▬ مستقر' : isUp ? `▲ +${Math.abs(diff).toFixed(2)}` : `▼ -${Math.abs(diff).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Section 1: Parallel Market Currencies */}
        {(() => {
          const selectedParallel = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          if (selectedParallel.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  أولاً: أسعار الصرف في السوق الموازي (الصحيفة الموازية)
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد العملات المدرجة: {selectedParallel.length} عملة
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>العملة / وسيلة الدفع</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>الرمز</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الحالي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedParallel.map((c, idx) => {
                      const rate = rates?.parallel[c.id] || 0;
                      const prev = rates?.previousParallel?.[c.id] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;

                      return (
                        <tr key={`pdf-par-row-${c.id}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#475569', fontFamily: 'monospace', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {c.id}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00' : isUp ? `+${diff.toFixed(2)}` : `${diff.toFixed(2)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d' }}>
                            {!isUp && !isDown ? 'مستقر' : isUp ? 'ارتفاع ▲' : 'انخفاض ▼'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Section 2: Gold & Precious Metals */}
        {(() => {
          const selectedMetals = configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          if (selectedMetals.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  ثانياً: أسعار الذهب والمعادن الثمينة (سوق الصاغة)
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد الأصناف المدرجة: {selectedMetals.length} صنف
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>الصنف / العيار</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>الوحدة</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الحالي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMetals.map((c, idx) => {
                      const rate = rates?.parallel[c.id] || 0;
                      const prev = rates?.previousParallel?.[c.id] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;
                      const unit = c.id.includes('LIRA') || c.id.includes('MUJARA') ? 'قطعة' : 'جرام';

                      return (
                        <tr key={`pdf-metal-row-${c.id}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#475569', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {unit}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00' : isUp ? `+${diff.toFixed(2)}` : `${diff.toFixed(2)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d' }}>
                            {!isUp && !isDown ? 'مستقر' : isUp ? 'ارتفاع ▲' : 'انخفاض ▼'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Section 3: Official Central Bank Rates */}
        {(() => {
          const selectedOfficial = officialCurrencyList.filter(c => selectedOfficialCurrencies.includes(c.code));
          if (selectedOfficial.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  ثالثاً: أسعار الصرف الرسمية الصادرة عن مصرف ليبيا المركزي
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد العملات المدرجة: {selectedOfficial.length} عملة
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>العملة الرسمية</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>رمز ISO</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الرسمي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>مصدر البيانات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOfficial.map((c, idx) => {
                      const rate = rates?.official[c.code] || 0;
                      const prev = rates?.previousOfficial?.[c.code] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;

                      return (
                        <tr key={`pdf-off-row-${c.code}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {c.code}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(3)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(3)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.000' : isUp ? `+${diff.toFixed(3)}` : `${diff.toFixed(3)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', fontSize: '10px', color: '#334155' }}>
                            مصرف ليبيا المركزي
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Authentic Institutional Certification & Footer */}
        <div className="pdf-avoid-break" style={{ marginTop: '30px', paddingTop: '16px', borderTop: '3px solid #0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
            {/* Right: Methodology and Disclaimer */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px' }}>
                منهجية الرصد الميداني ومصادر البيانات:
              </p>
              <p style={{ fontSize: '10px', color: '#475569', lineHeight: '1.6', margin: '0 0 6px' }}>
                تم إعداد هذه النشرة الإحصائية وفق منهجية الرصد المباشر والتوثيق الميداني لتداولات أسواق الصرف الأجنبي والذهب والمعادن الثمينة في المدن الليبية الرئيسية (طرابلس، بنغازي، مصراتة)، بالتعاون مع كبار المتداولين المعتمدين والمؤسسات المصرفية الرسمية، إلى جانب النشرات الرسمية الدورية الصادرة عن مصرف ليبيا المركزي.
              </p>
              <p style={{ fontSize: '9px', color: '#64748b', lineHeight: '1.5', margin: '0' }}>
                تنويه قانوني: تعتبر هذه النشرة وثيقة إحصائية واسترشادية لتوثيق حركة الأسعار اللحظية لأغراض التوثيق الإحصائي والتحليل المالي والبحث الأكاديمي. تخضع جميع أسواق التداول للتأثر المستمر بآليات العرض والطلب المحلي والعوامل والظروف الاقتصادية والسياسية المؤثرة في حركة السوق.
              </p>
            </div>

            {/* Left: Official Digital Seal / Institutional Stamp */}
            <div style={{ border: '2px solid #0f172a', padding: '10px 18px', backgroundColor: '#f8fafc', textAlign: 'center', minWidth: '200px', flexShrink: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px', letterSpacing: '0.5px' }}>
                مؤشر الدينار الليبي
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155', margin: '0 0 4px' }}>
                إدارة الرصد والتحليل المالي
              </p>
              <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#059669', margin: '0 0 6px' }}>
                ✓ معتمد للتوثيق والطباعة
              </p>
              <p style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace', fontWeight: 'bold', margin: '0', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                REF: DI-AUT-{format(new Date(), "yyyyMMdd")}
              </p>
            </div>
          </div>

          {/* Legal / Copyright Bar */}
          <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#475569' }}>
            <span>الموقع الرسمي للشبكة: dinar-index.ly</span>
            <span style={{ fontWeight: 'bold' }}>جميع الحقوق محفوظة © شبكة مؤشر الدينار 2026</span>
            <span>نظام التقارير المالية اللحظي v2.5</span>
          </div>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
