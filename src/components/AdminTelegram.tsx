import React, { useState } from "react";
import { motion } from "motion/react";
import { Globe, RefreshCw, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { TelegramDetailedStatus } from "./TelegramDetailedStatus";

interface AdminTelegramProps {
  token: string;
  config: any;
  setConfig: (config: any) => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  handleSave: () => void;
}

export function AdminTelegram({ token, config, setConfig, setError, setSuccess, handleSave }: AdminTelegramProps) {
  // Telegram Auth State
  const [tgPhoneNumber, setTgPhoneNumber] = useState("");
  const [tgApiId, setTgApiId] = useState("");
  const [tgApiHash, setTgApiHash] = useState("");
  const [tgCode, setTgCode] = useState("");
  const [tgPassword, setTgPassword] = useState("");
  const [tgAuthId, setTgAuthId] = useState("");
  const [tgPhoneCodeHash, setTgPhoneCodeHash] = useState("");
  const [tgStep, setTgStep] = useState<'init' | 'code' | 'password'>('init');
  const [tgLoading, setTgLoading] = useState(false);

  const handleTgSendCode = async () => {
    setTgLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/telegram/send-code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber: tgPhoneNumber, apiId: tgApiId, apiHash: tgApiHash })
      });
      const data = await res.json();
      if (data.success) {
        setTgPhoneCodeHash(data.phoneCodeHash);
        setTgAuthId(data.authId);
        setTgStep('code');
        setSuccess("تم إرسال الكود بنجاح");
      } else {
        setError(data.message || "فشل إرسال الكود");
      }
    } catch (err) {
      setError("خطأ في الاتصال بالسيرفر");
    }
    setTgLoading(false);
  };

  const handleTgVerifyCode = async () => {
    setTgLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/telegram/verify-code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phoneNumber: tgPhoneNumber, 
          phoneCodeHash: tgPhoneCodeHash, 
          code: tgCode, 
          password: tgPassword,
          authId: tgAuthId
        })
      });
      const data = await res.json();
      if (data.success) {
        const newConfig = { 
          ...config, 
          telegramApiId: parseInt(tgApiId, 10), 
          telegramApiHash: tgApiHash, 
          telegramSessionString: data.sessionString 
        };
        setConfig(newConfig);
        
        const saveRes = await fetch("/api/admin/config", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newConfig)
        });
        
        if (saveRes.ok) {
          setSuccess("تم ربط حساب تليجرام بنجاح وحفظ الإعدادات");
          setTgStep('init');
          setTgPhoneNumber("");
          setTgCode("");
          setTgPassword("");
        } else {
          setError("تم الربط ولكن فشل حفظ الإعدادات");
        }
      } else {
        if (data.message && data.message.includes('2FA')) {
          setTgStep('password');
          setError("مطلوب كلمة مرور التحقق بخطوتين");
        } else {
          setError(data.message || "فشل التحقق من الكود");
        }
      }
    } catch (err) {
      setError("خطأ في الاتصال بالسيرفر");
    }
    setTgLoading(false);
  };

  return (
    <motion.div 
      key="telegram"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <section className="bg-white/[0.02] border border-slate-800/60 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Globe className="w-8 h-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white mb-1">إعدادات النشر (تيليجرام / فيسبوك)</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              قم بضبط حسابات النشر التلقائي للأسعار على القنوات والصفحات.
            </p>
          </div>
        </div>

        {config?.telegramSessionString && (
          <div className="mb-6">
            <TelegramDetailedStatus />
            <div className="mt-4 flex justify-end">
              <button
                onClick={async () => {
                  if (window.confirm("هل أنت متأكد من إلغاء ربط الحساب؟")) {
                    try {
                      const newConfig = { ...config, telegramSessionString: "" };
                      setConfig(newConfig);
                      await fetch("/api/admin/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify(newConfig)
                      });
                      setSuccess("تم إلغاء ربط الحساب");
                    } catch (err) {
                      console.error("Failed to unbind account:", err);
                      setError("فشل إلغاء ربط الحساب");
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors font-bold text-sm"
              >
                إلغاء الربط
              </button>
            </div>
          </div>
        )}
        
        {/* Auto Post Settings */}
        <div className="mt-8 space-y-6">
          <h3 className="text-xl font-bold text-white mb-4">إعدادات النشر التلقائي عبر تيليجرام</h3>
          <div className="bg-black/20 border border-slate-800/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">النشر التلقائي للأسعار</p>
                <p className="text-sm text-slate-500">نشر تحديثات الأسعار تلقائياً عند تغييرها</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={config?.telegramAutoPost || false}
                  onChange={(e) => {
                    const newConfig = { ...config, telegramAutoPost: e.target.checked };
                    setConfig(newConfig);
                  }}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">رابط القناة للذكاء الاصطناعي</label>
              <input
                type="text"
                value={config?.telegramPostChannel || ''}
                onChange={(e) => setConfig({ ...config, telegramPostChannel: e.target.value })}
                placeholder="مثال: https://t.me/djheih2026 أو @djheih2026"
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                dir="ltr"
              />
              <p className="text-xs text-slate-500 mt-2">انسخ الرابط أو ضع المعرف، ويجب أن يكون حسابك لديه صلاحيات النشر (أدمن).</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">تنسيق رسالة النشر (قالب النشر تلقائي/تجريبي)</label>
              <select
                value={config?.telegramTemplateStyle || 'classic'}
                onChange={(e) => setConfig({ ...config, telegramTemplateStyle: e.target.value })}
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                dir="rtl"
              >
                <option value="random" className="bg-slate-900/80 text-white text-emerald-400 font-bold">اختيار عشوائي ذكي 🎲 (ينصح به لكسر الروتين)</option>
                <option value="classic" className="bg-slate-900/80 text-white">النمط الكلاسيكي 📊 (تفصيلي بالأسعار السابقة)</option>
                <option value="modern" className="bg-slate-900/80 text-white">النمط الحديث 📈 (مؤشر نسب التغيير)</option>
                <option value="professional" className="bg-slate-900/80 text-white">النمط المهني 💎 (الأكثر احترافية للاقتصاد)</option>
                <option value="compact" className="bg-slate-900/80 text-white">النمط المختصر ⚡ (سريع القراءة)</option>
                <option value="market_alert" className="bg-slate-900/80 text-white">نمط جرس السوق 🔔 (مختصر للمتداولين)</option>
                <option value="elegant" className="bg-slate-900/80 text-white">النمط الأنيق ⚜️ (تصميم جمالي وجذاب)</option>
              </select>
            </div>
            
            {/* Telegram Sensor Status */}
            {config?.telegramBroadcastStatus && (
              <div className={`p-4 rounded-xl border ${config.telegramBroadcastStatus.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-2 h-2 rounded-full ${config.telegramBroadcastStatus.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                   <h4 className="font-bold text-white">حساس نشر تيليجرام (Telegram Sensor)</h4>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-slate-300">
                     <span className="text-slate-500">الحالة:</span> 
                     <span className={config.telegramBroadcastStatus.status === 'ok' ? 'text-emerald-400 mr-2' : 'text-red-400 mr-2'}>
                        {config.telegramBroadcastStatus.status === 'ok' ? 'يعمل بشكل سليم' : 'يوجد تعثر'}
                     </span>
                  </p>
                  {config.telegramBroadcastStatus.lastSuccessTime && (
                    <p className="text-slate-300">
                       <span className="text-slate-500">آخر نجاح:</span> 
                       <span className="mr-2" dir="ltr">{new Date(config.telegramBroadcastStatus.lastSuccessTime).toLocaleString('ar-LY')}</span>
                    </p>
                  )}
                  {config.telegramBroadcastStatus.status === 'error' && config.telegramBroadcastStatus.lastError && (
                    <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/30 text-red-400 text-xs text-left" dir="ltr">
                       {config.telegramBroadcastStatus.lastError}
                       {config.telegramBroadcastStatus.lastErrorTime && (
                          <div className="text-slate-500 mt-1">Time: {new Date(config.telegramBroadcastStatus.lastErrorTime).toLocaleString('en-US')}</div>
                       )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-800/60">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/telegram/publish-analysis", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ channel: config?.telegramPostChannel })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSuccess("تم إرسال ونشر رؤية السوق بنجاح!");
                    } else {
                      setError(data.error || "فشل إرسال رؤية السوق");
                    }
                  } catch (err: any) {
                    setError("فشل في الاتصال بالخادم");
                  }
                }}
                className="px-6 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-bold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Sparkles className="w-4 h-4" />
                نشر رؤية السوق ذكية
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/telegram/test-broadcast", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ channel: config?.telegramPostChannel })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSuccess("تم إرسال المنشور التجريبي بنجاح!");
                    } else {
                      setError(data.error || "فشل إرسال المنشور التجريبي");
                    }
                  } catch (err: any) {
                    setError("فشل في الاتصال بالخادم");
                  }
                }}
                className="px-6 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors flex items-center justify-center text-sm sm:text-base"
              >
                إرسال رسالة اختبارية
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center justify-center text-sm sm:text-base"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
        
        {/* Facebook Auto Post Settings */}
        <div className="mt-12 space-y-6">
          <h3 className="text-xl font-bold text-white mb-4">إعدادات النشر التلقائي - فيسبوك</h3>
          <div className="bg-black/20 border border-slate-800/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">النشر التلقائي على فيسبوك</p>
                <p className="text-sm text-slate-500">نشر التحديثات لصفحة فيسبوك</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={config?.facebookAutoPost || false}
                  onChange={(e) => {
                    setConfig({ ...config, facebookAutoPost: e.target.checked });
                  }}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Facebook Page ID</label>
              <input
                type="text"
                value={config?.facebookPageId || ''}
                onChange={(e) => setConfig({ ...config, facebookPageId: e.target.value })}
                placeholder="123456789"
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Facebook Access Token</label>
              <input
                type="password"
                value={config?.facebookAccessToken || ''}
                onChange={(e) => setConfig({ ...config, facebookAccessToken: e.target.value })}
                placeholder="EAABw..."
                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                dir="ltr"
              />
            </div>
            
            {/* Facebook Sensor Status */}
            {config?.facebookBroadcastStatus && (
              <div className={`p-4 rounded-xl border ${config.facebookBroadcastStatus.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-2 h-2 rounded-full ${config.facebookBroadcastStatus.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                   <h4 className="font-bold text-white">حساس حالة النشر (Facebook Sensor)</h4>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-slate-300">
                     <span className="text-slate-500">الحالة:</span> 
                     <span className={config.facebookBroadcastStatus.status === 'ok' ? 'text-emerald-400 mr-2' : 'text-red-400 mr-2'}>
                        {config.facebookBroadcastStatus.status === 'ok' ? 'يعمل بشكل سليم' : 'يوجد خطأ'}
                     </span>
                  </p>
                  {config.facebookBroadcastStatus.lastSuccessTime && (
                    <p className="text-slate-300">
                       <span className="text-slate-500">آخر نجاح:</span> 
                       <span className="mr-2" dir="ltr">{new Date(config.facebookBroadcastStatus.lastSuccessTime).toLocaleString('ar-LY')}</span>
                    </p>
                  )}
                  {config.facebookBroadcastStatus.status === 'error' && config.facebookBroadcastStatus.lastError && (
                    <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/30 text-red-400 text-xs text-left" dir="ltr">
                       {config.facebookBroadcastStatus.lastError}
                       {config.facebookBroadcastStatus.lastErrorTime && (
                          <div className="text-slate-500 mt-1">Time: {new Date(config.facebookBroadcastStatus.lastErrorTime).toLocaleString('en-US')}</div>
                       )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-800/60">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/facebook/test-broadcast", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSuccess("تم إرسال المنشور التجريبي لفيسبوك بنجاح!");
                    } else {
                      setError(data.error || "فشل إرسال المنشور التجريبي لفيسبوك");
                    }
                  } catch (err: any) {
                    setError("فشل في الاتصال بالخادم");
                  }
                }}
                className="px-6 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors flex items-center justify-center text-sm sm:text-base"
              >
                إرسال أسعار الحالية فيسبوك
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center justify-center text-sm sm:text-base"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>

        {!config?.telegramSessionString && (
          <div className="max-w-xl mx-auto space-y-6 mt-12 bg-white/[0.02] p-8 border border-slate-800/60 rounded-3xl">
            <h3 className="text-xl font-bold text-white mb-4">ربط حساب لأول مرة</h3>
            
            {tgStep === 'init' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">API ID</label>
                  <input
                    type="text"
                    value={tgApiId}
                    onChange={(e) => setTgApiId(e.target.value)}
                    placeholder="مثال: 1234567"
                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">API Hash</label>
                  <input
                    type="text"
                    value={tgApiHash}
                    onChange={(e) => setTgApiHash(e.target.value)}
                    placeholder="مثال: 0123456789abcdef"
                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">رقم الهاتف (مع رمز الدولة)</label>
                  <input
                    type="text"
                    value={tgPhoneNumber}
                    onChange={(e) => setTgPhoneNumber(e.target.value)}
                    placeholder="مثال: +218912345678"
                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleTgSendCode}
                  disabled={tgLoading || !tgPhoneNumber || !tgApiId || !tgApiHash}
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {tgLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  إرسال كود التحقق
                </button>
              </div>
            )}
            
            {tgStep === 'code' && (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-4 text-sm text-blue-400">
                  تم إرسال كود التحقق إلى تطبيق تليجرام الخاص بك ({tgPhoneNumber}).
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">كود التحقق</label>
                  <input
                    type="text"
                    value={tgCode}
                    onChange={(e) => setTgCode(e.target.value)}
                    placeholder="أدخل الكود المكون من 5 أرقام"
                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-center tracking-[0.5em] font-mono text-lg"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setTgStep('init')}
                    className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                  >
                    رجوع
                  </button>
                  <button
                    onClick={handleTgVerifyCode}
                    disabled={tgLoading || !tgCode}
                    className="flex-1 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {tgLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    تأكيد الكود
                  </button>
                </div>
              </div>
            )}
            
            {tgStep === 'password' && (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-4 text-sm text-amber-400">
                  هذا الحساب محمي بكلمة مرور التحقق بخطوتين (2FA). يرجى إدخالها للمتابعة.
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">كلمة المرور (2FA)</label>
                  <input
                    type="password"
                    value={tgPassword}
                    onChange={(e) => setTgPassword(e.target.value)}
                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 text-center font-mono text-lg"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setTgStep('init')}
                    className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleTgVerifyCode}
                    disabled={tgLoading || !tgPassword}
                    className="flex-1 py-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {tgLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    تحقق
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </motion.div>
  );
}
