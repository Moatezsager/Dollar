import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Save, ExternalLink } from 'lucide-react';
import { PUBLIC_API_DEFAULTS, PUBLIC_RATES_URL, PUBLIC_API_BOUNDS, PUBLIC_API_CAPACITY } from '../../shared/developerApi';
import '../styles/developer-api.css';

interface AdminAPIProps { token: string; config: any; setConfig: (config: any) => void }
type ApiSettings = typeof PUBLIC_API_DEFAULTS;
type RequestLog = { timestamp: string; status: number; responseTime: number; ip: string };
type Overview = { public: { totalRequests: number; successfulRequests: number; failedRequests: number; recentRequests: RequestLog[] }; config: ApiSettings; since: string; premiumConfigured: boolean };

export function AdminAPI({ token, config, setConfig }: AdminAPIProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [draft, setDraft] = useState<ApiSettings>({ ...PUBLIC_API_DEFAULTS, ...config?.apiConfig });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const mounted = useRef(true);
  const request = async (path: string, body?: ApiSettings) => {
    const response = await fetch('/api/admin/' + path, { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || 'تعذر تحميل بيانات API. تحقق من الاتصال وصلاحية تسجيل الدخول.');
    return data;
  };
  const refresh = async (loadDraft = false) => {
    if (busy) return;
    setBusy(true); setError('');
    try { const data = await request('api-stats'); if (mounted.current) { setOverview(data); if (loadDraft) setDraft(data.config); } }
    catch (e: any) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  useEffect(() => { mounted.current = true; refresh(true); return () => { mounted.current = false; }; }, [token]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const data = await request('api-config', { enabled: draft.enabled, rateLimitWindowMs: draft.rateLimitWindowMs, rateLimitMaxRequests: draft.rateLimitMaxRequests });
      if (mounted.current) {
        setDraft(data.config); setConfig({ ...config, apiConfig: { ...config?.apiConfig, ...data.config } });
        setMessage(data.persisted ? 'تم حفظ الإعدادات وتطبيقها.' : 'طُبقت الإعدادات محليًا، لكن تعذرت مزامنتها مع قاعدة البيانات. أعد الحفظ لاحقًا.');
        await refresh();
      }
    } catch (e: any) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setSaving(false); }
  };
  const endpoint = PUBLIC_RATES_URL;
  const logs = (overview?.public.recentRequests || []).filter(row => filter === 'all' || row.status >= 400);
  return <div className="developer-api admin-api" dir="rtl">
    <header className="api-heading"><div><h2>بوابة المطورين وAPI</h2><p>وصول مجاني للدولار واليورو النقدي في السوق الموازي</p></div><button className="api-action" disabled={busy || saving} onClick={() => refresh()}><RefreshCw size={18} aria-hidden="true" />{busy ? 'جارٍ التحديث…' : 'تحديث الإحصاءات'}</button></header>
    {error && <p role="alert" className="api-error">{error}</p>}{message && <p role="status" className="api-feedback">{message}</p>}
    <section><h3>الطلبات منذ تشغيل الخدمة</h3><div className="api-metrics">{[['إجمالي الطلبات', overview?.public.totalRequests], ['طلبات ناجحة', overview?.public.successfulRequests], ['مرفوضة أو متعذرة', overview?.public.failedRequests]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div><p>{overview?.since ? `بداية العد: ${new Date(overview.since).toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli' })} · توقيت ليبيا` : 'جارٍ تحميل الإحصاءات…'}</p></section>
    <div className="api-columns"><section><h3>سياسة الوصول المجاني</h3><form onSubmit={save} aria-busy={saving}>
      <label className="api-toggle"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />تفعيل الرابط المجاني</label>
      <label htmlFor="api-window">مدة الحصة بالدقائق</label><input id="api-window" type="number" min="1" max="60" step="1" required value={draft.rateLimitWindowMs / 60000 || ''} onChange={event => setDraft({ ...draft, rateLimitWindowMs: Number(event.target.value) * 60000 })} />
      <label htmlFor="api-max">عدد الطلبات لكل عنوان IP</label><input id="api-max" type="number" min="1" max={PUBLIC_API_BOUNDS.maxRequests} step="1" required value={draft.rateLimitMaxRequests || ''} onChange={event => setDraft({ ...draft, rateLimitMaxRequests: Number(event.target.value) })} />
      <p>تغيير المدة يبدأ حصة جديدة. تجاوز الحد يوقف طلبات الرابط مؤقتًا دون حظر تصفح الموقع.</p>
      <button type="submit" className="api-primary" disabled={saving || busy || !overview}><Save size={18} aria-hidden="true" />{saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
    </form></section><section><h3>الرابط والحماية</h3><div className="api-endpoint" dir="ltr"><strong>GET</strong><code>{endpoint}</code><a href={endpoint} target="_blank" rel="noopener noreferrer" aria-label="فتح الرابط المجاني" title="فتح الرابط المجاني"><ExternalLink size={18} /></a></div>
      <dl className="api-fields"><div><dt>العملات</dt><dd>USD وEUR فقط · الأسعار بالدينار الليبي</dd></div><div><dt>المصدر</dt><dd>آخر أسعار محفوظة محملة في Web؛ لا جلب من المصادر لكل طلب.</dd></div><div><dt>السعة</dt><dd>سقف إجمالي {PUBLIC_API_CAPACITY} طلب في الدقيقة للخدمة المجانية لكل نسخة سيرفر، وسجل محدود بآخر 100 طلب.</dd></div><div><dt>المسار المدفوع</dt><dd>{overview ? overview.premiumConfigured ? 'مفتاح السيرفر مضبوط؛ الوصول عبر Authorization: Bearer.' : 'غير مفعّل: مفتاح السيرفر غير مضبوط.' : 'جارٍ التحقق…'}<code dir="ltr">/api/premium/rates</code></dd></div></dl>
      <p>عدادات الحماية مؤقتة وتُصفّر عند إعادة التشغيل. الحماية من هجمات الشبكة الكبيرة تحتاج طبقة حماية أمام السيرفر.</p>
    </section></div>
    <section><div className="api-toolbar"><h3>آخر الطلبات</h3><label>العرض <select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">الكل</option><option value="errors">الأخطاء والرفض</option></select></label></div>
      <div className="api-table"><table><thead><tr><th>الوقت بتوقيت ليبيا</th><th>عنوان IP</th><th>الحالة</th><th>المدة</th></tr></thead><tbody>{logs.map((row, index) => <tr key={`${row.timestamp}-${index}`}><td>{new Date(row.timestamp).toLocaleTimeString('ar-LY', { timeZone: 'Africa/Tripoli' })}</td><td dir="ltr">{row.ip}</td><td><span className={row.status >= 400 ? 'api-error' : ''}>{row.status}</span></td><td>{row.responseTime} ms</td></tr>)}</tbody></table></div>{!logs.length && <p>{overview ? 'لا توجد طلبات مطابقة.' : 'جارٍ التحميل…'}</p>}
    </section>
  </div>;
}
