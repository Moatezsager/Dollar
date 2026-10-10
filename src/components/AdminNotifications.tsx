import React, {useEffect, useRef, useState} from 'react';
import {Bell, RefreshCw, Send, Smartphone, Users} from 'lucide-react';
import {currentPushSubscription, enablePush} from '../utils/pushNotifications';

type Campaign = {
  id: string; kind: 'rates' | 'announcement'; title: string; body: string; createdAt: number;
  status: 'sending' | 'completed' | 'failed' | 'interrupted';
  total: number; sent: number; failed: number; removed: number;
};
type Overview = {subscribers: number; sending: boolean; history: Campaign[]};
const destinations = [
  ['/', 'الصفحة الرئيسية'], ['/#rates-section', 'أسعار العملات'], ['/#charts-section', 'التحليل'],
  ['/#currency-converter-section', 'المحول'], ['/#metals-grid', 'الذهب والمعادن'],
];
const statusLabel = {sending: 'جارٍ الإرسال', completed: 'اكتمل الإرسال', failed: 'تعذر الإرسال', interrupted: 'توقف الإرسال؛ لم يُعد تلقائيًا'};

export function AdminNotifications({token}: {token: string}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const mounted = useRef(true);
  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch('/api/admin/push/' + path, {...options, cache: 'no-store',
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(20000)});
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || 'تعذر الاتصال بخدمة الإشعارات.');
    return data;
  };
  const refresh = async () => {
    setRefreshing(true);
    try { const data = await request('status'); if (mounted.current) {setOverview(data); setError('');} }
    catch (error: any) { if (mounted.current) setError(error.message); }
    finally { if (mounted.current) setRefreshing(false); }
  };
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {mounted.current = false;};
  }, [token]);
  useEffect(() => {
    if (!pending) return;
    let cancelled = false, attempts = 0, timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (cancelled) return;
      if (++attempts > 120) {
        setPending('');
        setMessage('استغرق الإرسال وقتًا أطول. حدّث السجل للتحقق قبل إرسال رسالة أخرى.');
        return;
      }
      if (document.visibilityState === 'visible') {
        try {
          const data: Overview = await request('status');
          if (cancelled) return;
          setOverview(data);
          const campaign = data.history.find(item => item.id === pending);
          if (campaign && campaign.status !== 'sending') {
            setPending('');
            setMessage(statusLabel[campaign.status]);
            return;
          }
        } catch { if (!cancelled) setError('تعذر متابعة الإرسال مؤقتًا. حدّث السجل قبل إعادة الإرسال.'); }
      }
      if (!cancelled) timer = setTimeout(check, 3000);
    };
    timer = setTimeout(check, 3000);
    return () => {cancelled = true; clearTimeout(timer);};
  }, [pending, token]);
  const send = async (test: boolean) => {
    if (busy) return;
    if (!test && !window.confirm('إرسال هذا الإشعار إلى ' + (overview?.subscribers || 0) + ' جهاز مشترك؟\n' + title.trim())) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let subscription: PushSubscription | null = null;
      if (test) {
        subscription = typeof Notification !== 'undefined' && Notification.permission === 'granted'
          ? await currentPushSubscription() : await enablePush();
        if (!subscription) subscription = await enablePush();
      }
      const data = await request(test ? 'test' : 'send', {method: 'POST', body: JSON.stringify({
        title: title.trim(), body: body.trim(), url, ...(subscription ? {subscription: subscription.toJSON()} : {}),
      })});
      if (!mounted.current) return;
      if (test) setMessage(data.message);
      else {
        setPending(data.campaign.status === 'sending' ? data.campaign.id : '');
        setMessage(data.campaign.status === 'sending' ? 'بدأ الإرسال. تابع النتيجة في السجل.' : statusLabel[data.campaign.status as Campaign['status']]);
        setOverview(previous => previous ? {...previous, sending: data.campaign.status === 'sending',
          history: [data.campaign, ...previous.history.filter(item => item.id !== data.campaign.id)]} : previous);
      }
    } catch (error: any) {
      if (mounted.current) setError(error.name === 'TimeoutError' ? 'انتهت مهلة الاتصال. راجع السجل قبل إعادة الإرسال.' : error.message);
    } finally {if (mounted.current) setBusy(false);}
  };
  const valid = !!title.trim() && !!body.trim();
  return <div className="admin-push">
    <section className="admin-section">
      <div className="admin-section-heading"><div><h2><Bell size={20} />إشعارات المستخدمين</h2>
        <p className="admin-muted">تصل إلى الأجهزة التي وافقت على الاشتراك، حتى بعد إغلاق الصفحة.</p></div>
        <button type="button" className="admin-icon-button" title="تحديث سجل الإشعارات" aria-label="تحديث سجل الإشعارات" disabled={refreshing} onClick={refresh}><RefreshCw size={18} /></button></div>
      <div className="admin-push-summary"><Users size={19} /><strong>{overview?.subscribers ?? '—'}</strong><span>جهاز مشترك</span></div>
      <p className="admin-muted">تُجمع تغيّرات الأسعار المهمة خلال دقيقة، بفاصل 30 دقيقة وبحد أقصى 6 ملخصات يوميًا. هدوء من 10 مساءً إلى 8 صباحًا بتوقيت ليبيا.</p>
    </section>
    {error && <p role="alert" className="admin-inline-error">{error}</p>}
    {message && <p role="status" className="admin-push-result">{message}</p>}
    <section className="admin-section">
      <div className="admin-section-heading"><h2>إرسال إشعار</h2><span className="admin-muted">حتى 3 رسائل إدارية يوميًا، بفاصل 10 دقائق</span></div>
      <div className="admin-push-compose">
        <form onSubmit={event => {event.preventDefault(); send(false);}} className="admin-push-fields">
          <div className="admin-field"><label htmlFor="push-title">العنوان</label>
            <input id="push-title" maxLength={60} required placeholder="عنوان مختصر وواضح" value={title} onChange={event => setTitle(event.target.value)} />
            <span className="admin-muted">{title.length} / 60</span></div>
          <div className="admin-field"><label htmlFor="push-body">نص الإشعار</label>
            <textarea id="push-body" maxLength={240} required rows={4} placeholder="اكتب المعلومة المهمة للمشتركين" value={body} onChange={event => setBody(event.target.value)} />
            <span className="admin-muted">{body.length} / 240</span></div>
          <div className="admin-field"><label htmlFor="push-url">الوجهة عند فتح الإشعار</label>
            <select id="push-url" value={url} onChange={event => setUrl(event.target.value)}>{destinations.map(([path, label]) => <option key={path} value={path}>{label}</option>)}</select></div>
          <div className="admin-quick-actions">
            <button type="button" className="admin-secondary" disabled={!valid || busy} onClick={() => send(true)}><Smartphone size={18} />اختبار على جهازي</button>
            <button type="submit" className="admin-primary" disabled={!valid || busy || !!pending || overview?.sending || !overview?.subscribers}><Send size={18} />{busy ? 'جارٍ الإرسال…' : 'إرسال للمشتركين'}</button>
          </div>
        </form>
        <div className="admin-push-preview-area"><h3>معاينة المحتوى</h3>
          <article className="admin-push-preview" aria-label="معاينة الإشعار">
            <img src="/icon-192.png" alt="" width={40} height={40} />
            <div><span>مؤشر الدينار</span><h4>{title || 'عنوان الإشعار'}</h4><p>{body || 'نص الإشعار سيظهر هنا'}</p></div>
          </article>
          <p className="admin-muted">شكل الإشعار تحدده إعدادات الهاتف ونظام التشغيل. الاختبار يرسل لهذا الجهاز فقط.</p>
        </div>
      </div>
    </section>
    <section className="admin-section"><div className="admin-section-heading"><h2>سجل الإرسال</h2></div>
      <p className="admin-muted">القبول يعني أن خدمة Push استلمت الرسالة، ولا يثبت عرضها أو قراءتها على الهاتف.</p>
      {!overview ? <p className="admin-empty">جارٍ قراءة السجل…</p> : !overview.history.length ? <p className="admin-empty">لا توجد إشعارات مرسلة بعد.</p> :
        <ul className="admin-push-history">{overview.history.map(item => <li key={item.id}>
          <div className="admin-push-history-heading"><strong>{item.title}</strong><span>{statusLabel[item.status]}</span></div>
          <p>{item.body}</p><div className="admin-push-history-meta">
            <span>{item.kind === 'rates' ? 'ملخص أسعار' : 'رسالة إدارية'}</span>
            <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString('ar-LY')}</time>
            <span>الإجمالي {item.total}</span><span>قبلتها الخدمة {item.sent}</span><span>تعذر {item.failed}</span><span>اشتراكات منتهية {item.removed}</span>
          </div></li>)}</ul>}
    </section>
  </div>;
}
