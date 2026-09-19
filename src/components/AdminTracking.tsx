import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart3, CheckCircle2, LineChart, Activity, Wifi, XCircle, AlertCircle, MapPin, AppWindow, Smartphone, Monitor, Layout, Search, Filter, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminTrackingProps {
  token: string;
}

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

export function AdminTracking({ token }: AdminTrackingProps) {
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'Mobile' | 'Desktop' | 'Tablet' | 'Bot'>('all');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [expandedUserAgentId, setExpandedUserAgentId] = useState<string | null>(null);

  const fetchAnalyticsDashboard = async () => {
    try {
      const res = await fetch(`/api/admin/analytics?days=${analyticsDays}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.warn("Analytics fetch failed", err);
    }
  };

  const fetchTrackingLogs = async () => {
    fetchAnalyticsDashboard();
    try {
      const res = await fetchWithTimeout("/api/admin/tracking/logs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserLogs(data.logs || []);
      }
    } catch (err) {
      console.warn("Tracking logs fetch failed");
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalyticsDashboard();
      fetchTrackingLogs();
    }
  }, [analyticsDays, token]);

  const normalizedLogs = useMemo(() => {
    return userLogs.map(log => {
      const isOnline = log.isOnline || log.status === 'online';
      const lastSeenStr = log.lastSeen || log.last_active || log.timestamp || new Date().toISOString();
      const lastSeenDate = new Date(lastSeenStr);
      const safeLastSeen = isNaN(lastSeenDate.getTime()) ? new Date() : lastSeenDate;

      let country = log.country || "";
      let city = log.city || "";
      if (!country && log.location && log.location !== "جاري التحديد..." && log.location !== "غير معروف" && log.location !== "تعذر التحديد" && log.location !== "شبكة محلية") {
        const parts = log.location.split(',');
        if (parts.length > 0) country = parts[0].trim();
        if (parts.length > 1) city = parts[1].trim();
      } else if (!country && log.location) {
        country = log.location;
      }

      return {
        ...log,
        status: isOnline ? 'online' : 'offline',
        lastSeen: safeLastSeen.toISOString(),
        sessionCount: log.sessionCount || log.visits || 1,
        pageviews: log.pageviews || log.visits || 1,
        country,
        city
      };
    });
  }, [userLogs]);

  const filteredLogs = useMemo(() => {
    return normalizedLogs.filter(log => {
      const matchesSearch = log.ip.includes(deviceSearchTerm) || (log.userAgent && log.userAgent.toLowerCase().includes(deviceSearchTerm.toLowerCase()));
      const matchesDevice = deviceFilter === 'all' || log.deviceType === deviceFilter;
      const matchesStatus = deviceStatusFilter === 'all' || log.status === deviceStatusFilter;
      return matchesSearch && matchesDevice && matchesStatus;
    });
  }, [normalizedLogs, deviceSearchTerm, deviceFilter, deviceStatusFilter]);

  return (
    <motion.div 
      key="tracking"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Analytics Dashboard Header */}
      <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-slate-700/50 p-6 md:p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
              <BarChart3 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                إحصائيات الزوار (Analytics)
                <span className="flex items-center gap-2 text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {normalizedLogs.filter(l => l.status === 'online').length} مباشر
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                نظام إحصائيات متقدم محمي بالذكاء الاصطناعي ضد الروبوتات (مفلتر بنسبة 100% من روبوتات فيسبوك، تيليجرام وغيرها لضمان أقصى دقة).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={analyticsDays}
              onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
              className="px-4 py-2.5 bg-black/50 border border-slate-700/50 rounded-xl text-white font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="1">آخر 24 ساعة</option>
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
            </select>
            <button 
              onClick={() => { fetchAnalyticsDashboard(); fetchTrackingLogs(); }}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all"
            >
              تحديث البيانات
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Graphs (Recharts) */}
      {analyticsData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Trend Chart */}
          <div className="lg:col-span-2 bg-black/40 border border-slate-700/50 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-emerald-400" />
              الزيارات والزوار (أخر {analyticsDays} أيام)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.trend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#475569" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#475569" fontSize={12} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                  />
                  <Area type="monotone" dataKey="pageviews" name="الزيارات" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPageviews)" />
                  <Area type="monotone" dataKey="visitors" name="الزوار الفريدين" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="space-y-6">
            <div className="bg-black/40 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">إجمالي الزيارات</h3>
              <div className="text-4xl font-black text-emerald-400 mb-1">{analyticsData.summary.totalPageviews.toLocaleString()}</div>
              <p className="text-slate-400 text-sm">صفحة تم عرضها</p>
            </div>
            <div className="bg-black/40 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">إجمالي الزوار</h3>
              <div className="text-4xl font-black text-blue-400 mb-1">{analyticsData.summary.totalVisitors.toLocaleString()}</div>
              <p className="text-slate-400 text-sm">مستخدم فريد</p>
            </div>
          </div>

          {/* Device Breakdown */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/40 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" /> الأجهزة
              </h3>
              <div className="space-y-4">
               {Object.entries(analyticsData.deviceTypes).sort((a:any, b:any) => b[1] - a[1]).map(([device, count]: any) => (
                 <div key={device}>
                   <div className="flex justify-between text-sm mb-1">
                     <span className="text-slate-300">{device}</span>
                     <span className="text-white font-bold">{count.toLocaleString()}</span>
                   </div>
                   <div className="w-full bg-slate-800 rounded-full h-2">
                     <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count / analyticsData.summary.totalPageviews) * 100)}%` }}></div>
                   </div>
                 </div>
               ))}
              </div>
            </div>
            <div className="bg-black/40 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AppWindow className="w-5 h-5 text-blue-400" /> المتصفحات
              </h3>
              <div className="space-y-4">
               {Object.entries(analyticsData.browsers).sort((a:any, b:any) => b[1] - a[1]).slice(0, 5).map(([browser, count]: any) => (
                 <div key={browser}>
                   <div className="flex justify-between text-sm mb-1">
                     <span className="text-slate-300">{browser}</span>
                     <span className="text-white font-bold">{count.toLocaleString()}</span>
                   </div>
                   <div className="w-full bg-slate-800 rounded-full h-2">
                     <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count / analyticsData.summary.totalPageviews) * 100)}%` }}></div>
                   </div>
                 </div>
               ))}
              </div>
            </div>
            <div className="bg-black/40 border border-slate-700/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-purple-400" /> أنظمة التشغيل
              </h3>
              <div className="space-y-4">
               {Object.entries(analyticsData.os).sort((a:any, b:any) => b[1] - a[1]).slice(0, 5).map(([os, count]: any) => (
                 <div key={os}>
                   <div className="flex justify-between text-sm mb-1">
                     <span className="text-slate-300">{os}</span>
                     <span className="text-white font-bold">{count.toLocaleString()}</span>
                   </div>
                   <div className="w-full bg-slate-800 rounded-full h-2">
                     <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(100, (count / analyticsData.summary.totalPageviews) * 100)}%` }}></div>
                   </div>
                 </div>
               ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Detailed Table */}
      <div className="bg-black/40 border border-slate-700/50 rounded-3xl overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> 
            تفاصيل الزوار والجلسات 
            <span className="text-xs bg-slate-800 px-2 py-1 rounded-lg text-slate-400">{filteredLogs.length} سجل</span>
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="بحث بالـ IP أو الوكيل..."
                value={deviceSearchTerm}
                onChange={(e) => setDeviceSearchTerm(e.target.value)}
                className="pl-4 pr-10 py-2 bg-black/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 w-full sm:w-64"
              />
            </div>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value as any)}
              className="px-4 py-2 bg-black/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">كل الأجهزة</option>
              <option value="Mobile">هاتف المحمول</option>
              <option value="Desktop">كمبيوتر مكتبي</option>
              <option value="Tablet">جهاز لوحي</option>
              <option value="Bot">روبوت/زاحف</option>
            </select>
            <select
              value={deviceStatusFilter}
              onChange={(e) => setDeviceStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-black/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">كل الحالات</option>
              <option value="online">مباشر الآن</option>
              <option value="offline">غير متصل</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-bold">الحالة</th>
                <th className="p-4 font-bold">IP الموقع</th>
                <th className="p-4 font-bold">الجهاز والمتصفح</th>
                <th className="p-4 font-bold">الجلسات و النشاط</th>
                <th className="p-4 font-bold text-center">آخر تفاعل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    لا توجد بيانات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${log.status === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                          <span className={`font-bold ${log.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {log.status === 'online' ? 'مباشر' : 'غير متصل'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 group/ip">
                          <span className="font-mono text-slate-300" dir="ltr">{log.ip}</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(log.ip);
                              setCopiedIp(log.ip);
                              setTimeout(() => setCopiedIp(null), 2000);
                            }}
                            className="text-slate-600 hover:text-white transition-colors p-1"
                            title="نسخ IP"
                          >
                            {copiedIp === log.ip ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {log.country && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3 h-3" /> {log.city ? `${log.city}, ` : ''}{log.country}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                            {log.deviceType === 'Mobile' ? <Smartphone className="w-4 h-4" /> : 
                             log.deviceType === 'Desktop' ? <Monitor className="w-4 h-4" /> : 
                             log.deviceType === 'Bot' ? <Layout className="w-4 h-4 text-rose-400" /> : 
                             <AppWindow className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{log.browser} • {log.os}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{log.deviceType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between bg-slate-900/50 px-2 py-1 rounded">
                            <span className="text-slate-500">الجلسات:</span>
                            <span className="font-mono text-blue-400 font-bold">{log.sessionCount || 1}</span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-900/50 px-2 py-1 rounded">
                            <span className="text-slate-500">الصفحات:</span>
                            <span className="font-mono text-purple-400 font-bold">{log.pageviews || 1}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-xs text-slate-300 font-medium">
                          {formatDistanceToNow(new Date(log.lastSeen), { addSuffix: true, locale: ar })}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1" dir="ltr">
                          {new Date(log.lastSeen).toLocaleTimeString()}
                        </div>
                        <button 
                          onClick={() => setExpandedUserAgentId(expandedUserAgentId === log.id ? null : log.id)}
                          className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 mx-auto"
                        >
                          تفاصيل الوكيل {expandedUserAgentId === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                    {expandedUserAgentId === log.id && (
                      <tr className="bg-black/20">
                        <td colSpan={5} className="p-4 border-t border-slate-800/50">
                          <div className="text-xs font-mono text-slate-400 break-all bg-black/50 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 mb-1 block">User Agent:</span>
                            {log.userAgent}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
