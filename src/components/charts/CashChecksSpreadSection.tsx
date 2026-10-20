import React, { useEffect, useId, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Banknote, Calculator, ChartNoAxesCombined, ChevronDown, Clock3, DollarSign, Landmark, List, Minus, Scale, WifiOff } from 'lucide-react';
import { HistoryPoint, Rates } from '../../types/rates';
import { buildSpreadModel, compareSpreadAmount, SPREAD_MAX_AMOUNT, SpreadBin, SpreadMetric, spreadNumber, SpreadRange, spreadReading } from '../../utils/cashChecksSpread';
import { formatLibyaDate } from '../../utils/rateHistory';
import '../../styles/cash-checks-spread.css';

interface Props { history: HistoryPoint[]; rates: Rates | null; isOffline?: boolean }
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const moment = (time: number) => `${formatLibyaDate(time)} · ${clock.format(time)}`;
const ranges = [{ value: 1, label: 'اليوم' }, { value: 7, label: '7 أيام' }, { value: 30, label: '30 يومًا' }] as const;
const metrics = [{ value: 'gap', label: 'الفرق د.ل' }, { value: 'premium', label: 'النسبة %' }, { value: 'prices', label: 'السعران' }] as const;

function BinTooltip({ bin, range }: { bin: SpreadBin; range: SpreadRange }) {
  if (!bin.count) return null;
  return <div className="spread-tooltip" dir="rtl">
    <strong>{range === 1 ? `${formatLibyaDate(bin.time)} · ساعة ${clock.format(bin.time)}` : formatLibyaDate(bin.time)}</strong>
    <span>{range === 1 ? 'متوسط لقطات الساعة' : 'متوسط لقطات اليوم'} · {bin.count} لقطة</span>
    <dl>
      <div><dt>كاش</dt><dd dir="ltr">{spreadNumber(bin.cash!)} د.ل</dd></div>
      <div><dt>صكوك</dt><dd dir="ltr">{spreadNumber(bin.checks!)} د.ل</dd></div>
      <div><dt>الفرق</dt><dd dir="ltr">{spreadNumber(bin.gap!, true)} د.ل</dd></div>
      <div><dt>نسبة الفجوة</dt><dd dir="ltr">{spreadNumber(bin.premium!, true)}%</dd></div>
    </dl>
  </div>;
}

export function CashChecksSpreadSection({ history, rates, isOffline = false }: Props) {
  const [range, setRange] = useState<SpreadRange>(30);
  const [metric, setMetric] = useState<SpreadMetric>('prices');
  const [amount, setAmount] = useState('1000');
  const fillId = useId();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const updateClock = () => { if (document.visibilityState !== 'hidden') setNow(Date.now()); };
    const timer = setInterval(updateClock, 60000);
    document.addEventListener('visibilitychange', updateClock);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', updateClock); };
  }, []);
  const model = useMemo(() => buildSpreadModel(history, rates, range, Math.max(now, Date.now())), [history, rates, range, now]);
  const reading = useMemo(() => spreadReading(model), [model]);
  const { latest, first, last, reference } = model;
  const comparison = useMemo(() => compareSpreadAmount(latest, amount), [latest, amount]);
  const amountError = amount !== '' && latest !== null && comparison === null;
  const amountDirection = !comparison ? '' : Math.abs(comparison.gap) < 0.00000001 ? 'نفس المقابل بالطريقتين' : comparison.gap > 0 ? 'المقابل بالصكوك أعلى' : 'المقابل بالصكوك أقل';
  const validBins = model.bins.filter(bin => bin.count);
  const observationDots = validBins.length < 3 || model.bins.some(bin => !bin.count)
    ? { r: 3, fill: 'var(--surface)', strokeWidth: 2 } : false;
  const chartValues = validBins.flatMap(bin => metric === 'prices' ? [bin.cash!, bin.checks!] : [bin[metric]!]);
  const axisSpan = chartValues.length ? metric === 'prices' ? Math.max(...chartValues) - Math.min(...chartValues) : Math.max(...chartValues.map(Math.abs)) : 1;
  const axisDigits = Math.max(2, Math.min(6, Math.ceil(-Math.log10(axisSpan || 1)) + 1));
  const status = isOffline ? 'غير متصل' : model.pending ? 'بانتظار لقطة أحدث' : model.stale ? 'لقطة قديمة' : 'آخر لقطة مشتركة';
  const StatusIcon = isOffline ? WifiOff : Clock3;
  const TrendIcon = model.change == null || Math.abs(model.change) < 0.00000001 ? Minus : model.change > 0 ? ArrowUpRight : ArrowDownRight;
  const positionLabel = { above: 'أعلى من نطاق المقارنة', below: 'أقل من نطاق المقارنة', within: 'ضمن نطاق المقارنة', insufficient: 'السجل السابق غير كافٍ' }[model.position];
  const plottedLabel = range === 1 ? 'متوسطات ساعية' : 'متوسطات يومية';
  const chartLabel = metric === 'prices' ? 'مقارنة سعري الدولار الكاش والصكوك' : metric === 'premium' ? 'نسبة فجوة الكاش والصكوك' : 'فرق سعر الصكوك عن الكاش';

  return <section className="cash-spread" aria-labelledby="spread-heading">
    <header className="spread-heading">
      <div className="spread-heading-copy"><span className="spread-eyebrow"><DollarSign size={17} aria-hidden="true" />USD / LYD · السوق الموازي</span>
        <h3 id="spread-heading">فجوة الكاش والصكوك</h3><p>مقارنة سعر الدولار كاش وبالصكوك</p></div>
      <div className={`spread-status ${model.stale || model.pending || isOffline ? 'is-caution' : ''}`} role="status">
        <StatusIcon size={15} aria-hidden="true" /><span>{latest ? status : 'لا توجد لقطة مشتركة'}</span>
        {latest && <time dateTime={new Date(latest.time).toISOString()} dir="ltr">{moment(latest.time)}</time>}
      </div>
    </header>

    {(isOffline || model.stale || model.pending) && latest && <p className="spread-notice">
      {isOffline ? 'أنت غير متصل؛ هذه مقارنة من البيانات المحفوظة وليست تحديثًا مباشرًا. '
        : model.pending ? 'تغيّر السعر المعروض ولم تصل لقطة مشتركة مطابقة بعد؛ نحتفظ بآخر مقارنة موثّقة في السجل. '
        : 'مرّ أكثر من 12 ساعة على آخر لقطة مشتركة؛ اقرأ النتائج كتاريخ محفوظ، لا كسعر حالي. '}
      {model.pending && isOffline ? 'توجد أيضًا أسعار أحدث لم تُطابق بالسجل بعد.' : ''}
    </p>}

    {latest ? <>
      <div className="spread-overview">
        <dl className="spread-quote spread-quote-cash"><dt><Banknote size={18} aria-hidden="true" />دولار كاش</dt>
          <dd><div><strong dir="ltr">{spreadNumber(latest.cash)}</strong><span>د.ل</span></div><small>مقابل دولار واحد</small></dd></dl>
        <dl className="spread-quote spread-quote-checks"><dt><Landmark size={18} aria-hidden="true" />دولار صكوك</dt>
          <dd><div><strong dir="ltr">{spreadNumber(latest.checks)}</strong><span>د.ل</span></div><small>مقابل دولار واحد</small></dd></dl>
        <div className="spread-main-value"><span><Scale size={16} aria-hidden="true" />فرق السعر لكل دولار</span><div><strong dir="ltr">{spreadNumber(latest.gap, true)}</strong><span>د.ل</span></div>
          <p><b dir="ltr">{spreadNumber(latest.premium, true)}%</b><span>من سعر الكاش</span></p>
          <h4>{reading.headline}</h4></div>
      </div>
      <section className="spread-amount-tool" aria-labelledby="spread-amount-heading">
        <h4 id="spread-amount-heading"><Calculator size={19} aria-hidden="true" />احسب الفرق الآن</h4>
        <div className="spread-amount-body">
          <div className="spread-amount-field">
            <label htmlFor="spread-amount">المبلغ بالدولار</label>
            <div><input id="spread-amount" type="number" inputMode="decimal" dir="ltr" min="0" max={SPREAD_MAX_AMOUNT} step="any"
              value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" aria-invalid={amountError}
              aria-describedby={amountError ? 'spread-amount-error spread-amount-note' : 'spread-amount-note'} /><span aria-hidden="true">USD</span></div>
          </div>
          <dl className="spread-amount-results" aria-label="نتيجة مقارنة المبلغ">
            <div><dt><Banknote size={15} aria-hidden="true" />المقابل كاش</dt><dd><strong dir="ltr">{comparison ? spreadNumber(comparison.cash) : '—'}</strong><span>د.ل</span></dd></div>
            <div><dt><Landmark size={15} aria-hidden="true" />المقابل بالصكوك</dt><dd><strong dir="ltr">{comparison ? spreadNumber(comparison.checks) : '—'}</strong><span>د.ل</span></dd></div>
            <div className="spread-amount-difference" role="status" aria-live="polite" aria-atomic="true"><dt>فرق مبلغك</dt><dd><strong dir="ltr">{comparison ? spreadNumber(comparison.gap, true) : '—'}</strong><span>د.ل</span></dd>
              <span>{comparison ? amountDirection : 'أدخل مبلغًا للمقارنة'}</span></div>
          </dl>
        </div>
        {amountError && <p id="spread-amount-error" className="spread-amount-error" role="alert">تعذّر حساب المبلغ. أدخل رقمًا من 0 إلى 1,000,000,000 دولار.</p>}
        <p id="spread-amount-note">حسب السعرين أعلاه، قبل الرسوم وشروط التسوية. الفرق ليس عمولة أو ربحًا مضمونًا.</p>
      </section>
    </> : <div className="spread-empty" role="status"><Scale size={30} aria-hidden="true" /><h4>{reading.headline}</h4><p>{reading.detail}</p></div>}

    <div className="spread-period-toolbar">
      <h4><Scale size={18} aria-hidden="true" />خلاصة الفترة</h4>
      <div className="spread-segmented" role="group" aria-label="فترة فجوة الكاش والصكوك">{ranges.map(item => <button key={item.value}
        aria-pressed={range === item.value} onClick={() => setRange(item.value)}>{item.label}</button>)}</div>
    </div>
    {latest && <div className="spread-reading">
      <p><strong>حركة الفجوة: </strong>{reading.movement}</p>
      {reading.priceMovement && <p>{reading.priceMovement}</p>}
    </div>}

    <div className="spread-chart-toolbar">
      <div><h4>{chartLabel}</h4><span>{plottedLabel} بتوقيت ليبيا</span></div>
      <div className="spread-controls">
        <div className="spread-segmented spread-metrics" role="group" aria-label="عرض رسم الفجوة">{metrics.map(item => <button key={item.value}
          aria-pressed={metric === item.value} onClick={() => setMetric(item.value)}>{item.label}</button>)}</div>
      </div>
    </div>

    <div className="spread-chart market-chart" role="group" aria-label={chartLabel}>
      {validBins.length ? <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={model.bins} accessibilityLayer margin={{ top: 22, right: 8, bottom: 8, left: 8 }}>
          <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--positive)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--positive)" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} axisLine={false} tickLine={false}
            minTickGap={36} tickMargin={10} padding={{ left: 10, right: 10 }} tick={{ fill: 'var(--muted-ink)', fontSize: 12 }} tickFormatter={time => range === 1 ? clock.format(time) : formatLibyaDate(time).slice(0, 5)} />
          <YAxis orientation="right" width={axisDigits > 3 ? 88 : metric === 'premium' ? 76 : 66} tickCount={4} tickMargin={8} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-ink)', fontSize: 12 }}
            domain={metric === 'prices' ? ['auto', 'auto'] : [(min: number) => Math.min(0, min), 'auto']}
            tickFormatter={value => `${Number(value).toFixed(axisDigits)}${metric === 'premium' ? '%' : ''}`} />
          {metric !== 'prices' && <ReferenceLine y={0} stroke="var(--muted-ink)" strokeOpacity={0.5} />}
          {metric !== 'prices' && reference && <ReferenceLine y={reference[metric]} stroke="var(--gold)" strokeDasharray="4 4" ifOverflow="extendDomain" />}
          <Tooltip content={({ active, payload }) => active && payload?.[0]?.payload ? <BinTooltip bin={payload[0].payload as SpreadBin} range={range} /> : null} />
          {metric === 'prices' ? <>
            <Line dataKey="cash" name="كاش" stroke="var(--positive)" strokeWidth={2.8} type="monotoneX" strokeLinecap="round" strokeLinejoin="round" connectNulls={false} dot={observationDots} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={false} />
            <Line dataKey="checks" name="صكوك" stroke="var(--official)" strokeWidth={2.8} strokeDasharray="6 4" type="monotoneX" strokeLinecap="round" strokeLinejoin="round" connectNulls={false} dot={observationDots} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={false} />
          </> : <Area dataKey={metric} name={metric === 'gap' ? 'الفرق' : 'النسبة'} stroke="var(--positive)" fill={`url(#${fillId})`}
            strokeWidth={2.8} type="monotoneX" strokeLinecap="round" strokeLinejoin="round" connectNulls={false} dot={observationDots} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer> : <div className="spread-empty"><ChartNoAxesCombined size={28} aria-hidden="true" /><h4>لا توجد لقطات مشتركة في هذه الفترة</h4><p>الأيام الناقصة لا تُملأ بأرقام تقديرية، ولا يُعرض سعر غير موثّق كبديل.</p></div>}
    </div>
    <div className="spread-chart-caption">
      <div className="spread-legend">{metric === 'prices' ? <><span><i className="cash-line" />كاش</span><span><i className="checks-line" />صكوك</span></>
        : <><span><i className="cash-line" />{metric === 'gap' ? 'متوسط الفرق' : 'متوسط النسبة'}</span>{reference && <span><i className="reference-line" />وسيط الأيام السابقة</span>}</>}</div>
      <span>{model.observedDays} يوم رصد من {range} · {model.selected.length} لقطة مشتركة</span>
    </div>

    <details className="spread-insights"><summary><ChartNoAxesCombined size={18} aria-hidden="true" /><span>تفاصيل وإحصاءات الفترة</span><ChevronDown size={17} aria-hidden="true" /></summary>
    <dl className="spread-statistics">
      {[
        { label: 'أعلى فرق مسجّل', value: model.max }, { label: 'أقل فرق مسجّل', value: model.min },
        { label: 'متوسط الفجوة اليومي', value: model.meanGap }, { label: 'التغير في الفرق', value: model.change },
      ].map((stat, index) => <div key={stat.label}><dt>{stat.label}</dt><dd>{index === 3 && stat.value !== null && <TrendIcon size={17} aria-hidden="true" />}
        <strong dir="ltr">{stat.value === null ? '—' : spreadNumber(stat.value, index === 3)}</strong><span>د.ل / دولار</span></dd></div>)}
    </dl>
    {first && last && <p className="spread-period">الفترة المرصودة فعليًا: <time dateTime={new Date(first.time).toISOString()}>{moment(first.time)}</time><span> إلى </span><time dateTime={new Date(last.time).toISOString()}>{moment(last.time)}</time></p>}

    <div className="spread-reference">
      <div><ChartNoAxesCombined size={18} aria-hidden="true" /><h4>مقارنة بالأيام السابقة</h4><span>{positionLabel}</span></div>
      <p>{reading.comparison}</p>
      {reference && <p>وسيط النسبة: <b dir="ltr">{spreadNumber(reference.premium)}%</b>. النطاق بين الربع الأول والثالث لمتوسطات الأيام؛ وصف للسجل، مش توقع للسعر الجاي.</p>}
    </div>
    </details>

    {validBins.length > 0 && <details className="spread-records"><summary><List size={18} aria-hidden="true" /><span>سجل المقارنة</span><small>{validBins.length} {range === 1 ? 'ساعة مرصودة' : 'يومًا مرصودًا'}</small><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="spread-table-wrap"><table><caption>{plottedLabel} للقطات المشتركة، وليست أسعار إغلاق</caption>
        <thead><tr><th scope="col">{range === 1 ? 'الساعة' : 'التاريخ'}</th><th scope="col">كاش</th><th scope="col">صكوك</th><th scope="col">الفرق د.ل</th><th scope="col">النسبة</th></tr></thead>
        <tbody>{[...validBins].reverse().map(bin => <tr key={bin.time}><th scope="row"><time dateTime={new Date(bin.time).toISOString()} dir="ltr">{range === 1 ? clock.format(bin.time) : formatLibyaDate(bin.time)}</time></th>
          <td dir="ltr">{spreadNumber(bin.cash!)}</td><td dir="ltr">{spreadNumber(bin.checks!)}</td><td dir="ltr">{spreadNumber(bin.gap!, true)}</td><td dir="ltr">{spreadNumber(bin.premium!, true)}%</td></tr>)}</tbody>
      </table></div>
    </details>}

    <details className="spread-methodology"><summary><Scale size={17} aria-hidden="true" />كيف تُحسب هذه المقارنة؟<ChevronDown size={17} aria-hidden="true" /></summary>
      <div><p><strong>الفرق بالدينار:</strong> سعر الدولار صكوك ناقص سعر الدولار كاش. القيمة الموجبة تعني أن الصكوك أعلى، والسالبة تعني أنها أقل.</p>
        <p><strong>نسبة الفجوة:</strong> الفرق مقسومًا على سعر الكاش، مضروبًا في 100. مثال توضيحي: كاش 10.00 وصكوك 10.50 يعطي فرقًا 0.50 د.ل ونسبة 5.00%.</p>
        <p>نستخدم سعر الكاش والصكوك الموحّدة من لقطة حفظ مشتركة، ولا نستبدل الصكوك بسعر مصرف محدد أو نكملها من لقطة أخرى. السجل القديم غير المعلّم كلقطة مشتركة يُستبعد.</p>
        <p>الرسم يعرض متوسطات اللقطات داخل كل ساعة أو يوم؛ الأعلى والأقل من اللقطات الأصلية. المتوسط العام يعطي كل يوم مرصود وزنًا متساويًا، وليس متوسطًا موزونًا بحجم التداول.</p>
        <p>كبر الفجوة أو ضيقها يصف الفرق بين السعرين، وليس ارتفاع الدولار أو هبوطه بالضرورة. تساوي أول رصد وآخر رصد لا يثبت ثبات السعر بينهما.</p>
        <p>فرق التسعير مش عمولة ولا ربح مضمون، والأرقام قبل الرسوم وشروط التسوية. السجل لا يحدد سبب تحرّك السوق.</p>
        <p>وقت اللقطة هو وقت حفظ البيانات؛ لا يثبت تزامن التداول في المصادر أو توفر تنفيذ بهذا السعر. المقارنة مرجعية، ولا تشمل الرسوم أو شروط التسوية، ولا تقدم توصية شراء أو بيع.</p></div>
    </details>
  </section>;
}
