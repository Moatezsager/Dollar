import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings2, X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { safeStorage } from "../../utils/storage";
import { purgeAllCachesAndReload } from "../../utils/autoUpdater";

interface SettingsModalProps {
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  showChart: boolean;
  setShowChart: (show: boolean) => void;
  notificationsEnabled: boolean;
  requestNotificationPermission: () => void;
  notificationThreshold: number;
  setNotificationThreshold: (val: number) => void;
  majorChangesOnly: boolean;
  setMajorChangesOnly: (val: boolean) => void;
  dailySummaryEnabled: boolean;
  setDailySummaryEnabled: (val: boolean) => void;
  goldNotificationsEnabled: boolean;
  setGoldNotificationsEnabled: (val: boolean) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  fontSizePreference: 'small' | 'medium' | 'large';
  setFontSizePreference: (val: 'small' | 'medium' | 'large') => void;
  dataSaver: boolean;
  setDataSaver: (val: boolean) => void;
  defaultMarket: 'parallel' | 'official';
  setDefaultMarket: (val: 'parallel' | 'official') => void;
  chartResolution: 'low' | 'medium' | 'high';
  setChartResolution: (val: 'low' | 'medium' | 'high') => void;
  spreadAlertEnabled: boolean;
  setSpreadAlertEnabled: (val: boolean) => void;
  spreadAlertValue: number;
  setSpreadAlertValue: (val: number) => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  addToast: (title: string, body: string, type: 'up' | 'down' | 'info') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettingsModal,
  setShowSettingsModal,
  hapticEnabled,
  setHapticEnabled,
  soundEnabled,
  setSoundEnabled,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  showChart,
  setShowChart,
  notificationsEnabled,
  requestNotificationPermission,
  notificationThreshold,
  setNotificationThreshold,
  majorChangesOnly,
  setMajorChangesOnly,
  dailySummaryEnabled,
  setDailySummaryEnabled,
  goldNotificationsEnabled,
  setGoldNotificationsEnabled,
  compactMode,
  setCompactMode,
  animationsEnabled,
  setAnimationsEnabled,
  fontSizePreference,
  setFontSizePreference,
  dataSaver,
  setDataSaver,
  defaultMarket,
  setDefaultMarket,
  chartResolution,
  setChartResolution,
  spreadAlertEnabled,
  setSpreadAlertEnabled,
  spreadAlertValue,
  setSpreadAlertValue,
  triggerHaptic,
  addToast,
}) => {
  const [settingsTab, setSettingsTab] = useState<'general' | 'notifications' | 'appearance' | 'advanced'>('general');

  return (
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
            className="relative w-full max-w-md glass-panel-heavy premium-border border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl"
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
                        safeStorage.setItem('hapticEnabled', String(newVal));
                        if (newVal && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
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
                        safeStorage.setItem('soundEnabled', String(newVal));
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
                        safeStorage.setItem('autoRefreshEnabled', String(newVal));
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
                        safeStorage.setItem('showChart', String(newVal));
                        triggerHaptic(10);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${showChart ? 'bg-indigo-500 justify-end' : 'bg-zinc-700 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>

                  {/* Clear Cache & Auto-Update */}
                  <div className="pt-4 border-t border-slate-800/60 flex flex-col gap-2">
                    <button
                      onClick={async () => {
                        triggerHaptic(10);
                        addToast('جاري التحديث', 'يتم الآن مسح الذاكرة المؤقتة وتحديث التطبيق...', 'info');
                        setTimeout(() => {
                          purgeAllCachesAndReload();
                        }, 300);
                      }}
                      className="w-full py-3 text-sm font-bold text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>مسح الذاكرة المؤقتة وتحديث الواجهة بالكامل</span>
                    </button>
                    <p className="text-[11px] text-slate-500 text-center">
                      يقوم بحذف الكاش القديم وجلب أحدث كود ونسخة واجهة معتمدة فورياً.
                    </p>
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
                        safeStorage.setItem('majorChangesOnly', String(newVal));
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
                        safeStorage.setItem('dailySummaryEnabled', String(newVal));
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
                        safeStorage.setItem('goldNotificationsEnabled', String(newVal));
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
                        safeStorage.setItem('compactMode', String(newVal));
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
                        safeStorage.setItem('animationsEnabled', String(newVal));
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
                        safeStorage.setItem('fontSizePreference', val);
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
                        safeStorage.setItem('dataSaver', String(newVal));
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
                        safeStorage.setItem('defaultMarket', val);
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
                        safeStorage.setItem('chartResolution', val);
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
                          safeStorage.setItem('spreadAlertEnabled', String(newVal));
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
                              safeStorage.setItem('spreadAlertValue', String(val));
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
  );
};
