import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Users, Eye, ChartNoAxesCombined, Search, Smartphone, Monitor, Tablet, MapPin, Bot, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import '../styles/admin-analytics.css';

type Report = {
  summary: { totalPageviews: number; totalVisitors: number; sessions: number; returningVisitors: number; pageviewGrowth: number | null; visitorGrowth: number | null };
  trend: { date: string; pageviews: number; visitors: number }[];
  deviceTypes: Record<string, number>; browsers: Record<string, number>; os: Record<string, number>;
  pages: Record<string, number>; sources: Record<string, number>;
  source: string; truncated: boolean; generatedAt: string; trackingEnabled: boolean;
  writeHealth?: { localOnly: number; since: string };
};
const number = (n: number) => n.toLocaleString('ar-LY');
const date = (value: string | number) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'غير متاح';
};
const pageNames: Record<string, string> = { '/': 'الأسعار', '/api': 'بوابة المطورين', '/contact': 'اتصل بنا', '/about': 'عن المنصة', '/privacy': 'الخصوصية', '/terms': 'شروط الاستخدام' };
const deviceNames: Record<string, string> = { Mobile: 'هاتف', Tablet: 'جهاز لوحي', Desktop: 'كمبيوتر', Bot: 'أداة آلية', Other: 'جهاز آخر', Unknown: 'غير محدد' };
const deviceIcons: Record<string, typeof Smartphone> = { Mobile: Smartphone, Tablet, Desktop: Monitor, Bot };

export function AdminTracking({ token, liveLogs = null }: { token: string; liveLogs?: any[] | null }) {
  const [days, setDays] = useState(7), [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [logsError, setLogsError] = useState(''), [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [device, setDevice] = useState('all'), [logsBusy, setLogsBusy] = useState(true);
  const [capturedAt, setCapturedAt] = useState(''), [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);
  const liveLogsRef = useRef<any[] | null>(liveLogs);
  useEffect(() => {
    liveLogsRef.current = liveLogs;
    if (Array.isArray(liveLogs)) {
      setLogs(liveLogs);
      setCapturedAt(new Date().toISOString());
      setLogsError('');
      setLogsBusy(false);
    }
  }, [liveLogs]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setError(''); setReport(null);
    fetch('/api/admin/analytics?days=' + days, { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); if (!data.success) throw new Error(); return data; })
      .then(data => { if (!controller.signal.aborted) setReport(data); })
      .catch(() => { if (!controller.signal.aborted) setError('تعذّر تحميل الإحصائيات. حاول مجددًا.'); })
      .finally(() => { clearTimeout(timeout); if (!controller.signal.aborted) setBusy(false); });
    const onAbort = () => { setBusy(false); setError('انتهت مهلة تحميل الإحصائيات. حاول مجددًا.'); };
    controller.signal.addEventListener('abort', onAbort);
    return () => { controller.signal.removeEventListener('abort', onAbort); clearTimeout(timeout); controller.abort(); };
  }, [days, token, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLogs([]); setLogsError(''); setLogsBusy(true); setCapturedAt(''); setTrackingEnabled(null); setExpandedVisitor(null);
    fetch('/api/admin/tracking/logs', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); if (!data.success || !Array.isArray(data.logs)) throw new Error(); return data; })
      .then(data => { if (!controller.signal.aborted) { setLogs(liveLogsRef.current || data.logs); setCapturedAt(data.capturedAt || new Date().toISOString()); setTrackingEnabled(data.trackingEnabled ?? null); } })
      .catch(() => { if (!controller.signal.aborted) setLogsError('تعذّر تحميل لقطة الاتصالات.'); })
      .finally(() => { clearTimeout(timeout); if (!controller.signal.aborted) setLogsBusy(false); });
    const onAbort = () => { setLogsBusy(false); setLogsError('انتهت مهلة تحميل لقطة الاتصالات.'); };
    controller.signal.addEventListener('abort', onAbort);
    return () => { controller.signal.removeEventListener('abort', onAbort); clearTimeout(timeout); controller.abort(); };
  }, [token, refresh]);
  const filtered = logs.filter(log => (status === 'all' || Boolean(log.isOnline) === (status === 'online')) &&
    (device === 'all' || (log.deviceType || 'Unknown') === device) &&
    [log.ip, log.browser, log.os, log.deviceName, log.deviceModel, log.location, deviceNames[log.deviceType]].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const growth = (value: number | null) => value == null ? 'المقارنة غير متاحة' : (value > 0 ? '+' : '') + number(value) + '% عن الفترة السابقة';
  const breakdown = (title: string, values: Record<string, number>, names: Record<string, string> = {}) => {
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return <section><h3>{title}</h3>{!entries.length ? <p>لا توجد مشاهدات مسجلة.</p> : <ol className="analytics-ranking">{entries.slice(0, 8).map(([name, count]) =>
      <li key={name}><div><span dir="auto">{names[name] || name}</span><strong>{number(count)} <small>({number(Math.round(count / total * 100))}%)</small></strong></div><progress value={count} max={total} aria-label={names[name] || name} /></li>
    )}</ol>}</section>;
  };
  return <div className="admin-analytics" dir="rtl">
    <header><div><h2><ChartNoAxesCombined size={22} /> نمو الزيارات</h2><p>المشاهدات المسجلة حسب توقيت طرابلس</p></div>
      <div className="analytics-actions"><label>الفترة<select aria-label="الفترة" value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>اليوم</option><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يومًا</option></select></label>
      <button type="button" title="تحديث التقرير والاتصالات" aria-label="تحديث التقرير والاتصالات" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} /></button></div>
    </header>
    {busy && <p role="status">جارٍ تحميل الإحصائيات…</p>}
    {error && <p role="alert" className="analytics-warning">{error}</p>}
    {report && <>
      <p className="analytics-caption">آخر احتساب: {date(report.generatedAt)} · يُعاد استخدام التقرير لمدة 5 دقائق</p>
      {report.trackingEnabled === false && <p className="analytics-warning">تسجيل الزيارات متوقف من إعدادات الإدارة؛ المعروض بيانات سابقة فقط.</p>}
      {!!report.writeHealth?.localOnly && <p className="analytics-warning">تعذّر تأكيد الحفظ البعيد لـ {number(report.writeHealth.localOnly)} مشاهدة منذ تشغيل السيرفر ({date(report.writeHealth.since)}). حُفظت محليًا وقد تنقص من تقرير Supabase.</p>}
      {(report.source === 'local' || report.truncated) && <p role="status" className="analytics-warning">{report.source === 'local' ? 'تعذّر قراءة Supabase؛ هذه بيانات محلية قد تكون غير مكتملة بعد إعادة تشغيل السيرفر. ' : ''}{report.truncated ? 'وصل التقرير إلى حد القراءة؛ الأرقام تمثل جزءًا من السجل. ' : ''}مقارنة النمو معطّلة لهذه النتيجة.</p>}
      <div className="analytics-metrics">
        <div><span><Eye size={17} /> المشاهدات</span><strong>{number(report.summary.totalPageviews)}</strong><small>{growth(report.summary.pageviewGrowth)}</small></div>
        <div><span><Users size={17} /> متصفحات فريدة</span><strong>{number(report.summary.totalVisitors)}</strong><small>{growth(report.summary.visitorGrowth)}</small></div>
        <div><span>الجلسات</span><strong>{number(report.summary.sessions)}</strong><small>تتجدد بعد 30 دقيقة دون مشاهدة صفحة جديدة</small></div>
        <div><span>زوار عائدون خلال الفترة</span><strong>{number(report.summary.returningVisitors)}</strong><small>معرّفات ظهرت في أكثر من جلسة</small></div>
      </div>
      <section><h3>الحركة اليومية</h3><div className="analytics-legend"><span>المشاهدات</span><span>المتصفحات الفريدة</span></div>
        {report.summary.totalPageviews === 0 ? <p className="analytics-empty">لا توجد مشاهدات مسجلة لهذه الفترة. لن تُستنتج زيارات من تغيّر الأسعار أو اتصالات السيرفر.</p> :
        <div className="analytics-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.trend} margin={{ top: 15, right: 12, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="date" tickFormatter={value => value.slice(5)} minTickGap={25} stroke="var(--muted-ink)" /><YAxis allowDecimals={false} width={40} stroke="var(--muted-ink)" />
          <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)', direction: 'rtl' }} />
          <Area dataKey="pageviews" name="المشاهدات" stroke="var(--official)" fill="var(--official)" fillOpacity={0.12} isAnimationActive={false} />
          <Area dataKey="visitors" name="المتصفحات الفريدة" stroke="#c58025" fill="transparent" strokeDasharray="5 3" isAnimationActive={false} />
        </AreaChart></ResponsiveContainer></div>}
        <details><summary>عرض الأرقام اليومية</summary><div className="analytics-table"><table><thead><tr><th>التاريخ</th><th>المشاهدات</th><th>متصفحات فريدة</th></tr></thead><tbody>{report.trend.map(day => <tr key={day.date}><td>{day.date}</td><td>{number(day.pageviews)}</td><td>{number(day.visitors)}</td></tr>)}</tbody></table></div></details>
      </section>
      <div className="analytics-columns">{breakdown('الصفحات الأكثر مشاهدة', report.pages, pageNames)}{breakdown('مصادر الوصول', report.sources)}</div>
      <div className="analytics-columns analytics-thirds">{breakdown('الأجهزة', report.deviceTypes, { Desktop: 'كمبيوتر', Mobile: 'هاتف', Tablet: 'جهاز لوحي' })}{breakdown('المتصفحات', report.browsers)}{breakdown('أنظمة التشغيل', report.os)}</div>
      <details className="analytics-method"><summary>كيف تُقرأ هذه الأرقام؟</summary><p>الزائر الفريد هو معرّف متصفح، وليس شخصًا مؤكدًا. مسح التخزين أو استخدام جهاز آخر قد يحتسب معرّفًا جديدًا. لا تُجمع أعداد الزوار اليومية للحصول على العدد الفريد للفترة.</p><p>تُسجّل الصفحات العامة فقط، وتُدمج إعادة فتح الصفحة نفسها خلال 30 ثانية. المقارنة مع الفترة السابقة ذات المدة المنقضية نفسها. غياب بيانات سابقة يمنع حساب نسبة النمو.</p><p>قد تنقص الأرقام بسبب حجب التتبع أو طلب عدم التتبع أو تعذّر الإرسال أو حدود الحماية. تُستبعد الروبوتات المعروفة قدر الإمكان، وليس بضمان كامل. بيانات الإحالة على مستوى اسم الموقع، ولا تُسجّل معاملات الروابط. فشل الحفظ البعيد يحتفظ بنسخة محلية، لكنه قد يترك فجوة في التقرير البعيد.</p></details>
    </>}
    <section className="visitor-connections" aria-busy={logsBusy}><h3><Users size={20} aria-hidden="true" /> سجل اتصالات الزوار</h3>
      <p>أحدث الاتصالات حسب توقيت طرابلس. إعادة الاتصال لا تعني زيارة جديدة، والحالة تعكس وقت أخذ اللقطة.</p>
      {capturedAt && <div className="visitor-snapshot"><span>آخر مزامنة: {date(capturedAt)}</span><span>{number(logs.filter(log => log.isOnline).length)} متصل الآن</span><span>{number(filtered.length)} نتيجة</span></div>}
      {trackingEnabled === false && <p className="analytics-warning">جمع سجل الزوار متوقف حاليًا. البيانات الظاهرة، إن وجدت، سابقة لإيقافه.</p>}
      <div className="analytics-actions"><label className="analytics-search"><Search size={18} aria-hidden="true" /><input aria-label="بحث في الاتصالات" placeholder="المدينة، البلد، الجهاز أو عنوان IP" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label="نوع الجهاز" value={device} onChange={e => setDevice(e.target.value)}><option value="all">كل الأجهزة</option>{Object.entries(deviceNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="حالة الاتصال" value={status} onChange={e => setStatus(e.target.value)}><option value="all">كل الاتصالات</option><option value="online">متصل وقت اللقطة</option><option value="offline">غير متصل</option></select></div>
      <details className="visitor-accuracy"><summary>دقة الموقع والجهاز</summary><p>البلد والمدينة تقدير من عنوان الشبكة، وقد يشيران إلى مزوّد الإنترنت أو VPN. لا نطلب موقع GPS. اسم الجهاز وطرازه معلومات يبلّغ عنها المتصفح، وليسا تحققًا من الجهاز الفعلي؛ وقد لا يتيح المتصفح الطراز، خصوصًا إصدار iPhone. «غير متاح» تعني غياب المعلومة، ولا تعني أن الزائر بلا موقع.</p><p>السجل مؤقت لأحدث 200 جهاز؛ تُنظّف الاتصالات الأقدم من 24 ساعة دوريًا، ويُفقد السجل عند إعادة تشغيل الخادم. مرات الاتصال تشمل إعادة الاتصال ولا تمثل عدد زيارات الصفحات.</p></details>
      {logsBusy ? <p role="status">جاري تحميل سجل الاتصالات...</p> : logsError ? <p role="alert">{logsError}</p> : <div className="analytics-table visitor-table"><table><caption className="sr-only">لقطة اتصالات الزوار ومعلومات الموقع والجهاز التقريبية</caption><thead><tr><th scope="col">الجهاز</th><th scope="col">الموقع التقريبي</th><th scope="col">آخر نشاط</th><th scope="col">حالة الاتصال</th><th scope="col"><span className="sr-only">تفاصيل الاتصال</span></th></tr></thead><tbody>{filtered.slice(0, 100).map((log, i) => {
        const Icon = deviceIcons[log.deviceType] || HelpCircle;
        const id = String(log.id || i), expanded = expandedVisitor === id;
        const recordId = String(log.deviceId || log.id || 'غير متاح');
        const detailId = `visitor-detail-${i}`;
        return <React.Fragment key={id}><tr className="visitor-main-row" data-expanded={expanded}>
          <td data-label="الجهاز"><div className="visitor-device"><Icon size={20} aria-hidden="true" /><div><strong dir="auto">{log.deviceName || deviceNames[log.deviceType] || 'غير محدد'}</strong><small>{deviceNames[log.deviceType] || 'غير محدد'}</small></div></div></td>
          <td data-label="الموقع التقريبي"><div className="visitor-place"><MapPin size={16} aria-hidden="true" /><span>{log.location || 'غير متاح'}</span></div>{log.locationStatus === 'approximate' && <small>تقدير شبكة · IPWhois</small>}</td>
          <td data-label="آخر نشاط"><time className="visitor-last-activity" dateTime={log.last_active || log.timestamp}>{date(log.last_active || log.timestamp)}</time></td>
          <td data-label="حالة الاتصال"><span className="visitor-status" data-online={Boolean(log.isOnline)}>{log.isOnline ? 'متصل' : 'غير متصل'}</span></td>
          <td className="visitor-more"><button type="button" aria-expanded={expanded} aria-controls={detailId} aria-label={`${expanded ? 'إخفاء' : 'عرض'} تفاصيل الاتصال ${recordId}`} onClick={() => setExpandedVisitor(expanded ? null : id)}>{expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{expanded ? 'إخفاء' : 'التفاصيل'}</button></td>
        </tr>{expanded && <tr className="visitor-detail-row" id={detailId}><td colSpan={5}><dl className="visitor-details">
          <div><dt>معرّف المتصفح الكامل</dt><dd><bdi className="visitor-id">{recordId}</bdi></dd></div>
          <div><dt>عنوان الشبكة IP</dt><dd><bdi className="visitor-ip">{log.ip || 'غير متاح'}</bdi></dd></div>
          <div><dt>المتصفح</dt><dd dir="auto">{log.browser || 'غير متاح'}</dd></div>
          <div><dt>نظام التشغيل</dt><dd dir="auto">{log.os || 'غير متاح'}</dd></div>
          <div><dt>الطراز المبلّغ عنه</dt><dd><bdi>{log.deviceModel || 'غير متاح'}</bdi><small>{log.modelSource === 'browser' ? 'كما أبلغ عنه المتصفح' : 'مستنتج من تعريف المتصفح عند توفره'}</small></dd></div>
          <div><dt>مرات الاتصال</dt><dd>{Number.isFinite(log.visits) ? number(log.visits) : 'غير متاح'}<small>تشمل إعادة الاتصال، وليست عدد الزيارات</small></dd></div>
          <div><dt>أول اتصال مسجّل</dt><dd>{date(log.firstVisit)}</dd></div>
          <div><dt>آخر اتصال / انقطاع</dt><dd>{date(log.last_active || log.timestamp)}</dd></div>
        </dl></td></tr>}</React.Fragment>;
      })}</tbody></table>{!filtered.length && <p>لا توجد اتصالات مطابقة.</p>}{filtered.length > 100 && <p>تُعرض أحدث 100 نتيجة؛ ضيّق البحث لعرض نتائج أخرى.</p>}</div>}
    </section>
  </div>;
}
