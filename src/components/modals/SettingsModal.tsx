import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings2, X, RefreshCw, CheckCircle2, Bell, Palette, Volume2, Smartphone } from "lucide-react";
import { safeStorage } from "../../utils/storage";
import { purgeAllCachesAndReload } from "../../utils/autoUpdater";
import { useDialogAccessibility } from "../../hooks/useDialogAccessibility";
import { ThemeToggle } from "../ui/ThemeToggle";

interface SettingsModalProps {
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  settingsTab: 'general' | 'notifications' | 'appearance';
  setSettingsTab: (tab: 'general' | 'notifications' | 'appearance') => void;
  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  requestNotificationPermission: () => void;
  notificationThreshold: number;
  setNotificationThreshold: (val: number) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  fontSizePreference: 'small' | 'medium' | 'large';
  setFontSizePreference: (val: 'small' | 'medium' | 'large') => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  addToast: (title: string, body: string, type: 'up' | 'down' | 'info') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettingsModal, setShowSettingsModal, settingsTab, setSettingsTab,
  hapticEnabled, setHapticEnabled, soundEnabled, setSoundEnabled,
  notificationsEnabled, requestNotificationPermission, notificationThreshold, setNotificationThreshold,
  compactMode, setCompactMode, animationsEnabled, setAnimationsEnabled,
  fontSizePreference, setFontSizePreference, triggerHaptic, addToast,
}) => {
  const dialogRef = useDialogAccessibility(showSettingsModal, () => setShowSettingsModal(false));
  const notificationPermission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  const tabs = [
    { id: 'general', label: 'عام', icon: Settings2 },
    { id: 'notifications', label: 'التنبيهات', icon: Bell },
    { id: 'appearance', label: 'المظهر', icon: Palette },
  ] as const;

  useEffect(() => {
    const saved = Number(safeStorage.getItem('notificationThreshold'));
    if (Number.isFinite(saved) && saved >= 0.001 && saved <= 0.1) setNotificationThreshold(saved);
  }, [setNotificationThreshold]);

  return (
    <AnimatePresence>
      {showSettingsModal && (
        <div className="settings-overlay">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSettingsModal(false)} className="settings-backdrop" />
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title"
            tabIndex={-1} className="settings-dialog" dir="rtl"
          >
            <div className="settings-header">
              <div><h2 id="settings-dialog-title">الإعدادات</h2><p>تفضيلات هذا الجهاز</p></div>
              <button aria-label="إغلاق الإعدادات" onClick={() => setShowSettingsModal(false)} className="settings-close">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div role="tablist" aria-label="أقسام الإعدادات" className="settings-tabs"
              onKeyDown={event => {
                const index = tabs.findIndex(tab => tab.id === settingsTab);
                const next = event.key === 'ArrowLeft' ? (index + 1) % tabs.length :
                  event.key === 'ArrowRight' ? (index + tabs.length - 1) % tabs.length :
                  event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                setSettingsTab(tabs[next].id);
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
              }}
            >
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} id={`settings-tab-${id}`} role="tab"
                  aria-selected={settingsTab === id} aria-controls={`settings-panel-${id}`}
                  tabIndex={settingsTab === id ? 0 : -1} onClick={() => setSettingsTab(id)}>
                  <Icon size={18} aria-hidden="true" /><span>{label}</span>
                </button>
              ))}
            </div>

            <div className="settings-content" role="tabpanel" id={`settings-panel-${settingsTab}`}
              aria-labelledby={`settings-tab-${settingsTab}`} tabIndex={0}>
              {settingsTab === 'general' && (
                <>
                  <div className="settings-row">
                    <Volume2 className="settings-row-icon" aria-hidden="true" />
                    <div className="settings-copy"><h3>المؤثرات الصوتية</h3><p>صوت عند تغيّر الأسعار أثناء فتح الموقع</p></div>
                    <button role="switch" aria-label="المؤثرات الصوتية" aria-checked={soundEnabled} className="settings-switch"
                      onClick={() => { setSoundEnabled(!soundEnabled); safeStorage.setItem('soundEnabled', String(!soundEnabled)); triggerHaptic(10); }}>
                      <span><span /></span>
                    </button>
                  </div>
                  <div className="settings-row">
                    <Smartphone className="settings-row-icon" aria-hidden="true" />
                    <div className="settings-copy"><h3>الاهتزاز</h3><p>استجابة خفيفة للمس على الأجهزة الداعمة</p></div>
                    <button role="switch" aria-label="الاهتزاز" aria-checked={hapticEnabled} className="settings-switch"
                      onClick={() => {
                        setHapticEnabled(!hapticEnabled);
                        safeStorage.setItem('hapticEnabled', String(!hapticEnabled));
                        if (!hapticEnabled && navigator.vibrate) navigator.vibrate(10);
                      }}>
                      <span><span /></span>
                    </button>
                  </div>
                  <details className="settings-maintenance">
                    <summary>إصلاح مشاكل العرض</summary>
                    <div>
                      <button className="settings-repair" onClick={() => {
                        triggerHaptic(10);
                        addToast('جاري التحديث', 'يتم الآن مسح الذاكرة المؤقتة وتحديث التطبيق...', 'info');
                        setTimeout(() => { purgeAllCachesAndReload(); }, 300);
                      }}><RefreshCw size={18} aria-hidden="true" />مسح الكاش وإعادة فتح الموقع</button>
                      <p>يحذف البيانات المؤقتة ويعيد تحميل الصفحة، مع الاحتفاظ بتفضيلاتك.</p>
                    </div>
                  </details>
                </>
              )}

              {settingsTab === 'notifications' && (
                <>
                  <div className="settings-permission">
                    {notificationsEnabled ? <CheckCircle2 aria-hidden="true" /> : <Bell aria-hidden="true" />}
                    <div className="settings-copy">
                      <h3>إشعارات المتصفح</h3>
                      <p>{notificationPermission === 'unsupported' ? 'غير مدعومة في هذا المتصفح' :
                        notificationPermission === 'denied' ? 'محظورة من إعدادات المتصفح' :
                        notificationsEnabled ? 'مفعّلة على هذا الجهاز' : 'لم يتم تفعيلها بعد'}</p>
                    </div>
                    {!notificationsEnabled && notificationPermission === 'default' && (
                      <button className="settings-enable" onClick={requestNotificationPermission}>تفعيل</button>
                    )}
                  </div>
                  <div className="settings-threshold">
                    <div><label htmlFor="settings-threshold">الحد الأدنى لتغيّر السعر</label>
                      <output htmlFor="settings-threshold">{notificationThreshold.toFixed(3)} د.ل</output></div>
                    <input id="settings-threshold" type="range" min="0.001" max="0.1" step="0.001"
                      value={notificationThreshold} aria-label="حساسية التنبيه"
                      aria-valuetext={`${notificationThreshold.toFixed(3)} دينار ليبي`}
                      onChange={event => {
                        const value = Number(event.target.value);
                        setNotificationThreshold(value);
                        safeStorage.setItem('notificationThreshold', String(value));
                      }} />
                    <div className="settings-range-labels"><span>0.001 د.ل</span><span>0.100 د.ل</span></div>
                    <p>حدّ تنبيهات تغيّر الأسعار أثناء فتح الموقع.</p>
                  </div>
                </>
              )}

              {settingsTab === 'appearance' && (
                <>
                  <div className="settings-row">
                    <div className="settings-copy"><h3>الوضع الليلي والنهاري</h3></div><ThemeToggle />
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-font-size">حجم الخط</label>
                    <select id="settings-font-size" aria-label="حجم الخط" value={fontSizePreference}
                      onChange={event => {
                        const value = event.target.value as 'small' | 'medium' | 'large';
                        setFontSizePreference(value); safeStorage.setItem('fontSizePreference', value); triggerHaptic(10);
                      }}>
                      <option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy"><h3>الوضع المضغوط</h3><p>مسافات أقل في بطاقات الأسعار</p></div>
                    <button role="switch" aria-label="الوضع المضغوط" aria-checked={compactMode} className="settings-switch"
                      onClick={() => { setCompactMode(!compactMode); safeStorage.setItem('compactMode', String(!compactMode)); triggerHaptic(10); }}>
                      <span><span /></span>
                    </button>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy"><h3>الحركات والانتقالات</h3></div>
                    <button role="switch" aria-label="الحركة" aria-checked={animationsEnabled} className="settings-switch"
                      onClick={() => { setAnimationsEnabled(!animationsEnabled); safeStorage.setItem('animationsEnabled', String(!animationsEnabled)); triggerHaptic(10); }}>
                      <span><span /></span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="settings-footer">
              <span><CheckCircle2 size={16} aria-hidden="true" />تُحفظ التفضيلات تلقائيًا</span>
              <button onClick={() => setShowSettingsModal(false)}>تم</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
