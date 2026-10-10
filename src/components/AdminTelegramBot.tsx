import React, { useEffect, useState } from "react";
import { Bell, Bot, CheckCircle2, Mail, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";

interface Props {
  token: string;
  config: any;
  setConfig: (config: any) => void;
  handleSave: () => Promise<boolean>;
  loading: boolean;
  dirty: boolean;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}

export function AdminTelegramBot({ token, config, setConfig, handleSave, loading, dirty, setError, setSuccess }: Props) {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const [tests, setTests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/telegram/bot-status', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('status');
      const result = await response.json();
      setStatus(result);
      setCheckedAt(new Date().toLocaleTimeString('ar-LY'));
    }).catch(error => {
      if (error.name !== 'AbortError') setStatus({ connected: false, error: 'تعذر فحص البوت.' });
    });
    return () => controller.abort();
  }, [token]);

  useEffect(() => { setTests({}); }, [config.telegramBotToken, config.telegramAdminChatId]);

  const checkBot = async (detect = false) => {
    if (dirty) { setError('احفظ التغييرات قبل فحص الإعدادات المطبقة على الخادم.'); return; }
    setBusy(detect ? 'detect' : 'status');
    setError('');
    try {
      const response = await fetch(`/api/admin/telegram/bot-status${detect ? '?detectChatId=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر فحص البوت.');
      setStatus(result);
      setCheckedAt(new Date().toLocaleTimeString('ar-LY'));
      if (!result.connected) setError(result.error || result.message || 'البوت غير متصل.');
      else if (detect) {
        if (!result.detectedChatId) setError('لا توجد محادثة خاصة حديثة مع البوت. يمكنك إدخال معرف المحادثة يدويًا.');
        else if (window.confirm(`اعتماد محادثة ${result.detectedChatUser || 'المستخدم'} بالمعرف ${result.detectedChatId} لاستقبال الرسائل الخاصة؟`)) {
          setConfig({ ...config, telegramAdminChatId: result.detectedChatId });
          setSuccess('تم اختيار المحادثة. احفظ التغييرات لتطبيقها.');
        }
      }
    } catch (error: any) { setError(error.message || 'تعذر الاتصال.'); }
    finally { setBusy(''); }
  };

  const testDelivery = async (kind: 'contact' | 'error-alert') => {
    setBusy(kind);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/telegram/test-${kind}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر إرسال رسالة الفحص.');
      setTests(previous => ({ ...previous, [kind]: true }));
      setSuccess(result.message || 'وصلت رسالة الفحص بنجاح.');
    } catch (error: any) {
      setTests(previous => ({ ...previous, [kind]: false }));
      setError(error.message || 'فشل الاختبار.');
    } finally { setBusy(''); }
  };

  const disabled = loading || !!busy;
  return (
    <div className="admin-bot">
      <section className="admin-section">
        <div className="admin-section-heading">
          <div><h2><Bot size={21} aria-hidden="true" />اتصال البوت</h2><p className="admin-muted">رسائل الزوار والتنبيهات المهمة</p></div>
          <button type="button" className="admin-secondary" disabled={disabled || dirty} onClick={() => checkBot()}><RefreshCw size={17} className={busy === 'status' ? 'animate-spin' : ''} />فحص الاتصال</button>
        </div>
        <dl className="admin-status-list">
          <div><dt>حالة البوت</dt><dd><span>{dirty ? 'إعدادات معدّلة؛ الفحص الحالي للإعدادات المحفوظة' : status === null ? 'جارٍ التحقق' : status.connected ? 'متصل بـ Telegram' : 'غير متصل'}</span>{status?.bot?.username && <> · <bdi dir="ltr">@{status.bot.username}</bdi></>}</dd></div>
          <div><dt>وجهة الرسائل المحفوظة</dt><dd dir="auto">{status?.configuredAdminChatId || 'لم تُحدد بعد'}</dd></div>
          <div><dt>آخر فحص</dt><dd>{checkedAt || 'غير متاح'}</dd></div>
        </dl>
        {status && !status.connected && <p className="admin-inline-error" role="status">{status.error || status.message || 'تعذر التحقق من الاتصال.'}</p>}
      </section>
      <section className="admin-section">
        <div className="admin-section-heading"><h2>إعدادات الاستقبال</h2><button type="button" className="admin-primary" disabled={disabled || !dirty} onClick={handleSave}><Save size={17} />حفظ الإعدادات</button></div>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label htmlFor="telegram-bot-token">توكن البوت</label>
            <input id="telegram-bot-token" type="password" autoComplete="new-password" dir="ltr" value={config.telegramBotToken || ''} placeholder="TELEGRAM_BOT_TOKEN"
              onChange={event => setConfig({ ...config, telegramBotToken: event.target.value })} />
            <span className="admin-muted">يمكن ضبطه أيضًا في بيئة الخادم. لن يظهر في الموقع العام.</span>
          </div>
          <div className="admin-field">
            <label htmlFor="telegram-chat-id">معرف محادثة الإدارة</label>
            <input id="telegram-chat-id" type="text" inputMode="numeric" dir="ltr" value={config.telegramAdminChatId || ''} placeholder="TELEGRAM_ADMIN_CHAT_ID"
              onChange={event => setConfig({ ...config, telegramAdminChatId: event.target.value })} />
            <button type="button" className="admin-text-button" disabled={disabled || dirty} onClick={() => checkBot(true)}><Search size={16} />اقتراح معرف من المحادثات الخاصة</button>
          </div>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-heading"><h2>اختبار التوصيل</h2></div>
        <div className="admin-delivery-checks">
          {[
            { id: 'contact' as const, title: 'رسائل اتصل بنا', icon: Mail, label: 'إرسال رسالة اتصال تجريبية' },
            { id: 'error-alert' as const, title: 'تنبيهات الأعطال المهمة', icon: Bell, label: 'إرسال تنبيه تجريبي' },
          ].map(item => <div className="admin-delivery-item" key={item.id}>
            <item.icon size={22} aria-hidden="true" /><div><h3>{item.title}</h3><span className="admin-muted" role="status">{tests[item.id] === true ? 'تم التوصيل في آخر اختبار' : tests[item.id] === false ? 'فشل آخر اختبار' : 'لم يُختبر في هذه الجلسة'}</span></div>
            <button type="button" className="admin-secondary" disabled={disabled || dirty} onClick={() => testDelivery(item.id)}>{busy === item.id ? <RefreshCw size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}{item.label}</button>
          </div>)}
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-heading"><h2><ShieldCheck size={20} />سياسة التنبيهات</h2></div>
        <ul className="admin-alert-policy">
          <li>الأعطال غير المعالجة في الخادم، فشل قاعدة البيانات، نفاد الذاكرة أو مساحة التخزين.</li>
          <li>تجاوز حد محاولات الدخول إلى الإدارة، وانهيارات العرض المتكررة لدى الزوار.</li>
          <li>لا تنبيه لانقطاع عابر لدى زائر أو طلب ملغى أو صفحة غير موجودة. التنبيه المكرر يُحجب لمدة 15 دقيقة.</li>
        </ul>
        <p className="admin-muted">التوقف الكامل لخدمة Web أو Worker يحتاج مراقبًا خارجيًا؛ الخدمة المتوقفة لا تستطيع إرسال تنبيه بنفسها.</p>
      </section>
    </div>
  );
}
