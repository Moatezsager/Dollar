import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildCurrencyReport, CurrencyReport, CurrencyReportInput } from '../utils/currencyReport';
import './currency-pdf-report.css';

const site = 'https://dollar-price-qp14.onrender.com/';
const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const axisDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: '2-digit' });
const axisTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const stamp = (time: string | null | undefined, withTime = false) => time ? (withTime ? dateTime : date).format(new Date(time)) : 'غير متاح';

function ReportPage({ report: r, page, total, children }: { report: CurrencyReport; page: number; total: number; children: React.ReactNode }) {
  return <article className="currency-pdf-page" dir="rtl">
    <header className="currency-pdf-brand"><div><img src="/logo.png" width="44" height="44" alt="" /><div><b>مؤشر الدينار</b><span>أسعار العملات في ليبيا</span></div></div><p>تقرير عملة<span>أُعد في <bdi>{stamp(r.generatedAt, true)}</bdi></span></p></header>
    <div className="currency-pdf-body">{children}</div>
    <footer className="currency-pdf-footer"><div><b>مؤشر الدينار</b><span dir="ltr">dollar-price-qp14.onrender.com</span></div><span>توقيت طرابلس · صفحة {page} من {total}</span></footer>
  </article>;
}

export function CurrencyPdfReport({ report: r }: { report: CurrencyReport }) {
  const number = (value: number | null | undefined) => value === null || value === undefined ? 'غير متاح' : value.toFixed(r.decimals);
  const signed = r.change === null ? '' : `${r.change > 0 ? '+' : ''}${number(r.change)}`;
  const color = r.change !== null && r.change < 0 ? '#be123c' : '#047857';
  const pages = Math.ceil(r.days.length / 22);
  const chart = r.points.map(point => ({ ...point, time: Date.parse(point.time) }));
  const intraday = r.first && r.last && Date.parse(r.last.time) - Date.parse(r.first.time) < 172800000 && r.market !== 'official';
  return <>
    <ReportPage report={r} page={1} total={pages + 1}>
      <div className="currency-pdf-title"><div><p>{r.marketName}</p><h1>{r.name}</h1></div><b dir="ltr">{r.code}</b></div>
      <section className="currency-pdf-quote"><div><span>السعر المتاح وقت إعداد التقرير</span><p dir="ltr"><strong>{number(r.price)}</strong> <small>د.ل</small></p><span>دينار ليبي {r.unit}</span></div>
        <dl><div><dt>آخر تغير للسعر</dt><dd dir="ltr">{stamp(r.lastChanged, r.market !== 'official')}</dd></div><div><dt>تحديث البيانات</dt><dd dir="ltr">{stamp(r.lastUpdated, true)}</dd></div></dl>
      </section>
      <section className="currency-pdf-movement"><div><h2>حركة السعر</h2><p>{r.rangeLabel}</p></div><div><b dir="ltr" style={{ color }}>{r.change === null ? 'بيانات محدودة' : `${signed} د.ل`}</b><span>{r.changePercent === null ? 'لا تكفي القراءات للمقارنة' : <><bdi>{r.changePercent > 0 ? '+' : ''}{r.changePercent.toFixed(r.market === 'official' ? 4 : 2)}%</bdi> بين أول وآخر رصد</>}</span></div></section>
      <p className="currency-pdf-period">{r.first ? <>الفترة المرصودة: <bdi>{stamp(r.first.time, !!intraday)}</bdi> إلى <bdi>{stamp(r.last.time, !!intraday)}</bdi></> : 'لا توجد قراءات تاريخية متاحة للفترة المختارة'}</p>
      <div className="currency-pdf-chart" dir="ltr">
        {chart.length >= 2 ? <AreaChart width={706} height={232} data={chart} margin={{ top: 12, right: 64, left: 12, bottom: 10 }}>
          <defs><linearGradient id="currency-pdf-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.18} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#dce5e4" strokeDasharray="3 5" />
          <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => (intraday ? axisTime : axisDay).format(new Date(value))} axisLine={false} tickLine={false} minTickGap={55} tick={{ fill: '#52656f', fontSize: 11, fontFamily: 'Arial' }} />
          <YAxis orientation="right" mirror width={64} domain={['auto', 'auto']} tickFormatter={value => Number(value).toFixed(r.decimals)} axisLine={false} tickLine={false} tick={{ fill: '#52656f', fontSize: 11, fontFamily: 'Arial' }} />
          <Area type={r.market === 'official' ? 'stepAfter' : 'monotoneX'} dataKey="value" stroke={color} strokeWidth={2.5} fill="url(#currency-pdf-fill)" isAnimationActive={false} dot={false} />
          <ReferenceDot x={chart[chart.length - 1].time} y={chart[chart.length - 1].value} r={4} fill={color} stroke="white" strokeWidth={2} />
        </AreaChart> : <p>{chart.length ? 'قراءة واحدة فقط؛ لا يمكن رسم حركة سعر موثوقة.' : 'لا توجد بيانات تاريخية؛ لم تُنشأ أسعار بديلة.'}</p>}
      </div>
      <div className="currency-pdf-stats">{[['أعلى رصد', r.high], ['أدنى رصد', r.low], ['متوسط القراءات', r.avg]].map(([label, value]) => <div key={label as string}><span>{label}</span><b dir="ltr">{number(value as number | null)} <small>د.ل</small></b></div>)}<div><span>{r.market === 'official' ? 'الأيام المرصودة' : 'القراءات المتاحة'}</span><b>{r.points.length}<small> خلال {r.days.length} يوم</small></b></div></div>
      <section className="currency-pdf-reading"><h2>خلاصة الفترة</h2>
        {r.change === null ? <p>البيانات التاريخية غير كافية لحساب التغير. السعر أعلاه هو السعر المتاح عند إنشاء التقرير، وليس دليلًا على ثباته خلال الفترة.</p> : <p>بدأ الرصد عند <bdi>{number(r.first.value)}</bdi> وانتهى عند <bdi>{number(r.last.value)}</bdi> د.ل. {r.change === 0 ? 'لم يتغير السعر بين أول وآخر قراءة.' : <>بفارق {r.change > 0 ? 'ارتفاع' : 'انخفاض'} قدره <bdi>{number(Math.abs(r.change))}</bdi> د.ل {r.unit}.</>} تراوحت القراءات بين <bdi>{number(r.low)}</bdi> و<bdi>{number(r.high)}</bdi> د.ل.</p>}
      </section>
      {r.conversion && <div className="currency-pdf-conversion"><div><h2>{r.isMetal ? 'قيمة الكمية بالسعر الحالي' : 'تحويل بالسعر الحالي'}</h2><span><bdi>{r.conversion.amount.toLocaleString('en-GB', { maximumFractionDigits: 6 })}</bdi> {r.isMetal ? r.unit.replace('لكل ', '').replace('للقطعة', 'قطعة') : 'وحدة من العملة'}</span></div><b dir="ltr">{r.conversion.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: r.decimals })} <small>د.ل</small></b></div>}
      {r.advanced && <p className="currency-pdf-long-range">آخر 30 يومًا من السجل المتاح: الأعلى <bdi>{number(r.advanced.resistance)}</bdi> · الأدنى <bdi>{number(r.advanced.support)}</bdi> · المتوسط <bdi>{number(r.advanced.ma30)}</bdi> د.ل.</p>}
      <aside className="currency-pdf-method"><b>عن هذه الأرقام</b><p>{r.market === 'official' ? 'يُعرض آخر سعر رسمي متاح لكل يوم، دون تحويل الرصد اليومي إلى قراءات ساعية.' : 'الحركة والإحصاءات تخص القراءات المتاحة في الفترة المختارة فقط، وقد تتضمن سجلات مضغوطة إلى متوسط يومي.'} المتوسط حسابي للقراءات المعروضة، وليس متوسط التداول المرجح. غياب الرصد لا يعني ثبات السعر. هذه لقطة محفوظة لا تتحدث بعد مشاركتها؛ الأسعار للاسترشاد وليست عرض تنفيذ أو توصية مالية.</p></aside>
    </ReportPage>
    {Array.from({ length: pages }, (_, index) => <ReportPage key={index} report={r} page={index + 2} total={pages + 1}>
      <div className="currency-pdf-title"><div><p>{r.marketName}</p><h1>الملخص اليومي · {r.name}</h1></div><b dir="ltr">{r.code}</b></div>
      <p className="currency-pdf-table-note">{r.market === 'official' ? 'آخر رصد رسمي لكل يوم متاح.' : 'ملخص جميع القراءات المعروضة، مجمّع حسب يوم طرابلس. لا يمثل سجلًا لكل صفقة أو نشرة افتتاح وإغلاق.'} كل الأسعار بالدينار الليبي {r.unit}.</p>
      <table className={r.market === 'official' ? 'currency-pdf-official-table' : ''}><thead><tr><th>التاريخ</th>{r.market === 'official' ? <><th>السعر الرسمي</th><th>التغير عن الرصد السابق</th></> : <><th>أول رصد</th><th>آخر رصد</th><th>الأدنى</th><th>الأعلى</th><th>المتوسط</th><th>العدد</th></>}</tr></thead><tbody>{r.days.slice(index * 22, (index + 1) * 22).map((row, rowIndex) => {
        const previous = r.days[index * 22 + rowIndex - 1];
        const change = previous ? (Math.round(row.last * 10000) - Math.round(previous.last * 10000)) / 10000 : null;
        return <tr key={row.day}><td dir="ltr">{row.day.split('-').reverse().join('/')}</td>{r.market === 'official' ? <><td dir="ltr"><b>{number(row.last)}</b></td><td dir="ltr">{change === null ? 'غير متاح' : `${change > 0 ? '+' : ''}${number(change)}`}</td></> : <>{[row.first, row.last, row.low, row.high, row.avg].map((value, i) => <td dir="ltr" key={i}>{number(value)}</td>)}<td>{row.count}</td></>}</tr>;
      })}</tbody></table>
      <p className="currency-pdf-table-note">لم تُملأ الأيام المفقودة بأسعار تقديرية. التغير في الصفحة الأولى محسوب بين أول وآخر رصد فعلي، لا بين السعر الحالي وأول يوم مفترض.</p>
    </ReportPage>)}
  </>;
}

export async function createCurrencyPdf(input: CurrencyReportInput, signal: AbortSignal, progress: (label: string) => void) {
  const report = buildCurrencyReport(input);
  signal.throwIfAborted();
  const host = document.createElement('div');
  host.className = 'currency-pdf-render'; host.setAttribute('aria-hidden', 'true'); host.inert = true;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<CurrencyPdfReport report={report} />));
    signal.throwIfAborted();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: `${report.name} | ${report.marketName}`, author: 'مؤشر الدينار', subject: 'Currency price report', creator: 'Dollar Price' });
    const pages = [...host.querySelectorAll<HTMLElement>('.currency-pdf-page')];
    for (const [index, page] of pages.entries()) {
      signal.throwIfAborted(); progress(`جارٍ إعداد الصفحة ${index + 1} من ${pages.length}`);
      const body = page.querySelector<HTMLElement>('.currency-pdf-body')!;
      if (body.scrollHeight > body.clientHeight + 2) throw new Error('تعذر تنسيق التقرير بالكامل. اختر فترة أقصر وأعد المحاولة.');
      const canvas = await html2canvas(page, { scale: 1.6, backgroundColor: '#ffffff', logging: false, useCORS: false, imageTimeout: 5000,
        windowWidth: 1024, windowHeight: 1280, scrollX: 0, scrollY: 0 });
      try {
        signal.throwIfAborted();
        if (index) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        doc.link(12, 278, 186, 14, { url: site });
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    signal.throwIfAborted();
    const file = new File([doc.output('blob')], `dinar-${report.code.replace(/[^a-z0-9_-]/gi, '_')}-${report.market}-${libyaFileDate(report.generatedAt)}.pdf`, { type: 'application/pdf' });
    return { file, generatedAt: report.generatedAt };
  } finally { root.unmount(); host.remove(); }
}

function libyaFileDate(time: string) { return date.format(new Date(time)).split('/').reverse().join('-'); }
