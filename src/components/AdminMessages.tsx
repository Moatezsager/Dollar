import React, { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, Trash2, MessageSquare, Search } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const messageDate = (value: string) => {
  const normalized = (value || '').replace(' ', 'T');
  const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : normalized + 'Z');
  return Number.isFinite(date.getTime()) ? formatDistanceToNow(date, { addSuffix: true, locale: ar }) : 'تاريخ غير متاح';
};
const whatsappNumber = (value: string) => {
  let phone = (value || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 10) phone = '218' + phone.slice(1);
  else if (phone.startsWith('9') && phone.length === 9) phone = '218' + phone;
  return phone;
};

export function AdminMessages({ token }: { token: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(50);
  const unread = messages.filter(message => !['read', 'replied'].includes(message.status)).length;
  const filtered = useMemo(() => messages.filter(message => {
    const status = ['read', 'replied'].includes(message.status) ? message.status : 'new';
    const searchable = [message.name, message.email, message.phone, message.message].join(' ').toLowerCase();
    return (filter === 'all' || filter === status || filter === message.status) && searchable.includes(query.trim().toLowerCase());
  }), [messages, query, filter]);
  useEffect(() => setLimit(50), [query, filter]);

  const fetchMessages = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/messages', {
        headers: { Authorization: `Bearer ${token}` }, signal: signal || AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result)) throw new Error(result.error || 'تعذر تحميل الرسائل.');
      setMessages(result);
    } catch (error: any) { if (error.name !== 'AbortError') setError(error.message || 'تعذر الاتصال.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    fetchMessages(controller.signal);
    return () => controller.abort();
  }, [token]);

  const updateMessage = async (id: number, status?: string) => {
    if (status === undefined && !window.confirm('حذف هذه الرسالة نهائيًا؟')) return;
    setBusy(id);
    setError('');
    try {
      const response = await fetch(`/api/admin/messages/${id}${status === undefined ? '' : '/status'}`, {
        method: status === undefined ? 'DELETE' : 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: status === undefined ? undefined : JSON.stringify({ status }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('تعذر تطبيق الإجراء. لم تتغير الرسالة.');
      setMessages(previous => status === undefined ? previous.filter(message => message.id !== id)
        : previous.map(message => message.id === id ? { ...message, status } : message));
    } catch (error: any) { setError(error.message || 'تعذر الاتصال.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="admin-messages">
      <section className="admin-section">
        <div className="admin-section-heading">
          <div><h2>البريد الوارد</h2><p className="admin-muted">{messages.length} رسالة · {unread} لم تُقرأ</p></div>
          <button type="button" className="admin-icon-button" aria-label="تحديث الرسائل" title="تحديث الرسائل" disabled={loading || busy !== null} onClick={() => fetchMessages()}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        <div className="admin-message-toolbar">
          <label className="admin-nav-search" style={{ marginBottom: 0 }}><Search size={18} /><input aria-label="البحث في رسائل الزوار" placeholder="الاسم أو البريد أو نص الرسالة" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select className="admin-filter-select" aria-label="تصفية الرسائل" value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">جميع الرسائل</option><option value="new">غير مقروءة</option><option value="read">مقروءة</option><option value="replied">تم الرد</option><option value="telegram_failed">تعذر إرسالها إلى Telegram</option>
          </select>
        </div>
        {error && <p className="admin-inline-error" role="alert">{error}</p>}
        {loading && messages.length === 0 ? <p className="admin-empty" role="status">جارٍ تحميل الرسائل…</p> : filtered.length === 0 ? <div className="admin-empty"><Mail size={32} /><p>{messages.length ? 'لا توجد رسائل تطابق البحث.' : 'لا توجد رسائل واردة.'}</p></div> : filtered.slice(0, limit).map(message => {
          const status = ['read', 'replied'].includes(message.status) ? message.status : 'new';
          const phone = whatsappNumber(message.phone);
          return <article className="admin-message" key={message.id}>
            <header><div><h3>{message.name || 'زائر'}</h3><div className="admin-message-meta"><span dir="ltr">{message.email}</span><span dir="ltr">{message.phone}</span></div></div><span className="admin-muted">{messageDate(message.created_at)}</span></header>
            <p className="admin-message-body">{message.message}</p>
            <div className="admin-message-meta">
              <span>{status === 'new' ? 'غير مقروءة' : status === 'read' ? 'مقروءة' : 'تم الرد'}</span>
              {message.status === 'sent_to_telegram' && <span>أُرسلت إلى Telegram</span>}
              {message.status === 'telegram_failed' && <span className="admin-danger">تعذر إرسالها إلى Telegram · الرسالة محفوظة هنا</span>}
            </div>
            <div className="admin-message-actions">
              {message.email && <a href={`mailto:${encodeURIComponent(message.email)}`} className="admin-secondary"><Mail size={16} />البريد</a>}
              {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="admin-secondary"><MessageSquare size={16} />WhatsApp</a>}
              <select className="admin-filter-select" aria-label={`حالة رسالة ${message.name || message.email}`} value={status} disabled={busy !== null} onChange={event => updateMessage(message.id, event.target.value)}>
                <option value="new">غير مقروءة</option><option value="read">مقروءة</option><option value="replied">تم الرد</option>
              </select>
              <button type="button" className="admin-icon-button admin-danger" aria-label={`حذف رسالة ${message.name || message.email}`} title="حذف الرسالة" disabled={busy !== null} onClick={() => updateMessage(message.id)}>{busy === message.id ? <RefreshCw size={17} className="animate-spin" /> : <Trash2 size={17} />}</button>
            </div>
          </article>;
        })}
        {filtered.length > limit && <button type="button" className="admin-secondary" onClick={() => setLimit(previous => previous + 50)}>عرض رسائل أقدم</button>}
      </section>
    </div>
  );
}
