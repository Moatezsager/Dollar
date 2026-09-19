import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Zap, RefreshCw, Activity, CheckCircle2, XCircle, Shield, Settings, Server, Crown, Save } from 'lucide-react';

interface AdminAPIProps {
  token: string;
  config: any;
  setConfig: (config: any) => void;
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

export function AdminAPI({ token, config, setConfig }: AdminAPIProps) {
  const [apiStatsData, setApiStatsData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchApiStats = async () => {
    try {
      const res = await fetchWithTimeout("/api/admin/api-stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiStatsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch API stats", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchApiStats();
    }
  }, [token]);

  const handleSaveApiConfig = async () => {
    setSaving(true);
    try {
      const res = await fetchWithTimeout("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          premiumApiKeys: config?.premiumApiKeys || [],
          apiRateLimitWindow: config?.apiRateLimitWindow || 15,
          apiRateLimitMax: config?.apiRateLimitMax || 100
        })
      });
      if (res.ok) {
        alert("تم حفظ إعدادات API بنجاح");
      } else {
        alert("فشل حفظ إعدادات API");
      }
    } catch (err) {
      alert("خطأ في الاتصال");
    }
    setSaving(false);
  };

  return (
    <motion.div
      key="api"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">المطورين و API</h2>
          <p className="text-slate-400 mt-2">إدارة واجهة برمجة التطبيقات للمطورين والإحصائيات</p>
        </div>
        <button
          onClick={async () => {
            setRefreshing(true);
            await fetchApiStats();
            setRefreshing(false);
          }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <div className="space-y-8">
        {/* Public API Stats */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            إحصائيات الرابط المجاني (Public API)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-slate-400 font-medium">إجمالي الطلبات (Total)</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.public?.totalRequests || 0}</p>
            </div>
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-slate-400 font-medium">الطلبات الناجحة</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.public?.successfulRequests || 0}</p>
            </div>
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-slate-400 font-medium">الطلبات الفاشلة</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.public?.failedRequests || 0}</p>
            </div>
          </div>
        </div>

        {/* Premium API Stats */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Crown className="w-5 h-5" />
            إحصائيات الرابط المدفوع (Premium API)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-slate-400 font-medium">إجمالي الطلبات (Total)</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.premium?.totalRequests || 0}</p>
            </div>
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-slate-400 font-medium">الطلبات الناجحة</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.premium?.successfulRequests || 0}</p>
            </div>
            <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-slate-400 font-medium">الطلبات الفاشلة</h3>
              </div>
              <p className="text-3xl font-black text-white">{apiStatsData?.premium?.failedRequests || 0}</p>
            </div>
          </div>
        </div>

        {/* Security Stats */}
        <div className="bg-slate-900/80/50 border border-slate-800/60 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <h3 className="text-slate-400 font-medium">عناوين IP المحظورة (Rate Limit)</h3>
          </div>
          <p className="text-3xl font-black text-white">{apiStatsData?.bannedIPsCount || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-slate-900/80/50 border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-white">إعدادات API</h3>
            </div>
            <button
              onClick={handleSaveApiConfig}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الإعدادات
            </button>
          </div>
          <div className="p-6 space-y-6 flex-1">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400">فترة الـ Rate Limit (بالدقائق)</label>
              <input
                type="number"
                value={config?.apiRateLimitWindow || 15}
                onChange={(e) => setConfig({ ...config, apiRateLimitWindow: parseInt(e.target.value) || 15 })}
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400">الحد الأقصى للطلبات المجانية (لكل IP)</label>
              <input
                type="number"
                value={config?.apiRateLimitMax || 100}
                onChange={(e) => setConfig({ ...config, apiRateLimitMax: parseInt(e.target.value) || 100 })}
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            
            <div className="pt-4 border-t border-slate-800/60 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-400">مفاتيح الوصول المدفوعة (Premium Keys)</label>
                <button
                  onClick={() => setConfig({ ...config, premiumApiKeys: [...(config?.premiumApiKeys || []), ""] })}
                  className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white"
                >
                  + إضافة مفتاح
                </button>
              </div>
              <div className="space-y-3">
                {config?.premiumApiKeys?.map((key: string, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newKeys = [...(config?.premiumApiKeys || [])];
                        newKeys[idx] = e.target.value;
                        setConfig({ ...config, premiumApiKeys: newKeys });
                      }}
                      className="flex-1 bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50"
                      placeholder="ad_..."
                    />
                    <button
                      onClick={() => {
                        const newKeys = [...(config?.premiumApiKeys || [])];
                        newKeys.splice(idx, 1);
                        setConfig({ ...config, premiumApiKeys: newKeys });
                      }}
                      className="px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80/50 border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
            <Server className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-bold text-white">روابط الـ API</h3>
          </div>
          <div className="p-6 space-y-6 flex-1">
            <div className="space-y-2">
              <label className="text-sm font-bold text-emerald-400">الرابط المجاني (للمطورين)</label>
              <div className="bg-black/50 p-4 rounded-xl border border-emerald-500/20 font-mono text-xs text-slate-300 break-all select-all relative group cursor-pointer hover:bg-black/80 transition-colors">
                https://{window.location.hostname}/api/rates
              </div>
              <p className="text-xs text-slate-500 mt-1">يخضع للـ Rate Limit (100 طلب لكل 15 دقيقة)</p>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-slate-800/60">
              <label className="text-sm font-bold text-amber-400">الرابط المدفوع (بدون Rate Limit)</label>
              <div className="bg-black/50 p-4 rounded-xl border border-amber-500/20 font-mono text-xs text-slate-300 break-all select-all cursor-pointer hover:bg-black/80 transition-colors">
                https://{window.location.hostname}/api/premium-rates?key=YOUR_PREMIUM_KEY
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
