import React, { useEffect, useRef, useState } from 'react';
import { Download, Send, Facebook, RefreshCw, Copy, Check, Eye, SlidersHorizontal, RotateCcw, ArrowUpRight, ArrowDownRight, Minus, FileText, Share2, ExternalLink } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { harvestNotes, harvestNumber, WeeklyHarvestData, WeeklyItem } from '../../shared/weeklyHarvest';
import { libyaDayKey } from '../utils/rateHistory';
import '../styles/weekly-harvest.css';

interface Props { token: string; config: any; setError: (message: string) => void; setSuccess: (message: string) => void }
const fields = [['open', 'أول رصد'], ['close', 'آخر رصد'], ['high', 'الأعلى'], ['low', 'الأدنى']] as const;
const signed = (value: number, id: string) => `${value > 0 ? '+' : ''}${harvestNumber(value, id)}`;
const highlightIds = ['USD', 'USD_CHECKS', 'EUR'];
const telegramUrl = 'https://t.me/libya_index_dollar';
const facebookUrl = 'https://www.facebook.com/profile.php?id=61593953519936';

export function AdminWeeklyHarvest({ token, config, setError, setSuccess }: Props) {
  const [data, setData] = useState<WeeklyHarvestData | null>(null);
  const [items, setItems] = useState<WeeklyItem[]>([]);
  const [title, setTitle] = useState('حصاد الأسبوع');
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setLocalError] = useState('');
  const [editing, setEditing] = useState(false);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1100);
  const [download, setDownload] = useState<{ file: File; url: string } | null>(null);
  const downloadOptions = useRef<HTMLElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const visible = items.filter(item => !hidden.includes(item.id));
  const notes = noteDraft === null ? harvestNotes(visible) : noteDraft.split('\n').map(line => line.trim()).filter(Boolean);
  const invalid = visible.some(item => fields.some(([key]) => !Number.isFinite(item[key]) || item[key] <= 0) ||
    item.high < Math.max(item.open, item.close, item.low) || item.low > Math.min(item.open, item.close, item.high));
  const canExport = !!data && visible.length > 0 && !invalid && !!title.trim() && !loading && !busy;
  useEffect(() => { setDownload(null); setFeedback(''); }, [items, title, noteDraft, hidden, data]);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
  useEffect(() => { if (download) downloadOptions.current?.scrollIntoView({ block: 'nearest' }); }, [download]);
  const reset = (next: WeeklyHarvestData) => { setItems(next.items); setTitle(next.title); setNoteDraft(null); setHidden([]); setDirty(false); };
  const load = async () => {
    if (dirty && !window.confirm('إعادة الاحتساب ستستبدل تعديلات هذه المسودة. هل تتابع؟')) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true); setLocalError('');
    try {
      const response = await fetch('/api/admin/weekly-harvest/data', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.items)) throw new Error(json.error || 'تعذر تحميل بيانات الأسبوع.');
      if (!controller.signal.aborted) { setData(json); reset(json); }
    } catch (err: any) {
      if (request.current === controller) setLocalError(err.name === 'AbortError' ? 'انتهت مهلة التحميل. أعد المحاولة.' : err.message);
    } finally { clearTimeout(timeout); if (request.current === controller) setLoading(false); }
  };
  useEffect(() => { load(); return () => { request.current?.abort(); request.current = null; }; }, [token]);
  useEffect(() => {
    if (!wrapper.current || !card.current) return;
    const observer = new ResizeObserver(() => {
      if (wrapper.current && card.current) { setScale(Math.min(1, wrapper.current.clientWidth / 900)); setHeight(card.current.offsetHeight); }
    });
    observer.observe(wrapper.current); observer.observe(card.current);
    return () => observer.disconnect();
  }, [data]);
  const editPrice = (index: number, field: typeof fields[number][0], value: number) => {
    setItems(old => old.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      next.change = next.days > 1 && Number.isFinite(next.open + next.close) ? Number((next.close - next.open).toFixed(6)) : null;
      next.changePct = next.change === null || next.open <= 0 ? null : next.change / next.open * 100;
      return next;
    })); setDirty(true);
  };
  const reportText = [title, data?.dateRange, ...visible.map(item => `${item.name}: ${harvestNumber(item.close, item.id)} د.ل (${item.unit})${item.change === null ? ' · بيانات محدودة' : ` · التغير ${signed(item.change, item.id)} د.ل`}`), '', ...notes,
    'الأرقام من السجلات المتاحة خلال الفترة، وليست أسعار تنفيذ ملزمة.', '', `تيليجرام: ${telegramUrl}`, `فيسبوك: ${facebookUrl}`, 'https://dollar-price-qp14.onrender.com/'].join('\n');
  const act = async (action: 'download' | 'image' | 'text' | 'me' | 'channel') => {
    if (!canExport || operation.current) return;
    if (action === 'channel' && !window.confirm(`نشر النشرة في ${config.telegramPostChannel}؟`)) return;
    operation.current = true; setBusy(action); setLocalError(''); setFeedback('');
    try {
      if (action === 'text') await navigator.clipboard.writeText(reportText);
      else {
        await document.fonts.ready;
        await Promise.all([...card.current!.querySelectorAll('img')].map(image => image.decode()));
        const blob = download?.file || await toBlob(card.current!, { pixelRatio: 1.2, backgroundColor: '#ffffff', style: { transform: 'none', position: 'static' } });
        if (!blob || !blob.size) throw new Error('تعذر تجهيز الصورة. أعد المحاولة.');
        if (blob.size > 5 * 1024 * 1024) throw new Error('الصورة أكبر من 5 ميجابايت. قلل الأصناف أو طول النص.');
        if (action === 'download') {
          const file = new File([blob], `weekly-harvest-${libyaDayKey(data!.start)}.png`, { type: 'image/png' });
          const url = URL.createObjectURL(file);
          setDownload({ file, url });
          const link = document.createElement('a'); link.href = url; link.download = file.name;
          document.body.appendChild(link); link.click(); link.remove();
        } else if (action === 'image') {
          if (!window.ClipboardItem) throw new Error('نسخ الصور غير مدعوم في هذا المتصفح. استخدم تحميل الصورة.');
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } else {
          const caption = [title, data!.dateRange, '', ...notes, '', `تابعنا على تيليجرام: ${telegramUrl}`, `فيسبوك: ${facebookUrl}`, 'https://dollar-price-qp14.onrender.com/'].join('\n');
          if (caption.length > 1024) throw new Error('نص النشرة أطول من حد الإرسال. اختصر الملاحظات إلى 1024 حرفًا مع العنوان والتاريخ.');
          const imageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('تعذرت قراءة ملف الصورة.')); reader.readAsDataURL(blob);
          });
          const response = await fetch('/api/admin/weekly-harvest/send-telegram', { method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ imageBase64, caption, destination: action === 'me' ? 'me' : 'channel' }) });
          const json = await response.json();
          if (!response.ok || !json.success) throw new Error(json.error || 'تعذر إرسال النشرة.');
        }
      }
      const message = action === 'download' ? 'الصورة جاهزة للحفظ والمشاركة.' : action === 'text' ? 'تم نسخ التقرير.' : action === 'image' ? 'تم نسخ الصورة.' : action === 'me' ? 'أُرسلت المعاينة إلى محادثة الإدارة.' : 'نُشرت النشرة في القناة.';
      setFeedback(message); setSuccess(message);
    } catch (err: any) { const message = err.message || 'تعذر إتمام العملية. حاول مجددًا.'; setLocalError(message); setError(message); }
    finally { operation.current = false; setBusy(''); }
  };
  const shareDownload = async () => {
    if (!download || operation.current) return;
    operation.current = true; setBusy('share'); setLocalError('');
    try {
      // A fresh tap shares the prepared file without losing native user activation.
      await navigator.share({ files: [download.file], title });
      setFeedback('تم فتح خيارات مشاركة الصورة.');
    } catch (err: any) {
      if (err.name === 'AbortError') setFeedback('أُلغيت المشاركة؛ الصورة ما زالت جاهزة للحفظ.');
      else setLocalError('تعذرت المشاركة. يمكنك حفظ ملف الصورة أو فتحها مباشرة.');
    } finally { operation.current = false; setBusy(''); }
  };
  return <div className="weekly-harvest" dir="rtl">
    <header className="harvest-heading"><div><span className="harvest-eyebrow">غرفة النشر</span><h2>الحصاد الأسبوعي</h2><p>{data?.dateRange || 'آخر سبعة أيام مكتملة'} <span>· بتوقيت طرابلس</span></p></div>
      <button onClick={load} disabled={loading || !!busy}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} />{loading ? 'جارٍ الاحتساب' : 'تحديث البيانات'}</button></header>
    <div className="harvest-toolbar"><div role="group" aria-label="عرض النشرة"><button aria-pressed={!editing} onClick={() => setEditing(false)}><Eye size={17} />المعاينة</button>
      <button aria-pressed={editing} onClick={() => setEditing(true)}><SlidersHorizontal size={17} />تحرير النشرة</button></div><span>{visible.length} صنف{dirty ? ' · مسودة معدّلة' : ' · من السجل المحفوظ'}</span></div>
    {error && <p className="harvest-error" role="alert">{error}</p>}
    {feedback && <p className="harvest-feedback" role="status"><Check size={16} />{feedback}</p>}
    {invalid && <p className="harvest-error" role="alert">راجع الأرقام: السعر موجب، والأعلى لا يقل عن أول وآخر رصد، والأدنى لا يتجاوزهما.</p>}
    {loading && !data && <div className="harvest-empty" role="status">جارٍ قراءة سجل الأسبوع...</div>}
    {data && !data.items.length && <div className="harvest-empty"><FileText size={28} /><h3>لا توجد قراءات لهذه الفترة</h3><p>لا يمكن إعداد حصاد أسبوعي قبل توفر سجل أسعار.</p></div>}
    {data && data.items.length > 0 && <>
      {editing && <section className="harvest-editor" aria-label="تحرير النشرة"><div className="harvest-editor-heading"><h3>محتوى النشرة</h3><button disabled={!!busy} onClick={() => { if (window.confirm('استعادة محتوى السجل وإلغاء تعديلات المسودة؟')) reset(data); }}><RotateCcw size={16} />استعادة الأصل</button></div>
        <label>العنوان<input disabled={!!busy || loading} maxLength={70} value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} /></label>
        <label>ملاحظات التقرير<textarea disabled={!!busy || loading} rows={4} maxLength={750} value={notes.join('\n')} onChange={e => { setNoteDraft(e.target.value); setDirty(true); }} /></label>
        <div className="harvest-edit-items">{items.map((item, index) => <fieldset disabled={!!busy || loading} key={item.id}><legend><label><input disabled={!!busy || loading} type="checkbox" checked={!hidden.includes(item.id)} onChange={e => { setHidden(old => e.target.checked ? old.filter(id => id !== item.id) : [...old, item.id]); setDirty(true); }} />{item.name}</label><span>{item.category}</span></legend>
          <div>{fields.map(([key, name]) => <label key={key}>{name}<input aria-label={`${name} ${item.name}`} type="number" inputMode="decimal" min="0.0001" step="0.0001" dir="ltr" value={Number.isFinite(item[key]) ? Number(item[key].toFixed(6)) : ''} onChange={e => editPrice(index, key, e.target.valueAsNumber)} /></label>)}</div></fieldset>)}</div>
      </section>}
      <div className="harvest-preview-heading"><h3>نشرة الأسعار</h3><span>1080 px · PNG</span></div>
      <div ref={wrapper} className="harvest-preview"><div style={{ height: height * scale, position: 'relative' }}>
        <article ref={card} id="weekly-harvest-card" className="harvest-sheet" style={{ transform: `scale(${scale})`, transformOrigin: 'top right' }}>
          <header className="harvest-sheet-head"><div className="harvest-brand"><img src="/logo.png" alt="مؤشر الدينار" width={54} height={54} /><div><strong>مؤشر الدينار</strong><span>أسعار العملات في ليبيا</span></div></div><span className="harvest-edition">تقرير الأسواق<span>عملات · حوالات · معادن</span></span></header>
          <div className="harvest-sheet-title"><h1>{title}</h1><div className="harvest-period"><p>{data.dateRange}</p><span>سبعة أيام مكتملة · توقيت طرابلس</span></div></div>
          {visible.some(item => highlightIds.includes(item.id)) && <><p className="harvest-quote-caption">آخر الأسعار المسجلة خلال الفترة · دينار ليبي</p><div className="harvest-highlights">{visible.filter(item => highlightIds.includes(item.id)).map(item =>
            <div key={item.id} data-currency={item.id}><div className="harvest-highlight-label"><span>{item.name}</span><small>{item.code}</small></div><strong dir="ltr">{harvestNumber(item.close, item.id)} <small>د.ل</small></strong></div>
          )}</div></>}
          <div className="harvest-sheet-body"><table className="harvest-table" aria-label="تفاصيل الحصاد الأسبوعي"><caption>تفاصيل الرصد <span>الأسعار بالدينار الليبي لكل وحدة موضحة</span></caption>
            <thead><tr><th scope="col">الصنف / الوحدة</th><th scope="col">أول رصد</th><th scope="col">آخر رصد</th><th scope="col">الأدنى / الأعلى</th><th scope="col">التغير<small>د.ل / %</small></th></tr></thead>
            {Array.from(new Set(visible.map(item => item.category))).map(category => <tbody key={category}><tr className="harvest-market"><th scope="rowgroup" colSpan={5}>{category}</th></tr>
              {visible.filter(item => item.category === category).map(item => <tr key={item.id} data-currency={item.id}><th scope="row"><b>{item.name}</b><small>{item.unit}</small></th><td dir="ltr">{harvestNumber(item.open, item.id)}</td><td dir="ltr"><b>{harvestNumber(item.close, item.id)}</b></td>
                <td dir="ltr">{harvestNumber(item.low, item.id)} / {harvestNumber(item.high, item.id)}</td><td><span dir="ltr" className={`harvest-delta ${item.change && item.change > 0 ? 'harvest-up' : item.change && item.change < 0 ? 'harvest-down' : ''}`}>
                  {item.change === null ? 'غير كافٍ' : <><span>{item.change > 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : item.change < 0 ? <ArrowDownRight size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}{signed(item.change, item.id)}</span><small>{Math.abs(item.changePct!).toFixed(2)}%</small></>}</span></td></tr>)}</tbody>)}</table>
            {!!notes.length && <section className="harvest-summary"><h2>قراءة الأسبوع</h2><div>{notes.map((note, i) => {
              const up = /ارتفع|زاد/.test(note), down = /انخفض|تراجع/.test(note);
              const tone = up === down ? 'neutral' : up ? 'up' : 'down';
              const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus;
              return <div key={i} className={`harvest-summary-note harvest-note-${tone}`}><Icon size={15} aria-hidden="true" /><span>{note}</span></div>;
            })}</div></section>}
            <p className="harvest-method">أول وآخر رصد من السجلات المتاحة داخل الفترة. غياب الرصد في بعض الأيام لا يعني ثبات السعر. الأرقام للاسترشاد ولا تمثل عروض تنفيذ ملزمة.{dirty ? ' تتضمن النشرة تعديلات تحريرية.' : ''}</p>
          </div><footer className="harvest-sheet-footer"><div className="harvest-follow"><strong>تابع مؤشر الدينار</strong><div className="harvest-socials">
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer"><Send size={21} className="harvest-telegram" aria-hidden="true" /><span><b>تيليجرام</b><small dir="ltr">@libya_index_dollar</small></span></a>
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer"><Facebook size={21} className="harvest-facebook" aria-hidden="true" /><span><b>فيسبوك</b><small>مؤشر الدينار</small></span></a>
          </div></div><div className="harvest-footer-line"><strong>مؤشر الدينار · ليبيا</strong><span dir="ltr">dollar-price-qp14.onrender.com</span></div></footer>
        </article>
      </div></div>
      <div className="harvest-actions"><button className="harvest-primary" disabled={!canExport} onClick={() => act('download')}><Download size={18} />تحميل الصورة</button>
        <button disabled={!canExport} onClick={() => act('image')}><Copy size={17} />نسخ الصورة</button><button disabled={!canExport} onClick={() => act('text')}><FileText size={17} />نسخ التقرير</button>
        <button disabled={!canExport} onClick={() => act('me')}><Send size={17} />إرسال للإدارة</button><button disabled={!canExport || !config?.telegramPostChannel} onClick={() => act('channel')}><Send size={17} />نشر في القناة</button>
        {busy && <span role="status">{busy === 'share' ? 'جارٍ فتح خيارات المشاركة...' : 'جارٍ تجهيز النشرة...'}</span>}</div>
      {download && !loading && <section ref={downloadOptions} className="harvest-download" aria-label="خيارات حفظ الصورة"><div><strong>الصورة جاهزة</strong><span dir="ltr">PNG · {Math.round(download.file.size / 1024)} KB</span></div><div>
        <a className="harvest-primary" href={download.url} download={download.file.name}><Download size={18} aria-hidden="true" />حفظ ملف الصورة</a>
        {navigator.canShare?.({ files: [download.file] }) && <button disabled={!!busy} onClick={shareDownload}><Share2 size={18} aria-hidden="true" />مشاركة الصورة</button>}
        <a href={download.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true" />فتح الصورة</a>
      </div></section>}
    </>}
  </div>;
}
