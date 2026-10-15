import React, { useEffect, useRef, useState } from 'react';
import { Download, Send, Facebook, RefreshCw, Copy, Check, Eye, SlidersHorizontal, RotateCcw, ArrowUpRight, ArrowDownRight, Minus, FileText, Banknote, FileCheck2, Euro } from 'lucide-react';
import { toPng } from 'html-to-image';
import { harvestNotes, harvestNumber, WeeklyHarvestData, WeeklyItem } from '../../shared/weeklyHarvest';
import '../styles/weekly-harvest.css';

interface Props { token: string; config: any; setError: (message: string) => void; setSuccess: (message: string) => void }
const fields = [['open', 'أول رصد'], ['close', 'آخر رصد'], ['high', 'الأعلى'], ['low', 'الأدنى']] as const;
const signed = (value: number, id: string) => `${value > 0 ? '+' : ''}${harvestNumber(value, id)}`;
const highlightIcons = { USD: Banknote, USD_CHECKS: FileCheck2, EUR: Euro };
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
  const wrapper = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const visible = items.filter(item => !hidden.includes(item.id));
  const notes = noteDraft === null ? harvestNotes(visible) : noteDraft.split('\n').map(line => line.trim()).filter(Boolean);
  const invalid = visible.some(item => fields.some(([key]) => !Number.isFinite(item[key]) || item[key] <= 0) ||
    item.high < Math.max(item.open, item.close, item.low) || item.low > Math.min(item.open, item.close, item.high));
  const canExport = !!data && visible.length > 0 && !invalid && !!title.trim() && !loading && !busy;
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
        const png = await toPng(card.current!, { pixelRatio: 1.2, backgroundColor: '#ffffff', style: { transform: 'none', position: 'static' } });
        const blob = await (await fetch(png)).blob();
        if (blob.size > 5 * 1024 * 1024) throw new Error('الصورة أكبر من 5 ميجابايت. قلل الأصناف أو طول النص.');
        if (action === 'download') {
          const link = document.createElement('a'); link.href = png; link.download = `weekly-harvest-${data!.start.slice(0, 10)}.png`; link.click();
        } else if (action === 'image') {
          if (!window.ClipboardItem) throw new Error('نسخ الصور غير مدعوم في هذا المتصفح. استخدم تحميل الصورة.');
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } else {
          const caption = [title, data!.dateRange, '', ...notes, '', `تابعنا على تيليجرام: ${telegramUrl}`, `فيسبوك: ${facebookUrl}`, 'https://dollar-price-qp14.onrender.com/'].join('\n');
          if (caption.length > 1024) throw new Error('نص النشرة أطول من حد الإرسال. اختصر الملاحظات إلى 1024 حرفًا مع العنوان والتاريخ.');
          const response = await fetch('/api/admin/weekly-harvest/send-telegram', { method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ imageBase64: png, caption, destination: action === 'me' ? 'me' : 'channel' }) });
          const json = await response.json();
          if (!response.ok || !json.success) throw new Error(json.error || 'تعذر إرسال النشرة.');
        }
      }
      const message = action === 'download' ? 'تم تحميل النشرة.' : action === 'text' ? 'تم نسخ التقرير.' : action === 'image' ? 'تم نسخ الصورة.' : action === 'me' ? 'أُرسلت المعاينة إلى محادثة الإدارة.' : 'نُشرت النشرة في القناة.';
      setFeedback(message); setSuccess(message);
    } catch (err: any) { const message = err.message || 'تعذر إتمام العملية. حاول مجددًا.'; setLocalError(message); setError(message); }
    finally { operation.current = false; setBusy(''); }
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
          <header className="harvest-sheet-head"><div className="harvest-brand"><img src="/logo.png" alt="مؤشر الدينار" width={82} height={82} /><div><strong>مؤشر الدينار</strong><span>رصد أسعار العملات في ليبيا</span></div></div><span className="harvest-edition">النشرة الأسبوعية<br /><b>7 أيام من حركة السوق</b></span></header>
          <div className="harvest-sheet-title"><div><span className="harvest-sheet-kicker">العملات · الحوالات · المعادن</span><h1>{title}</h1></div><div className="harvest-period"><p>{data.dateRange}</p><span>سبعة أيام مكتملة · توقيت طرابلس</span></div></div>
          <div className="harvest-highlights">{visible.filter(item => item.id in highlightIcons).map(item => {
            const Icon = highlightIcons[item.id as keyof typeof highlightIcons];
            return <div key={item.id} data-currency={item.id}><div className="harvest-highlight-label"><Icon size={23} aria-hidden="true" /><span>{item.name}</span><small>{item.code}</small></div><strong dir="ltr">{harvestNumber(item.close, item.id)} <small>د.ل</small></strong>
              <span className={`harvest-highlight-change ${item.change && item.change > 0 ? 'harvest-up' : item.change && item.change < 0 ? 'harvest-down' : ''}`} dir="ltr">{item.change === null ? 'بيانات محدودة' : <>{item.change > 0 ? <ArrowUpRight size={16} /> : item.change < 0 ? <ArrowDownRight size={16} /> : <Minus size={16} />}{signed(item.change, item.id)} <small>({item.changePct!.toFixed(2)}%)</small></>}</span><span className="harvest-highlight-caption">آخر رصد خلال الفترة</span></div>;
          })}</div>
          <div className="harvest-sheet-body">{Array.from(new Set(visible.map(item => item.category))).map((category, index) => <section key={category} className="harvest-market"><h2><b><small dir="ltr">{String(index + 1).padStart(2, '0')}</small>{category}</b><span>السعر بالدينار الليبي</span></h2>
            <table><thead><tr><th>الصنف / الوحدة</th><th>أول رصد</th><th>آخر رصد</th><th>الأدنى / الأعلى</th><th>التغير</th><th>أيام الرصد</th></tr></thead>
              <tbody>{visible.filter(item => item.category === category).map(item => <tr key={item.id}><th scope="row"><b>{item.name}</b><small>{item.unit}</small></th><td dir="ltr">{harvestNumber(item.open, item.id)}</td><td dir="ltr"><b>{harvestNumber(item.close, item.id)}</b></td>
                <td dir="ltr">{harvestNumber(item.low, item.id)} / {harvestNumber(item.high, item.id)}</td><td><span dir="ltr" className={`harvest-delta ${item.change && item.change > 0 ? 'harvest-up' : item.change && item.change < 0 ? 'harvest-down' : ''}`}>
                  {item.change === null ? 'غير كافٍ' : <>{item.change > 0 ? <ArrowUpRight size={15} /> : item.change < 0 ? <ArrowDownRight size={15} /> : <Minus size={15} />}{Math.abs(item.changePct!).toFixed(2)}%</>}</span></td><td dir="ltr">{item.days} / 7</td></tr>)}</tbody></table></section>)}
            {!!notes.length && <section className="harvest-summary"><h2>قراءة الأسبوع</h2>{notes.map((note, i) => <p key={i}>{note}</p>)}</section>}
            <p className="harvest-method">أول وآخر رصد من السجلات المتاحة داخل الفترة. غياب الرصد في بعض الأيام لا يعني ثبات السعر. الأرقام للاسترشاد ولا تمثل عروض تنفيذ ملزمة.{dirty ? ' تتضمن النشرة تعديلات تحريرية.' : ''}</p>
          </div><footer className="harvest-sheet-footer"><div className="harvest-follow"><div><span>ابقَ على اطلاع</span><strong>تابع مؤشر الدينار</strong><p>أسعار العملات ونشرات السوق</p></div><div className="harvest-socials">
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer"><span className="harvest-social-icon harvest-telegram"><Send size={26} aria-hidden="true" /></span><span><b>تيليجرام</b><small dir="ltr">@libya_index_dollar</small></span></a>
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer"><span className="harvest-social-icon harvest-facebook"><Facebook size={26} aria-hidden="true" /></span><span><b>فيسبوك</b><small>مؤشر الدينار</small></span></a>
          </div></div><div className="harvest-footer-line"><strong>مؤشر الدينار · ليبيا</strong><span dir="ltr">dollar-price-qp14.onrender.com</span></div></footer>
        </article>
      </div></div>
      <div className="harvest-actions"><button className="harvest-primary" disabled={!canExport} onClick={() => act('download')}><Download size={18} />تحميل الصورة</button>
        <button disabled={!canExport} onClick={() => act('image')}><Copy size={17} />نسخ الصورة</button><button disabled={!canExport} onClick={() => act('text')}><FileText size={17} />نسخ التقرير</button>
        <button disabled={!canExport} onClick={() => act('me')}><Send size={17} />إرسال للإدارة</button><button disabled={!canExport || !config?.telegramPostChannel} onClick={() => act('channel')}><Send size={17} />نشر في القناة</button>
        {busy && <span role="status">جارٍ تجهيز النشرة...</span>}</div>
    </>}
  </div>;
}
