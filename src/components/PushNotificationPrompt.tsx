import React, {useEffect, useState} from 'react';
import {Bell, X} from 'lucide-react';
import {safeStorage} from '../utils/storage';
import {pushSupport} from '../utils/pushNotifications';

export default function PushNotificationPrompt({onOpenSettings}: {onOpenSettings: () => void}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const support = pushSupport();
    const dismissed = Number(safeStorage.getItem('pushPromptDismissed_v4')) || 0;
    if (support === 'denied' || support === 'unsupported' || safeStorage.getItem('pushEnabled') === 'false'
      || (typeof Notification !== 'undefined' && Notification.permission === 'granted')
      || Date.now() - dismissed < 30 * 86400000) return;
    const timer = setTimeout(() => { if (document.visibilityState === 'visible') setVisible(true); }, 30000);
    return () => clearTimeout(timer);
  }, []);
  const dismiss = () => { safeStorage.setItem('pushPromptDismissed_v4', String(Date.now())); setVisible(false); };
  if (!visible) return null;
  return <aside className="push-notice" aria-label="إشعارات الجهاز" dir="rtl">
    <Bell size={22} aria-hidden="true" />
    <div><strong>تغيّرات مهمة، دون إزعاج</strong><p>إشعارات الجهاز اختيارية.</p>
      <button type="button" onClick={() => { dismiss(); onOpenSettings(); }}>إعداد الإشعارات</button></div>
    <button type="button" className="push-notice-close" aria-label="عدم تذكيري الآن" onClick={dismiss}><X size={19} /></button>
  </aside>;
}
