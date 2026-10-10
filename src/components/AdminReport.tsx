import React, { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Search, Terminal } from 'lucide-react';

export function AdminReport({ token }: { token: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');

  const fetchReport = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/system-report', {
        headers: { Authorization: `Bearer ${token}` }, signal: signal || AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.system_health) throw new Error(data.message || 'تعذر تحميل التقرير.');
      setReport(data);
    } catch (error: any) { if (error.name !== 'AbortError') setError(error.message || 'تعذر الاتصال.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [token]);

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); setCopied(true); }
    catch { setError('تعذر الوصول إلى الحافظة.'); }
  };
  const health = report?.system_health;
  const database = report?.database_status;
  const available = (value: any, suffix = '') => value === null || value === undefined ? 'غير متاح' : `${value}${suffix}`;
  const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ar-LY') : 'غير متاح';
  const sources = (report?.sources_directory?.telegram_channels || []).filter((source: any) =>
    [source.name, source.id].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="admin-report">
      <section className="admin-section">
        <div className="admin-section-heading"><div><h2><Terminal size={21} />تقرير خدمة Web</h2><p className="admin-muted">{report ? `وقت التقرير: ${date(report.generated_at)}` : 'موارد الخدمة والبيانات المتاحة'}</p></div>
          <div className="admin-quick-actions">
            <button type="button" className="admin-secondary" disabled={!report} onClick={copyReport}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'تم النسخ' : 'نسخ التقرير'}</button>
            <button type="button" className="admin-secondary" disabled={loading} onClick={() => fetchReport()}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} />تحديث</button>
          </div>
        </div>
        {error && <p role="alert" className="admin-inline-error">{error}</p>}
        {loading && !report && <p role="status" className="admin-empty">جارٍ تحميل التقرير…</p>}
        {health && <dl className="admin-status-list">
          <div><dt>مدة تشغيل Web</dt><dd>{available(health.uptime_formatted)}</dd></div>
          <div><dt>بدء التشغيل</dt><dd>{date(health.server_start_time)}</dd></div>
          <div><dt>الذاكرة المستخدمة · Heap</dt><dd>{available(health.memory_mb?.heap_used, ' MB')}</dd></div>
          <div><dt>إجمالي ذاكرة العملية · RSS</dt><dd>{available(health.memory_mb?.rss, ' MB')}</dd></div>
          <div><dt>إصدار Node</dt><dd dir="ltr">{available(health.node_version)}</dd></div>
          <div><dt>منصة التشغيل</dt><dd>{available(health.platform)} · {available(health.architecture)}</dd></div>
        </dl>}
      </section>
      {report && <>
        <section className="admin-section">
          <div className="admin-section-heading"><h2>البيانات والتخزين</h2></div>
          <dl className="admin-status-list">
            <div><dt>قراءة Supabase</dt><dd>{database?.supabase?.connected === true ? 'ناجحة في آخر فحص' : database?.supabase?.connected === false ? 'تعذر التحقق من القراءة' : 'غير متحقق'}</dd></div>
            <div><dt>زمن استعلامات السجلات</dt><dd>{available(database?.supabase?.stats?.ping_ms, ' ms')}</dd></div>
            <div><dt>سجلات السوق الموازي</dt><dd>{available(database?.supabase?.stats?.parallel_rates)}</dd></div>
            <div><dt>السجلات الرسمية</dt><dd>{available(database?.supabase?.stats?.official_rates)}</dd></div>
            <div><dt>SQLite</dt><dd>{database?.sqlite?.connected === true ? 'تمت القراءة بنجاح' : 'تعذر التحقق من القراءة'}</dd></div>
            <div><dt>رسائل الزوار المحفوظة</dt><dd>{available(database?.sqlite?.visitor_messages_count)}</dd></div>
            <div><dt>مشتركو الإشعارات</dt><dd>{available(database?.sqlite?.push_subscriptions_count)}</dd></div>
            <div><dt>آخر بيانات أسعار متاحة</dt><dd>{date(report.scraper_status?.last_successful_scrape)}</dd></div>
            <div><dt>الدولار الرسمي المتاح</dt><dd>{available(report.central_bank_status?.usd_official, ' د.ل')}</dd></div>
            <div><dt>اليورو الرسمي المتاح</dt><dd>{available(report.central_bank_status?.eur_official, ' د.ل')}</dd></div>
          </dl>
        </section>
        <section className="admin-section">
          <div className="admin-section-heading"><h2>الاتصالات والتكاملات</h2></div>
          <dl className="admin-status-list">
            <div><dt>اتصالات Socket.IO</dt><dd>{available(report.network_stats?.active_websocket_connections)}</dd></div>
            <div><dt>طلبات API العامة</dt><dd>{available(report.network_stats?.public_api_requests)}</dd></div>
            <div><dt>طلبات API المميزة</dt><dd>{available(report.network_stats?.premium_api_requests)}</dd></div>
            <div><dt>العناوين المحظورة مؤقتًا</dt><dd>{available(report.network_stats?.banned_ips_count)}</dd></div>
            <div><dt>إعداد Gemini</dt><dd>{report.ai_engine?.configured ? 'مفتاح مهيأ؛ الاتصال غير مختبر هنا' : 'غير مهيأ'}</dd></div>
            <div><dt>مراقبة Telegram وWhatsApp للأسعار</dt><dd>من لوحة Worker المستقلة</dd></div>
          </dl>
        </section>
        <section className="admin-section">
          <div className="admin-section-heading"><h2>مصادر Telegram المحفوظة في الإعدادات</h2></div>
          <label className="admin-nav-search"><Search size={17} /><input aria-label="البحث في مصادر Telegram" placeholder="اسم القناة أو معرفها" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <dl className="admin-status-list">{sources.map((source: any) => <div key={source.id}><dt dir="ltr">{source.id}</dt><dd>جاهزية القراءة تُتحقق في Worker</dd></div>)}</dl>
          {sources.length === 0 && <p className="admin-muted">لا توجد مصادر مطابقة.</p>}
        </section>
        <details className="admin-advanced"><summary>البيانات التشخيصية الكاملة · JSON</summary><pre className="admin-raw-json" dir="ltr">{JSON.stringify(report, null, 2)}</pre></details>
      </>}
    </div>
  );
}
