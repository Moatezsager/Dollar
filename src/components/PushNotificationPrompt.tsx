import React, {useEffect, useState} from 'react';
import {Bell, X} from 'lucide-react';
import {safeStorage} from '../utils/storage';
import {pushSupport} from '../utils/pushNotifications';
import {RATE_PUSH_MAX_DAILY} from '../../shared/notifications';

export default function PushNotificationPrompt({enabled, busy, error, onEnable, onOpenSettings}: {
  enabled: boolean; busy: boolean; error: string; onEnable: () => void; onOpenSettings: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const support = pushSupport();
  useEffect(() => {
    const dismissed = Number(safeStorage.getItem('pushPromptDismissed_v4')) || 0;
    if (enabled || support === 'denied' || support === 'unsupported' || safeStorage.getItem('pushEnabled') === 'false'
      || Date.now() - dismissed < 30 * 86400000) return;
    const timer = setTimeout(() => { if (document.visibilityState === 'visible') setVisible(true); }, 30000);
    return () => clearTimeout(timer);
  }, [enabled]);
  const dismiss = () => { safeStorage.setItem('pushPromptDismissed_v4', String(Date.now())); setVisible(false); };
  if (!visible || enabled || safeStorage.getItem('pushEnabled') === 'false') return null;
  return <aside className="push-notice" aria-label="إشعارات الجهاز" dir="rtl">
    <Bell size={22} aria-hidden="true" />
    <div><strong>تابع تغيّرات الأسعار المهمة</strong><p>فعّل إشعارات الهاتف؛ حتى {RATE_PUSH_MAX_DAILY} ملخصات أسعار يوميًا، دون صوت. يمكنك إيقافها في أي وقت.</p>
      {error && <p className="settings-notification-error" role="alert">{error}</p>}
      <div className="push-notice-actions"><button type="button" className="push-notice-enable" disabled={busy}
        onClick={support === 'supported' ? onEnable : onOpenSettings}>
        {busy ? 'جارٍ التفعيل...' : support === 'supported' ? 'تفعيل الإشعارات' : 'إعدادات الإشعارات'}</button>
        <button type="button" disabled={busy} onClick={() => { dismiss(); onOpenSettings(); }}>التفضيلات</button></div></div>
    <button type="button" className="push-notice-close" aria-label="عدم تذكيري الآن" onClick={dismiss}><X size={19} /></button>
  </aside>;
}
