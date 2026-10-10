import React, { useState, useEffect, useRef } from "react";
import { AdminTelegramBot } from "./components/AdminTelegramBot";
import { AdminNotifications } from './components/AdminNotifications';
import "./styles/admin.css";
import { ThemeToggle } from './components/ui/ThemeToggle';
import { useDialogAccessibility } from './hooks/useDialogAccessibility';
import { AdminMessages } from "./components/AdminMessages";
import { AdminDatabase } from "./components/AdminDatabase";
import { AdminTelegram } from "./components/AdminTelegram";
import { AdminAI } from "./components/AdminAI";
import { AdminTracking } from "./components/AdminTracking";
import { AdminConfig } from "./components/AdminConfig";
import { AdminAPI } from "./components/AdminAPI";
import { AdminLogs } from "./components/AdminLogs";
import { AdminReport } from "./components/AdminReport";
import { AdminTools } from "./components/AdminTools";
import { AdminBroadcastLog } from "./components/AdminBroadcastLog";

import { AdminWhatsApp } from "./components/AdminWhatsApp";
import { AdminWeeklyHarvest } from "./components/AdminWeeklyHarvest";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { Eye, EyeOff, Settings, Edit2, Save, Trash2, ShieldCheck, LogOut, X, Lock, Users, Cpu, History as HistoryIcon, AlertTriangle, Terminal, ArrowLeftRight, CheckCircle2, RefreshCw, Globe, Zap, Search, Clock, Building2, Coins, Send, TrendingUp, LayoutDashboard, Menu, BarChart3, Bell, Database, Code2, Mail, MessageSquare, Smartphone, Radio } from 'lucide-react';
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { logErrorToServer } from "./utils/logger";

import { safeStorage } from "./utils/storage";
import { decodeData } from "./utils/security";
import { io } from "socket.io-client";


interface Stats {
  onlineUsers: number;
  lastSuccessfulScrape: string | null;
  lastRateUpdate?: string | null;
  minutesSinceLastScrape: number | null;
  channelsCount: number;
  termsCount: number;
  serverUptime: number;
  serverStartTime: string;
  dbConnected?: boolean | null;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  installs?: { total: number; today: number };
  telegramVisits?: { total: number; today: number };
  dbStats?: {
    parallelRatesCount: number;
    officialRatesCount: number;
    errorLogsCount: number;
    priceChangesCount: number;
  };
}




import { AdminCentralBank } from "./components/AdminCentralBank";

const formatAdminDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? format(new Date(value), "dd MMM yyyy · HH:mm", { locale: ar }) : "غير متاح";

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(() => {
    return safeStorage.getItem("adminToken") || "";
  });
  const [checkingSession, setCheckingSession] = useState(!!token);
  const [config, setConfig] = useState<any>(null);
  const [savedConfig, setSavedConfig] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bot' | 'push' | 'config' | 'cbl' | 'logs' | 'ai' | 'changes' | 'telegram' | 'whatsapp' | 'broadcast-log' | 'tools' | 'api' | 'database' | 'messages' | 'report' | 'tracking' | 'weekly-harvest'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useDialogAccessibility(isSidebarOpen, () => setIsSidebarOpen(false));


      
              
      

      
  
  

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(timeout);
  }, [success]);

  
  
  
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');

                    
  const fetchWithTimeout = async (resource: string, options: any = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

            
  useEffect(() => {
    if (!token) { setCheckingSession(false); return; }
    let cancelled = false;
    setCheckingSession(true);
    fetchData().catch(() => {}).finally(() => { if (!cancelled) setCheckingSession(false); });
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats().catch(() => {});
    }, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const navGroups = [
    { group: 'المتابعة', items: [
      { id: 'dashboard', label: 'نظرة عامة', icon: LayoutDashboard },
      { id: 'messages', label: 'رسائل الزوار', icon: Mail },
      { id: 'bot', label: 'البوت والتنبيهات', icon: Bell },
      { id: 'push', label: 'إشعارات المستخدمين', icon: Smartphone },
      { id: 'tracking', label: 'تحليلات الزوار', icon: Users },
    ] },
    { group: 'الأسعار والمحتوى', items: [
      { id: 'cbl', label: 'المصرف المركزي', icon: Building2 },
      { id: 'changes', label: 'حركة الأسعار', icon: HistoryIcon },
      { id: 'database', label: 'سجل الأسعار', icon: Database },
      { id: 'weekly-harvest', label: 'حصاد الأسبوع', icon: BarChart3 },
      { id: 'config', label: 'العملات والمصادر', icon: Settings },
    ] },
    { group: 'التكاملات', items: [
      { id: 'telegram', label: 'النشر الاجتماعي', icon: Send },
      { id: 'whatsapp', label: 'WhatsApp · Worker', icon: MessageSquare },
      { id: 'broadcast-log', label: 'سجل النشر', icon: Radio },
      { id: 'ai', label: 'التحليل والاستخراج', icon: Zap },
      { id: 'api', label: 'واجهة API', icon: Code2 },
    ] },
    { group: 'الصيانة', items: [
      { id: 'report', label: 'تقرير Web', icon: Terminal },
      { id: 'logs', label: 'سجل الأخطاء', icon: AlertTriangle },
      { id: 'tools', label: 'أدوات متقدمة', icon: Cpu },
    ] },
  ];
  const currentPage = navGroups.flatMap(group => group.items).find(item => item.id === activeTab)!;
  const [navSearch, setNavSearch] = useState('');
  const dirtyConfig = config !== null && JSON.stringify(config) !== savedConfig;
  const dirtyConfigRef = useRef(dirtyConfig);
  dirtyConfigRef.current = dirtyConfig;
  const renderNavigation = () => (
    <nav className="admin-navigation" aria-label="أقسام الإدارة">
      <label className="admin-nav-search">
        <Search size={17} aria-hidden="true" />
        <input aria-label="البحث في أقسام الإدارة" placeholder="ابحث عن قسم…" value={navSearch} onChange={event => setNavSearch(event.target.value)} />
      </label>
      {navGroups.map(group => {
        const items = group.items.filter(item => item.label.toLowerCase().includes(navSearch.trim().toLowerCase()));
        return items.length > 0 && (
          <div className="admin-nav-group" key={group.group}>
            <p>{group.group}</p>
            {items.map(item => (
              <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => { setActiveTab(item.id as typeof activeTab); setIsSidebarOpen(false); }}
                className="admin-nav-item">
                <item.icon size={19} aria-hidden="true" /><span>{item.label}</span>
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );

  useEffect(() => {
    if (!token) return;

    let socket: any = null;

    const connect = () => {
      try {
        socket = io('/', {
          auth: { token },
          transports: ['polling', 'websocket'],
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          timeout: 15000
        });

        socket.emit('join_admin');

        socket.on('online_count', (data: any) => {
          setStats(prev => prev ? { ...prev, onlineUsers: data.count } : null);
        });
        
        socket.on('config_update', (data: any) => {
          if (data.config?.channels && !dirtyConfigRef.current) {
            setConfig(data.config);
            setSavedConfig(JSON.stringify(data.config));
          }
        });

        socket.on('admin_auth_error', handleLogout);

        socket.on('connect_error', (err: any) => {
          if (err?.message === 'ADMIN_UNAUTHORIZED') handleLogout();
          console.warn('Admin Socket.io connection notice:', err?.message || err);
        });

      } catch (err) {
        console.warn('Socket.io initialization notice:', err);
      }
    };

    connect();

    return () => {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchConfig(), fetchStats(), fetchRecentChanges()]);
    setLoading(false);
  };



  const fetchConfig = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/config", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (!dirtyConfigRef.current) {
          setConfig(data);
          setSavedConfig(JSON.stringify(data));
        }
        setIsLoggedIn(true);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      } else {
        setError("تعذر تحميل إعدادات الإدارة. أعد المحاولة دون تغيير بيانات الدخول.");
      }
    } catch (err) {
      setError("تعذر الاتصال لتحميل الإعدادات. أعد المحاولة لاحقًا.");
      logErrorToServer(err, "Admin.tsx: fetchConfig");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setConnectionStatus('online');
      } else {
        if (res.status === 401 || res.status === 403) {
          handleLogout();
        }
        setConnectionStatus('offline');
      }
    } catch (err) {
      // Don't spam server logs for network failures
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn("Stats fetch failed: Network error");
      } else {
        console.warn("Stats fetch failed:", err);
        logErrorToServer(err, "Admin.tsx: fetchStats");
      }
      setConnectionStatus('offline');
    }
  };



  const fetchRecentChanges = async () => {
    try {
      const res = await fetchWithTimeout("/api/recent-changes");
      if (res.ok) {
        const data = await res.json();
        setRecentChanges(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Recent changes fetch failed");
    }
  };

  const handleClearChanges = async () => {
    if (!window.confirm("مسح سجل تغيرات الأسعار؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recent-changes", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecentChanges([]);
        setSuccess("تم تنظيف سجل التغيرات بنجاح");
      } else {
        setError("تعذر مسح السجل. لم تتغير البيانات.");
      }
    } catch (err) {
      setError("تعذر الاتصال لمسح السجل.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithTimeout("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      }, 15000);
      const data = await res.json();
      if (res.ok && data.success && typeof data.token === "string" && data.token) {
        setToken(data.token);
        safeStorage.setItem("adminToken", data.token);
        setPassword("");
        setShowPassword(false);
        setIsLoggedIn(true);
      } else {
        setError(data.message || "تعذر تسجيل الدخول. أعد المحاولة.");
      }
    } catch (err) {
      setError("تعذر الاتصال بالخادم. أعد المحاولة لاحقًا.");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("تم حفظ الإعدادات بنجاح وتحديث السيرفر!");
        setSavedConfig(JSON.stringify(config));
        setLoading(false);
        return true;
      } else {
        setError(data.message || data.error || "تعذر حفظ الإعدادات.");
      }
    } catch (err) {
      setError("خطأ في عملية الحفظ");
    }
    setLoading(false);
    return false;
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("قبل Worker طلب التحديث. ستظهر الأسعار عند اكتمال المعالجة والمزامنة.");
        fetchStats().catch(() => {});

      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("فشل تحديث البيانات");
    }
    setRefreshing(false);
  };


  const [uptimeDisplay, setUptimeDisplay] = useState("");

  useEffect(() => {
    if (!stats?.serverStartTime) return;
    
    const updateUptime = () => {
      const start = new Date(stats.serverStartTime).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000);
      
      const days = Math.floor(diff / (24 * 3600));
      const hours = Math.floor((diff % (24 * 3600)) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      let display = "";
      if (days > 0) display += `${days} يوم `;
      if (hours > 0 || days > 0) display += `${hours} ساعة `;
      display += `${minutes} دقيقة ${seconds} ثانية`;
      setUptimeDisplay(display);
    };
    
    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [stats?.serverStartTime]);
  const handleCleanup = async () => {
    if (!window.confirm("سيُنفذ أمر تنظيف السجلات القديمة. هل تريد المتابعة؟")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("تم تنظيف البيانات القديمة بنجاح!");
        fetchStats().catch(() => {});


      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("فشل تنظيف البيانات");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    safeStorage.removeItem("adminToken");
    setToken("");
    setIsLoggedIn(false);
    setConfig(null);
    setSavedConfig('');
    setPassword('');
    setShowPassword(false);
    setCheckingSession(false);
    setIsSidebarOpen(false);
  };

  
  
  
  
  






  if (checkingSession || (isLoggedIn && !config)) {
    return (
      <div className="admin-shell admin-login-shell" dir="rtl">
        <div className="admin-login-panel">
          <h1>لوحة الإدارة</h1>
          <p className="admin-muted" role="status">{loading || checkingSession ? 'جارٍ التحقق من الجلسة…' : 'تعذر تحميل إعدادات الإدارة.'}</p>
          {error && <p className="admin-inline-error" role="alert">{error}</p>}
          <div className="admin-login-links">
            <a href="/" className="admin-secondary"><ArrowLeftRight size={17} />العودة للموقع</a>
            {!loading && !checkingSession && <button type="button" className="admin-primary" onClick={() => fetchData().catch(() => {})}><RefreshCw size={17} />إعادة المحاولة</button>}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="admin-shell admin-login-shell" dir="rtl">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="admin-login-panel">
            <div className="admin-login-top">
              <a href="/" className="admin-text-button"><ArrowLeftRight size={17} />العودة للموقع</a>
              <ThemeToggle />
            </div>
            <div className="admin-login-brand"><img src="/logo.png" width="44" height="44" alt="" /><span>مؤشر الدينار</span></div>
            <h1>لوحة الإدارة</h1>
            <p className="admin-muted">دخول خاص بإدارة المنصة</p>
            <form onSubmit={handleLogin} className="admin-login-form" aria-busy={loading}>
              <div className="admin-field">
                <label htmlFor="admin-password">كلمة مرور الإدارة</label>
                <div className="admin-password-input" dir="ltr">
                  <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
                    placeholder="أدخل كلمة المرور" disabled={loading} required aria-describedby={error ? 'admin-login-error' : undefined} />
                  <button type="button" className="admin-password-toggle" disabled={loading}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    aria-pressed={showPassword} onClick={() => setShowPassword(previous => !previous)}>
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>
              {error && <p id="admin-login-error" className="admin-inline-error" role="alert"><AlertTriangle size={17} aria-hidden="true" />{error}</p>}
              <button type="submit" disabled={loading || !password.trim()} className="admin-primary admin-login-submit">
                {loading ? <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                {loading ? 'جارٍ تسجيل الدخول…' : 'فتح لوحة التحكم'}
              </button>
            </form>
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="admin-shell min-h-screen bg-[#020617] text-white flex font-sans selection:bg-emerald-500/30 overflow-hidden" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="admin-sidebar">
        <div className="admin-brand"><ShieldCheck size={25} aria-hidden="true" /><div><strong>Dollar Price</strong><span>لوحة الإدارة · Web</span></div></div>
        {renderNavigation()}
        <div className="admin-sidebar-footer">
          <span className="admin-connection" data-state={connectionStatus}><span />{connectionStatus === 'online' ? 'Web متصل' : connectionStatus === 'checking' ? 'جارٍ التحقق' : 'تعذر الاتصال بـ Web'}</span>
          <button type="button" className="admin-nav-item admin-danger" onClick={handleLogout}><LogOut size={18} aria-hidden="true" />تسجيل الخروج</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        {/* Top Header */}
        <header className="admin-header">
          <div className="admin-header-title">
            <button type="button" onClick={() => setIsSidebarOpen(true)} aria-label="فتح قائمة الإدارة" aria-expanded={isSidebarOpen} className="admin-icon-button lg:hidden"><Menu size={21} /></button>
            <div><span className="admin-muted">مركز الإدارة</span><h1>{currentPage.label}</h1></div>
          </div>
          <div className="admin-header-actions">
            <span className="admin-connection hidden sm:flex" data-state={connectionStatus}><span />{connectionStatus === 'online' ? 'Web متصل' : connectionStatus === 'checking' ? 'جارٍ التحقق' : 'غير متصل'}</span>
            <button type="button" className="admin-icon-button" aria-label="تحديث بيانات اللوحة" title="تحديث بيانات اللوحة" disabled={loading} onClick={() => fetchData().catch(() => {})}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
            <ThemeToggle />
            {dirtyConfig && <button type="button" onClick={handleSave} disabled={loading} className="admin-primary"><Save size={17} aria-hidden="true" /><span>حفظ</span></button>}
          </div>
        </header>

        <AnimatePresence>
          {isSidebarOpen && <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/70 z-[100] lg:hidden" />
            <motion.div ref={sidebarRef} role="dialog" aria-modal="true" aria-label="قائمة الإدارة" tabIndex={-1}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="admin-drawer lg:hidden">
              <div className="admin-brand"><ShieldCheck size={24} /><strong>Dollar Price</strong><button type="button" className="admin-icon-button" aria-label="إغلاق قائمة الإدارة" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button></div>
              {renderNavigation()}
              <button type="button" className="admin-nav-item admin-danger" onClick={handleLogout}><LogOut size={18} />تسجيل الخروج</button>
            </motion.div>
          </>}
        </AnimatePresence>

        {/* Content Viewport */}
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          {dirtyConfig && <div className="admin-draft-notice" role="status"><Edit2 size={16} aria-hidden="true" />توجد تغييرات لم تُحفظ بعد.</div>}
          <AnimatePresence mode="wait">
            {activeTab === 'api' && <AdminAPI token={token} config={config} setConfig={setConfig} />}
          {activeTab === 'bot' && <AdminTelegramBot token={token} config={config} setConfig={setConfig} handleSave={handleSave} loading={loading} dirty={dirtyConfig} setError={setError} setSuccess={setSuccess} />}
          {activeTab === 'push' && <AdminNotifications token={token} />}
          {activeTab === 'config' && <AdminConfig config={config} setConfig={setConfig} handleSave={handleSave} loading={loading} />}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-overview">
              <section className="admin-section">
                <div className="admin-section-heading"><div><h2>ملخص التشغيل</h2><p className="admin-muted">Web · {connectionStatus === 'online' ? 'آخر اتصال ناجح' : 'بانتظار اتصال ناجح'}</p></div><a className="admin-secondary" href="/" target="_blank" rel="noopener noreferrer"><Globe size={17} />عرض الموقع</a></div>
                <div className="admin-metrics">
                  {[
                    { label: 'الزوار الآن', value: stats?.onlineUsers ?? '—', icon: Users },
                    { label: 'العملات والأصناف', value: stats?.termsCount ?? '—', icon: Coins },
                    { label: 'ذاكرة Web', value: stats?.memoryUsage ? `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)} MB` : '—', icon: Cpu },
                    { label: 'تثبيت التطبيق اليوم', value: stats?.installs?.today ?? '—', icon: Smartphone },
                  ].map(item => <div className="admin-metric" key={item.label}><item.icon size={19} aria-hidden="true" /><span>{item.label}</span><strong dir="auto">{item.value}</strong></div>)}
                </div>
                <dl className="admin-status-list">
                  <div><dt>اتصال قاعدة البيانات</dt><dd className={stats?.dbConnected === false ? 'admin-danger' : ''}>{stats?.dbConnected === true ? 'تمت القراءة بنجاح' : stats?.dbConnected === false ? 'تعذر التحقق من القراءة' : 'غير متحقق'}</dd></div>
                  <div><dt>آخر بيانات أسعار متاحة</dt><dd>{stats?.lastRateUpdate || stats?.lastSuccessfulScrape ? formatAdminDate(stats.lastRateUpdate || stats.lastSuccessfulScrape) : 'غير متاح'}</dd></div>
                  <div><dt>مدة تشغيل Web</dt><dd>{uptimeDisplay || 'غير متاح'}</dd></div>
                  <div><dt>خدمة Worker</dt><dd>تُراقب من لوحة Worker المستقلة</dd></div>
                </dl>
              </section>
              <section className="admin-section">
                <div className="admin-section-heading"><h2>إجراءات التشغيل</h2></div>
                <div className="admin-quick-actions">
                  <button type="button" className="admin-secondary" disabled={refreshing} onClick={triggerRefresh}><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />طلب تحديث من Worker</button>
                  <button type="button" className="admin-secondary" onClick={() => setActiveTab('cbl')}><Building2 size={18} />المصرف المركزي</button>
                  <button type="button" className="admin-secondary" onClick={() => setActiveTab('bot')}><Bell size={18} />البوت والتنبيهات</button>
                  <button type="button" className="admin-secondary" onClick={() => setActiveTab('messages')}><Mail size={18} />رسائل الزوار</button>
                </div>
              </section>
              <section className="admin-section">
                <div className="admin-section-heading"><h2>سجلات البيانات</h2><button type="button" className="admin-text-button" onClick={() => setActiveTab('report')}>تقرير Web<ArrowLeftRight size={16} /></button></div>
                <div className="admin-metrics">
                  {[
                    { label: 'أسعار السوق الموازي', value: stats?.dbStats?.parallelRatesCount, tab: 'database' },
                    { label: 'الأسعار الرسمية', value: stats?.dbStats?.officialRatesCount, tab: 'database' },
                    { label: 'تغيرات الأسعار', value: stats?.dbStats?.priceChangesCount, tab: 'changes' },
                    { label: 'سجل الأخطاء', value: stats?.dbStats?.errorLogsCount, tab: 'logs' },
                  ].map(item => <button type="button" className="admin-metric" key={item.label} onClick={() => setActiveTab(item.tab as typeof activeTab)}><span>{item.label}</span><strong>{item.value?.toLocaleString('ar-LY') ?? '—'}</strong></button>)}
                </div>
              </section>
              <details className="admin-advanced">
                <summary>صيانة البيانات</summary>
                <button type="button" className="admin-secondary admin-danger" disabled={loading} onClick={handleCleanup}><Trash2 size={17} />تنظيف السجلات القديمة</button>
              </details>
            </motion.div>
          )}

          {activeTab === 'changes' && (
            <motion.div 
              key="changes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section className="glass-panel-heavy premium-border border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-800/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black flex items-center gap-3 text-blue-400">
                      <HistoryIcon className="w-6 h-6" />
                      سجل التغيرات
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">يعرض أحدث التغيرات في الأسعار مع ذكر المصادر</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleClearChanges}
                      disabled={loading}
                      className="admin-secondary admin-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                      مسح السجل
                    </button>
                    <button 
                      onClick={fetchRecentChanges}
                      aria-label="تحديث حركة الأسعار" title="تحديث حركة الأسعار"
                      className="admin-icon-button"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-black/40 p-6 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                  {recentChanges.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                       <HistoryIcon className="w-10 h-10 text-zinc-800" />
                       <p className="text-zinc-600">لا توجد تغيرات مسجلة حالياً.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentChanges.map((change, i) => (
                        <div key={change.id || i} className="border border-slate-800/60 bg-white/[0.02] p-5 rounded-2xl hover:bg-white/[0.04] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                              <TrendingUp className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-bold text-lg">{change.currencyName}</span>
                                <span className="text-xs font-mono px-2 py-0.5 bg-white/10 rounded-md text-slate-400">{change.currencyCode}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 line-through">{change.oldPrice}</span>
                                <ArrowLeftRight className="w-3 h-3 text-zinc-600" />
                                <span className={`font-black ${change.newPrice > change.oldPrice ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {change.newPrice}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col md:items-end gap-2 border-t md:border-t-0 md:border-r border-slate-800/60 pt-4 md:pt-0 md:pr-6">
                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-black/40 px-3 py-1.5 rounded-lg border border-slate-800/60">
                              <Globe className="w-3 h-3 text-blue-400" />
                              <span className="truncate max-w-[150px] md:max-w-[200px]" dir="ltr">{change.source}</span>
                            </div>
                            <div className="flex flex-col md:items-end gap-1">
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono" dir="ltr">
                                {(() => {
                                  try {
                                    const d = change.timestamp ? new Date(change.timestamp) : new Date();
                                    return isNaN(d.getTime()) ? '-' : format(d, "yyyy-MM-dd HH:mm:ss");
                                  } catch (e) {
                                    return '-';
                                  }
                                })()}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500/70">
                                <Clock className="w-3 h-3" />
                                {(() => {
                                  try {
                                    const d = change.timestamp ? new Date(change.timestamp) : new Date();
                                    return isNaN(d.getTime()) ? '-' : formatDistanceToNow(d, { addSuffix: true, locale: ar });
                                  } catch (e) {
                                    return '-';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'cbl' && (
            <AdminCentralBank token={token} onError={setError} onSuccess={setSuccess} />
          )}

          {activeTab === 'weekly-harvest' && (
            <AdminWeeklyHarvest token={token} config={config} setError={setError} setSuccess={setSuccess} />
          )}

          {activeTab === 'messages' && <AdminMessages token={token} />}

          {activeTab === 'tracking' && <AdminTracking token={token} />}
                    {activeTab === 'report' && <AdminReport token={token} />}
          {activeTab === 'logs' && <AdminLogs token={token} setError={setError} setSuccess={setSuccess} />}
          {activeTab === 'ai' && <AdminAI token={token} config={config} setError={setError} setSuccess={setSuccess} triggerRefresh={triggerRefresh} decodeData={decodeData} />}

          {activeTab === 'telegram' && <AdminTelegram token={token} config={config} setConfig={setConfig} setError={setError} setSuccess={setSuccess} onSaved={saved => { setConfig(saved); setSavedConfig(JSON.stringify(saved)); }} />}

          {activeTab === 'whatsapp' && <AdminWhatsApp token={token} fetchWithTimeout={fetchWithTimeout} setError={setError} setSuccess={setSuccess} />}

          {activeTab === 'broadcast-log' && <AdminBroadcastLog token={token} />}

          {activeTab === 'database' && <AdminDatabase token={token} config={config} />}

          {activeTab === 'tools' && <AdminTools token={token} setError={setError} setSuccess={setSuccess} />}

        </AnimatePresence>
      </main>

      <nav className="admin-bottom-nav lg:hidden" aria-label="التنقل السريع">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'الرئيسية' },
          { id: 'messages', icon: Mail, label: 'الرسائل' },
          { id: 'bot', icon: Bell, label: 'البوت' },
        ].map(item => (
          <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => setActiveTab(item.id as typeof activeTab)}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span></button>
        ))}
        <button type="button" aria-label="جميع أقسام الإدارة" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(true)}><Menu size={20} aria-hidden="true" /><span>الأقسام</span></button>
      </nav>

      {/* Full-screen success/error messages over overlay */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] w-full max-w-md px-6"
          >
            <div className={`p-5 rounded-[2rem] border shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-4 ${
              success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${success ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                   {success ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <span role={error ? 'alert' : 'status'} className="font-bold text-sm tracking-tight">{error || success}</span>
              </div>
              <button 
                onClick={() => { setSuccess(""); setError(""); }}
                aria-label="إغلاق الإشعار"
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
    </MotionConfig>
  );
}
