import React, { useState, useEffect, useMemo } from "react";
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
import { motion, AnimatePresence } from "motion/react";
import { Settings, Check, Edit2, Save, Plus, Trash2, ArrowRight, ShieldCheck, LogOut, X, Lock, Activity, Users, Cpu, History as HistoryIcon, AlertTriangle, Terminal, ArrowLeftRight, ArrowUpRight, ArrowDownRight, CheckCircle2, RefreshCw, Layers, Globe, Zap, Search, ChevronDown, ChevronUp, Clock, Info, Building2, Coins, Send, Building, TrendingUp, Stethoscope, ListX, Trash, LayoutDashboard, Menu, BarChart3, Bell, Shield, Database, Link, Copy, Code2, Download, Pause, Play, Filter, XCircle, AlertCircle, Mail, MessageSquare, DownloadCloud, Sparkles, Monitor, Smartphone, Layout, Wifi, AppWindow , MapPin , LineChart, Radio } from 'lucide-react';
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { logErrorToServer } from "./utils/logger";
import { FlagIcon } from "./components/FlagIcon";
import { TelegramStatus } from "./components/TelegramStatus";
import { TelegramPoster } from "./components/TelegramPoster";
import { decodeData } from "./utils/security";
import { io } from "socket.io-client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface Stats {
  onlineUsers: number;
  lastSuccessfulScrape: string;
  minutesSinceLastScrape: number;
  channelsCount: number;
  termsCount: number;
  serverUptime: number;
  serverStartTime: string;
  dbConnected?: boolean;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  installs?: { total: number; today: number };
  dbStats?: {
    parallelRatesCount: number;
    officialRatesCount: number;
    errorLogsCount: number;
    priceChangesCount: number;
  };
}

const extractKeywordsAndSuffix = (regex: string) => {
  try {
    const match = regex.match(/^\(\?\:(.+?)\)(.*)$/);
    if (match) {
      return {
        keywords: match[1].split('|').filter(Boolean),
        suffix: match[2]
      };
    }
  } catch (e) {}
  return { keywords: [], suffix: regex };
};

const RegexEditor = ({ regex, onChange }: { regex: string, onChange: (val: string) => void }) => {
  const [mode, setMode] = useState<'bubbles' | 'raw'>('bubbles');
  const [newWord, setNewWord] = useState('');

  const parsed = useMemo(() => {
    if (!regex.startsWith('(?:')) return null;
    let depth = 0;
    let alternatives = [];
    let currentAlt = '';
    let i = 3;
    for (; i < regex.length; i++) {
      const char = regex[i];
      if (char === '\\') {
        currentAlt += char + (regex[i+1] || '');
        i++;
        continue;
      }
      if (char === '(') depth++;
      if (char === ')') depth--;
      
      if (depth < 0) {
        alternatives.push(currentAlt);
        break;
      }
      
      if (char === '|' && depth === 0) {
        alternatives.push(currentAlt);
        currentAlt = '';
      } else {
        currentAlt += char;
      }
    }
    
    if (depth >= 0) return null;
    
    const suffix = regex.slice(i + 1);
    return { alternatives, suffix };
  }, [regex]);

  useEffect(() => {
    if (!parsed && mode === 'bubbles') {
      setMode('raw');
    }
  }, [parsed, mode]);

  const removeWord = (index: number) => {
    if (!parsed) return;
    const newAlts = [...parsed.alternatives];
    newAlts.splice(index, 1);
    onChange(`(?:${newAlts.join('|')})${parsed.suffix}`);
  };

  const addWord = () => {
    if (!parsed || !newWord.trim()) return;
    const newAlts = [...parsed.alternatives, newWord.trim()];
    onChange(`(?:${newAlts.join('|')})${parsed.suffix}`);
    setNewWord('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">محرر REGEX المتقدم</label>
          <Info className="w-4 h-4 text-zinc-700 hover:text-emerald-400 cursor-help" />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMode('bubbles')} 
            className={`text-[10px] px-2 py-1 rounded-md transition-colors ${mode === 'bubbles' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            disabled={!parsed}
          >
            فقاعات
          </button>
          <button 
            onClick={() => setMode('raw')} 
            className={`text-[10px] px-2 py-1 rounded-md transition-colors ${mode === 'raw' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            نص خام
          </button>
        </div>
      </div>

      {mode === 'bubbles' && parsed ? (
        <div className="bg-black/40 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {parsed.alternatives.map((alt, i) => (
              <div key={i} className="flex items-center gap-1 bg-white/10 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono">
                <span dir="ltr">{alt}</span>
                <button 
                  onClick={() => removeWord(i)}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-rose-500/20 text-rose-400 transition-colors mr-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWord()}
              placeholder="إضافة كلمة جديدة..."
              className="flex-1 bg-white/5 border border-slate-800/60 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500/30 text-white font-mono"
              dir="ltr"
            />
            <button 
              onClick={addWord}
              className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors"
            >
              إضافة
            </button>
          </div>
        </div>
      ) : (
        <textarea
          value={regex}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-24 bg-transparent border border-slate-700/50 rounded-xl px-4 py-3 text-xs font-mono text-emerald-400 focus:border-emerald-500/50 outline-none resize-none leading-relaxed"
          dir="ltr"
        />
      )}
    </div>
  );
};

import { TelegramDetailedStatus } from "./components/TelegramDetailedStatus";

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("adminToken") || "";
    } catch (e) { return ""; }
  });
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
        const [systemReport, setSystemReport] = useState<any>(null);
      const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'logs' | 'ai' | 'changes' | 'telegram' | 'broadcast-log' | 'tools' | 'api' | 'database' | 'messages' | 'report' | 'tracking'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthorizedDevice, setIsAuthorizedDevice] = useState(true);

      
              
      
      const [deviceFilter, setDeviceFilter] = useState<'all' | 'Mobile' | 'Desktop' | 'Tablet' | 'Bot'>('all');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
      
  
  



  // Admin socket events

  
  
  
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
    let deviceToken = null;
    try {
      deviceToken = localStorage.getItem("admin_device_token");
    } catch (e) { console.warn("LocalStorage not available", e); }
    
    // In actual production, this would be a more complex check
    if (localStorage.getItem("is_dev") !== "true" && deviceToken !== "authorized_device_token_xyz") {
      // Temporarily allowing if is_dev is set to true for easy initial setup
      if (!deviceToken) {
         console.warn("Device not authorized for admin panel");
      }
    }

    if (token) {
      fetchData().catch(() => {});
      const interval = setInterval(() => {
        fetchStats().catch(() => {});
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const navGroups = [
    {
      group: 'الرئيسية',
      items: [
        { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
        { id: 'config', label: 'إعدادات العملات', icon: Settings },
      ]
    },
    {
      group: 'البيانات والسجلات',
      items: [
        { id: 'database', label: 'الأسعار السابقة', icon: Database },
        { id: 'changes', label: 'حركة الأسعار', icon: HistoryIcon },
        { id: 'messages', label: 'رسائل الزوار', icon: Mail },
        { id: 'tracking', label: 'سجل الزوار الدقيق', icon: Users },
      ]
    },
    {
      group: 'تكامل الخدمات',
      items: [
        { id: 'telegram', label: 'تيليجرام', icon: Globe },
        { id: 'broadcast-log', label: 'سجل البث الاجتماعي', icon: Radio },
        { id: 'ai', label: 'الذكاء الاصطناعي', icon: Zap },
        { id: 'api', label: 'واجهة API', icon: Code2 },
      ]
    },
    {
      group: 'صيانة النظام',
      items: [
        { id: 'tools', label: 'أدوات السيرفر', icon: Cpu },
        { id: 'report', label: 'حالة السيرفر', icon: Terminal },
        { id: 'logs', label: 'سجل الأخطاء', icon: AlertTriangle },
      ]
    }
  ];

  useEffect(() => {
    if (!token) return;

    let socket: any = null;

    const connect = () => {
      try {
        socket = io('/', {
          transports: ['polling', 'websocket'],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          timeout: 15000
        });

        socket.on('online_count', (data: any) => {
          setStats(prev => prev ? { ...prev, onlineUsers: data.count } : null);
        });
        
        socket.on('config_update', (data: any) => {
          setConfig(data.config);
        });

        socket.on('connect_error', (err: any) => {
          console.warn('Admin Socket.io connection notice:', err?.message || err);
        });

      } catch (err) {
        console.warn('Socket.io initialization notice:', err);
      }
    };

    connect();

    return () => {
      if (socket) {
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
        setConfig(data);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        try { localStorage.removeItem("adminToken"); } catch (e) {}
        setToken("");
      }
    } catch (err) {
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
          setToken("");
          try { localStorage.removeItem("adminToken"); } catch (e) {}
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

  const [confirmClearChanges, setConfirmClearChanges] = useState(false);

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
    if (!confirmClearChanges) {
      setConfirmClearChanges(true);
      setTimeout(() => setConfirmClearChanges(false), 3000);
      return;
    }
    try {
      const res = await fetch("/api/admin/recent-changes", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecentChanges([]);
        setSuccess("تم تنظيف سجل التغيرات بنجاح");
        setConfirmClearChanges(false);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        try {
          localStorage.setItem("adminToken", data.token);
          // Auto-authorize device on successful password login
          localStorage.setItem("admin_device_token", "authorized_device_token_xyz");
        } catch (e) {}
        setIsLoggedIn(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("خطأ في الاتصال بالسيرفر");
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
      if (data.success) {
        setSuccess("تم حفظ الإعدادات بنجاح وتحديث السيرفر!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("خطأ في عملية الحفظ");
    }
    setLoading(false);
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
        setSuccess("تم تحديث البيانات بنجاح!");
        fetchStats().catch(() => {});
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("فشل تحديث البيانات");
    }
    setRefreshing(false);
  };

  const [confirmCleanup, setConfirmCleanup] = useState(false);
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
    if (!confirmCleanup) {
      setConfirmCleanup(true);
      setTimeout(() => setConfirmCleanup(false), 3000);
      return;
    }
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
        setConfirmCleanup(false);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("فشل تنظيف البيانات");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    try { localStorage.removeItem("adminToken"); } catch (e) {}
    setToken("");
    setIsLoggedIn(false);
  };

  
  
  
  
  






  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-emerald-500/30" dir="rtl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/[0.03] backdrop-blur-3xl border border-slate-700/50 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10"
        >
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#0a0a0a] animate-ping opacity-20"></div>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white mb-3 tracking-tight">الدخول الآمن</h1>
            <p className="text-slate-500 text-sm leading-relaxed">يرجى إدخال مفتاح الوصول الإداري للمتابعة</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-slate-700/50 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-emerald-500/50 focus:bg-black/60 transition-all text-center text-2xl tracking-[0.3em] font-mono placeholder:tracking-normal placeholder:font-sans placeholder:text-zinc-700"
                dir="ltr"
                required
              />
              <div className="absolute inset-0 rounded-2xl border border-emerald-500/0 group-focus-within:border-emerald-500/20 pointer-events-none transition-all"></div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl text-rose-400 text-sm text-center flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-black font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-3 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {loading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="text-lg">فتح لوحة التحكم</span>
                  <Zap className="w-5 h-5 group-hover:fill-current transition-all" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex font-sans selection:bg-emerald-500/30 overflow-hidden" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-[#080808] border-l border-slate-800/60 relative z-[60] pt-safe pb-safe overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-tight">مركز الإدارة</h1>
              <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">Version 4.0</span>
            </div>
          </div>

          <nav className="space-y-6">
            {navGroups.map((group, idx) => (
              <div key={idx}>
                <h3 className="text-[11px] font-bold text-slate-500 mb-3 px-4 uppercase tracking-widest">{group.group}</h3>
                <div className="space-y-1.5">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group ${
                        activeTab === item.id 
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                          : 'text-slate-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5]' : 'group-hover:scale-110 transition-transform'}`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800/60">
           <div className="bg-white/5 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Database className="w-4 h-4 text-blue-400" />
                 </div>
                 <span className="text-xs font-bold text-slate-400">حالة النظام</span>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">الاتصال:</span>
                    <span className={connectionStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}>
                       {connectionStatus === 'online' ? 'متصل' : 'منقطع'}
                    </span>
                 </div>
                 <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">الذاكرة:</span>
                    <span className="text-blue-400">{stats?.memoryUsage ? `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB` : '...'}</span>
                 </div>
              </div>
           </div>
           
           <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all border border-rose-500/10"
           >
             <LogOut className="w-5 h-5" />
             تسجيل الخروج
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-[calc(5rem+env(safe-area-inset-top))] bg-[#020617]/80 backdrop-blur-2xl border-b border-slate-800/60 flex items-center justify-between px-6 shrink-0 relative z-50 pt-safe">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="hidden md:flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-slate-800/60 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${stats?.minutesSinceLastScrape && stats.minutesSinceLastScrape < 15 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                  <span className="text-[10px] font-bold text-slate-400">تيليجرام: {stats?.minutesSinceLastScrape ? `منذ ${stats.minutesSinceLastScrape}د` : '---'}</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-slate-800/60 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-bold text-slate-400">المستخدمين: {stats?.onlineUsers || 0}</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <TelegramStatus />
             <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
             <button
               onClick={handleSave}
               disabled={loading}
               className="px-5 py-2.5 rounded-xl bg-white text-black font-black flex items-center gap-2 hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 text-sm shadow-xl shadow-white/5"
             >
               <Save className="w-4 h-4" />
               <span>حفظ التغييرات</span>
             </button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.aside 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed top-0 right-0 bottom-0 w-80 bg-[#080808] z-[110] lg:hidden p-8 flex flex-col shadow-2xl pt-safe pb-safe overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    <span className="font-black text-xl">القائمة</span>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-xl bg-white/5">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="space-y-6">
                  {navGroups.map((group, idx) => (
                    <div key={idx}>
                      <h3 className="text-[11px] font-bold text-slate-500 mb-3 px-4 uppercase tracking-widest">{group.group}</h3>
                      <div className="space-y-2">
                        {group.items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              setIsSidebarOpen(false);
                            }}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
                              activeTab === item.id 
                                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                                : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5]' : ''}`} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>

                <div className="mt-auto">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold text-rose-400 bg-rose-500/5 border border-rose-500/10"
                  >
                    <LogOut className="w-5 h-5" />
                    تسجيل الخروج
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'api' && <AdminAPI token={token} config={config} setConfig={setConfig} />}
          {activeTab === 'config' && <AdminConfig config={config} setConfig={setConfig} handleSave={handleSave} loading={loading} />}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 md:space-y-8"
            >
              {/* Quick Actions Control Center - Perfect for Mobile */}
              <section className="bg-white/[0.03] border border-slate-700/50 rounded-[2rem] p-6 shadow-2xl">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 px-1">التحكم السريع بالسيرفر</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                   <button 
                     onClick={triggerRefresh}
                     disabled={refreshing}
                     className="flex flex-col items-center justify-center p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 transition-all group active:scale-95"
                   >
                     <RefreshCw className={`w-6 h-6 text-emerald-400 group-hover:text-black mb-2 ${refreshing ? 'animate-spin' : ''}`} />
                     <span className="text-[11px] font-black text-white group-hover:text-black">تحديث السوق</span>
                   </button>
                   <button 
                     onClick={async () => {
                        setLoading(true);
                        try {
                           const res = await fetch("/api/admin/refresh-official", {
                             method: "POST",
                             headers: { Authorization: `Bearer ${token}` }
                           });
                           if(res.ok) setSuccess("تم تحديث السعر الرسمي");
                        } catch(e) {}
                        setLoading(false);
                     }}
                     className="flex flex-col items-center justify-center p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500 transition-all group active:scale-95"
                   >
                     <Building2 className="w-6 h-6 text-blue-400 group-hover:text-black mb-2" />
                     <span className="text-[11px] font-black text-white group-hover:text-black">تحديث الرسمي</span>
                   </button>
                   <button 
                     onClick={handleCleanup}
                     className="flex flex-col items-center justify-center p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 transition-all group active:scale-95"
                   >
                     <Trash2 className="w-6 h-6 text-rose-400 group-hover:text-black mb-2" />
                     <span className="text-[11px] font-black text-white group-hover:text-black">تنظيف الداتا</span>
                   </button>
                   <button 
                     onClick={() => window.open('https://dollar-price-qp14.onrender.com', '_blank')}
                     className="flex flex-col items-center justify-center p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 transition-all group active:scale-95"
                   >
                     <Globe className="w-6 h-6 text-amber-400 group-hover:text-black mb-2" />
                     <span className="text-[11px] font-black text-white group-hover:text-black">عرض الموقع</span>
                   </button>
                </div>
              </section>

              {/* Server Status Hero Card */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-blue-600/10 border border-slate-700/50 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                <div className="relative flex flex-col md:items-center lg:flex-row justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 border border-slate-700/50 shadow-xl">
                      <Cpu className="w-7 h-7 md:w-8 md:h-8" />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-2xl font-black text-white mb-1">صحة النظام (Engine Status)</h2>
                      <p className="text-slate-500 text-[10px] md:text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        سيرفر Render نشط ويعمل بكفاءة عالية
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-1 bg-black/20 p-4 rounded-2xl border border-slate-800/60 w-full lg:w-auto">
                    <span className="text-slate-500 text-[9px] uppercase tracking-widest font-black">وقت التشغيل المتواصل</span>
                    <span className="text-xl md:text-3xl font-black text-white font-mono tracking-tighter tabular-nums">{uptimeDisplay || "..."}</span>
                    <div className="flex items-center gap-2 mt-1">
                       <Clock className="w-3 h-3 text-zinc-600" />
                       <span className="text-zinc-600 text-[9px] font-mono">آخر ريستارت: {stats?.serverStartTime ? format(new Date(stats.serverStartTime), "yyyy/MM/dd HH:mm", { locale: ar }) : "---"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: "زوار الآن", value: stats?.onlineUsers || 0, icon: Users, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", indicator: "bg-emerald-500" },
                  { label: "المصادر", value: stats?.channelsCount || 0, icon: Globe, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", indicator: "bg-blue-500" },
                  { label: "الأصول", value: stats?.termsCount || 0, icon: Layers, bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", indicator: "bg-purple-500" },
                  { label: "الذاكرة", value: stats?.memoryUsage ? (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(0) + "MB" : "---", icon: Zap, bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", indicator: "bg-amber-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 relative overflow-hidden group hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.text} border ${stat.border} shadow-lg`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${stat.indicator} animate-pulse`}></div>
                    </div>
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">{stat.label}</p>
                    <h3 className="text-2xl md:text-3xl font-black text-white font-mono">{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8">
                  <h2 className="text-lg md:text-xl font-black mb-6 md:mb-8 flex items-center gap-3">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                    كفاءة النظام (Performance)
                  </h2>
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-slate-800/60">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 text-xs md:text-sm">استهلاك الذاكرة (Memory)</span>
                        <span className="text-white text-xs md:text-sm font-mono font-bold">
                          {stats?.memoryUsage ? (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(1) : 0} MB
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: stats?.memoryUsage ? `${(stats.memoryUsage.heapUsed / stats.memoryUsage.heapTotal) * 100}%` : 0 }}
                          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-slate-800/60">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-xs md:text-sm">حالة آخر تحديث تلقائي</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${stats && stats.minutesSinceLastScrape > 720 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                           {stats && stats.minutesSinceLastScrape > 720 ? 'Stale' : 'Active'}
                        </span>
                      </div>
                      <p className="text-lg md:text-xl font-bold text-white mb-2">
                         منذ {stats?.minutesSinceLastScrape || 0} دقيقة
                      </p>
                      <p className="text-[10px] md:text-xs text-zinc-600 font-mono">
                        {stats?.lastSuccessfulScrape ? format(new Date(stats.lastSuccessfulScrape), "eeee dd MMMM - HH:mm", { locale: ar }) : "---"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Database Stats */}
                {stats?.dbStats && (
                  <section className="glass-panel-heavy premium-border border border-slate-700/50 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                    <div className="relative">
                      <h2 className="text-lg md:text-xl font-black flex items-center gap-3 text-white mb-6 md:mb-8">
                        <Layers className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                        إحصائيات قاعدة البيانات
                      </h2>
                      
                      <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-white/[0.02] border border-slate-800/60 p-4 md:p-6 rounded-3xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">سجلات الأسعار</p>
                          <p className="text-xl md:text-2xl font-black text-white font-mono">{stats.dbStats.parallelRatesCount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-slate-800/60 p-4 md:p-6 rounded-3xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">السعر الرسمي</p>
                          <p className="text-xl md:text-2xl font-black text-white font-mono">{stats.dbStats.officialRatesCount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-slate-800/60 p-4 md:p-6 rounded-3xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">سجل التغيرات</p>
                          <p className="text-xl md:text-2xl font-black text-blue-400 font-mono">{stats.dbStats.priceChangesCount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-slate-800/60 p-4 md:p-6 rounded-3xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">سجلات الأخطاء</p>
                          <p className="text-xl md:text-2xl font-black text-rose-400 font-mono">{stats.dbStats.errorLogsCount.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-slate-800/60">
                        <button 
                          onClick={handleCleanup}
                          disabled={loading}
                          className={`w-full py-3 md:py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all text-xs md:text-sm ${
                            confirmCleanup 
                              ? 'bg-rose-500 text-black shadow-lg shadow-rose-500/20' 
                              : 'bg-white/5 text-slate-400 hover:text-white border border-slate-800/60'
                          }`}
                        >
                          <Trash2 className="w-4 h-4 md:w-5 h-5" />
                          {confirmCleanup ? 'تأكيد تنظيف البيانات؟' : 'تنظيف البيانات القديمة'}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Telegram Poster */}
                <div className="mt-8">
                  <TelegramPoster token={token} />
                </div>
              </div>
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
                      className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${
                        confirmClearChanges 
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                          : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/10'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {confirmClearChanges ? 'تأكيد المسح؟' : 'تنظيف السجل'}
                    </button>
                    <button 
                      onClick={fetchRecentChanges}
                      className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all border border-slate-800/60"
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
                                {format(new Date(change.timestamp), "yyyy-MM-dd HH:mm:ss")}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500/70">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true, locale: ar })}
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

          {activeTab === 'messages' && <AdminMessages token={token} />}

          {activeTab === 'tracking' && <AdminTracking token={token} />}
                    {activeTab === 'report' && <AdminReport token={token} />}
          {activeTab === 'logs' && <AdminLogs token={token} setError={setError} setSuccess={setSuccess} />}
          {activeTab === 'ai' && <AdminAI token={token} config={config} setError={setError} setSuccess={setSuccess} triggerRefresh={triggerRefresh} decodeData={decodeData} />}

          {activeTab === 'telegram' && <AdminTelegram token={token} config={config} setConfig={setConfig} setError={setError} setSuccess={setSuccess} handleSave={handleSave} />}

          {activeTab === 'broadcast-log' && <AdminBroadcastLog token={token} />}

          {activeTab === 'database' && <AdminDatabase token={token} config={config} />}

          {activeTab === 'tools' && <AdminTools token={token} setError={setError} setSuccess={setSuccess} />}

        </AnimatePresence>
      </main>

      {/* Floating Status Bar - Bottom (Desktop Only) */}
      <footer className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-fit">
         <div className="bg-black/80 backdrop-blur-2xl border border-slate-700/50 px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
               <span className="text-[10px] font-black uppercase text-slate-400">System Ready</span>
            </div>
            <div className="w-px h-3 bg-slate-800"></div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
               <span className="uppercase text-zinc-600">Instance:</span>
               <span className="text-emerald-500/70 font-bold">NODE_PROD_1</span>
            </div>
            <div className="w-px h-3 bg-slate-800"></div>
             <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
               <span className="uppercase text-zinc-600">Region:</span>
               <span className="text-blue-500/70 font-bold">GER_FRA_01</span>
            </div>
         </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#080808]/90 backdrop-blur-xl border-t border-slate-700/50 z-[100] px-6 py-3 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'الرئيسية' },
          { id: 'database', icon: Database, label: 'البيانات' },
          { id: 'config', icon: Settings, label: 'الإعدادات' },
          { id: 'logs', icon: AlertTriangle, label: 'الأخطاء' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'text-emerald-400' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className={`p-2 rounded-xl ${activeTab === item.id ? 'bg-emerald-500/10' : 'bg-transparent'}`}>
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5]' : ''}`} />
            </div>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
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
                <span className="font-bold text-sm tracking-tight">{success || error}</span>
              </div>
              <button 
                onClick={() => { setSuccess(""); setError(""); }}
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
  );
}
