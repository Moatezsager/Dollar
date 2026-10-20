import React, { useId, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { ChartNoAxesCombined, TrendingUp, TrendingDown, Minus, List, ChevronDown, Scale } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { HistoryPoint, Rates } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";
import { formatLibyaDate, getDailyRateAverages, libyaDayKey } from '../../utils/rateHistory';
import { CashChecksSpreadSection } from './CashChecksSpreadSection';
import { PriceChartTooltip } from './PriceChartTooltip';

interface AdvancedChartsSectionProps {
  activeTab: string;
  view: 'prices' | 'spread';
  setView: (view: 'prices' | 'spread') => void;
  chartAnalysisCurrency: string;
  setChartAnalysisCurrency: (curr: string) => void;
  chartAnalysisRange: '1w' | '1m' | '6m' | '1y' | 'all';
  setChartAnalysisRange: (range: '1w' | '1m' | '6m' | '1y' | 'all') => void;
  history: HistoryPoint[];
  rates: Rates | null;
  isOffline: boolean;
}

const currencies = [
  { id: 'USD_CASH', label: 'دولار كاش', flag: 'us' },
  { id: 'USD_CHECKS', label: 'دولار صكوك', flag: 'us' },
  { id: 'EUR', label: 'يورو', flag: 'eu' },
  { id: 'GOLD_SCRAP_18', label: 'ذهب كسر 18', flag: 'gold' },
];
const tripoliClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const observationDate = (time: number) => `${formatLibyaDate(time)} · ${tripoliClock.format(new Date(time))}`;
const ranges = [
  { id: '1w', label: 'أسبوع', days: 7 },
  { id: '1m', label: 'شهر', days: 30 },
  { id: '6m', label: '6 أشهر', days: 180 },
  { id: '1y', label: 'سنة', days: 365 },
  { id: 'all', label: 'الكل', days: Infinity },
] as const;

export const AdvancedChartsSection: React.FC<AdvancedChartsSectionProps> = ({
  activeTab, view, setView, chartAnalysisCurrency, setChartAnalysisCurrency,
  chartAnalysisRange, setChartAnalysisRange, history, rates, isOffline,
}) => {
  const reducedMotion = useReducedMotion();
  const fillId = useId();
  useEffect(() => {
    document.getElementById('charts-section')?.scrollIntoView({ block: 'start' });
    document.getElementById(`analysis-tab-${view}`)?.focus({ preventScroll: true });
  }, [view]);
  const currency = currencies.find(item => item.id === chartAnalysisCurrency) || currencies[0];
  const data = useMemo(() => {
    const days = ranges.find(item => item.id === chartAnalysisRange)?.days ?? Infinity;
    const cutoff = days === Infinity ? 0 : chartAnalysisRange === '1w' ? Date.now() - days * 86400000
      : Date.parse(`${libyaDayKey(Date.now() - days * 86400000)}T00:00:00+02:00`);
    const codes = chartAnalysisCurrency === 'USD_CASH' ? ['USD'] : chartAnalysisCurrency === 'USD_CHECKS'
      ? ['USD_CHECKS', 'USD_JBANK', 'USD_NCB'] : [chartAnalysisCurrency];
    return history.filter(point => !point.observed || codes.some(code => point.observed.parallel.includes(code))).map(point => {
      const time = Date.parse(point.time);
      const value = chartAnalysisCurrency === 'USD_CASH' ? point.usdParallel || point.ratesParallel?.USD :
        chartAnalysisCurrency === 'USD_CHECKS' ? point.ratesParallel?.USD_CHECKS || point.ratesParallel?.USD_JBANK || point.ratesParallel?.USD_NCB :
        point.ratesParallel?.[chartAnalysisCurrency];
      return { time, value };
    }).filter((point): point is { time: number; value: number } =>
      Number.isFinite(point.time) && point.time >= cutoff && point.time <= Date.now() && typeof point.value === 'number' && Number.isFinite(point.value) && point.value > 0
    ).sort((a, b) => a.time - b.time);
  }, [history, chartAnalysisCurrency, chartAnalysisRange]);
  const daily = chartAnalysisRange !== '1w';
  const chartData = useMemo(() => daily ? getDailyRateAverages(data.map(point => ({ time: new Date(point.time).toISOString(), value: point.value })))
    .map(point => ({ ...point, time: Date.parse(point.time) })) : data, [data, daily]);
  const first = data[0];
  const last = data[data.length - 1];
  const change = first && last ? last.value - first.value : 0;
  const changePercent = first ? change / first.value * 100 : 0;
  const trendColor = change > 0 ? 'var(--positive)' : change < 0 ? 'var(--negative)' : 'var(--official)';
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const intraday = first && last && last.time - first.time < 86400000 * 2;
  const statistics = data.reduce((result, point) => ({
    min: Math.min(result.min, point.value), max: Math.max(result.max, point.value), sum: result.sum + point.value,
  }), { min: Infinity, max: -Infinity, sum: 0 });
  const unit = chartAnalysisCurrency === 'GOLD_SCRAP_18' ? 'د.ل / غرام' : 'د.ل';

  return (
    <section id="charts-section" className={`analysis-section ${activeTab === 'charts' ? '' : 'hidden md:block'}`}>
      <div className="analysis-heading">
        <span><ChartNoAxesCombined size={22} aria-hidden="true" /></span>
        <div><h2>التحليل المتقدم</h2><p>حركة الأسعار في السوق الموازي</p></div>
      </div>

      <div className="analysis-views" role="tablist" aria-label="أقسام التحليل" onKeyDown={event => {
        const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        const index = view === 'prices' ? 0 : 1;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : -1;
        if (next < 0) return;
        event.preventDefault(); setView(next === 0 ? 'prices' : 'spread'); tabs[next].focus();
      }}>
        {[{ id: 'prices', label: 'حركة الأسعار', Icon: ChartNoAxesCombined }, { id: 'spread', label: 'الكاش والصكوك', Icon: Scale }].map(item => <button key={item.id}
          id={`analysis-tab-${item.id}`} role="tab" aria-selected={view === item.id} aria-controls={`analysis-panel-${item.id}`}
          tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id as 'prices' | 'spread')}>
          <item.Icon size={17} aria-hidden="true" />{item.label}
        </button>)}
      </div>

      <div id="analysis-panel-prices" role="tabpanel" aria-labelledby="analysis-tab-prices" hidden={view !== 'prices'}>

      <div className="analysis-toolbar">
        <div className="analysis-currencies" role="group" aria-label="عملة التحليل">
          {currencies.map(item => (
            <button key={item.id} aria-pressed={chartAnalysisCurrency === item.id} onClick={() => setChartAnalysisCurrency(item.id)}>
              <span aria-hidden="true"><FlagIcon flagCode={item.flag} name={item.label} className="w-7 h-6" /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="analysis-ranges" role="group" aria-label="فترة التحليل">
          {ranges.map(range => (
            <button key={range.id} aria-pressed={chartAnalysisRange === range.id} onClick={() => setChartAnalysisRange(range.id)}>
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="analysis-summary">
        <div>
          <h3>{currency.label}</h3>
          <div className="analysis-latest"><strong dir="ltr">{last ? last.value.toFixed(2) : '—'}</strong><span>{unit}</span></div>
          {last && <p>آخر قراءة: <time dateTime={new Date(last.time).toISOString()}>{observationDate(last.time)}</time></p>}
        </div>
        <div className="analysis-period">
          {data.length >= 2 && (
            <div className="analysis-trend" style={{ color: trendColor }}>
              <TrendIcon size={18} aria-hidden="true" />
              <strong dir="ltr">{changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%</strong>
              <span>{change > 0 ? 'ارتفاع' : change < 0 ? 'انخفاض' : 'استقرار'}</span>
            </div>
          )}
          <p>خلال الفترة المحددة</p>
          {first && last && <span dir="ltr">{formatLibyaDate(first.time)} — {formatLibyaDate(last.time)}</span>}
        </div>
      </div>

      <div className="analysis-chart market-chart" role="group" aria-label={`الرسم البياني لحركة ${currency.label}`}>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} accessibilityLayer margin={{ top: 20, right: 8, left: 8, bottom: 8 }}>
              <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={trendColor} stopOpacity={0.2} /><stop offset="100%" stopColor={trendColor} stopOpacity={0.01} /></linearGradient></defs>
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} scale="time"
                tick={{ fill: 'var(--muted-ink)', fontSize: 12 }} tickFormatter={time => !daily && intraday ? tripoliClock.format(new Date(time)) : formatLibyaDate(time).slice(0, 5)}
                minTickGap={36} tickMargin={10} padding={{ left: 10, right: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} orientation="right" tickCount={4} tickMargin={8} tick={{ fill: 'var(--muted-ink)', fontSize: 12 }}
                tickFormatter={value => Number(value).toFixed(2)} axisLine={false} tickLine={false} width={64} />
              <CartesianGrid strokeDasharray="2 6" stroke="var(--line)" vertical={false} />
              <Tooltip content={({ active, payload }) => <PriceChartTooltip active={active} payload={payload} caption={daily ? 'متوسط اليوم' : currency.label} unit={unit} color={trendColor} daily={daily} />} />
              <Area type="monotoneX" dataKey="value" stroke={trendColor} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" connectNulls={false}
                fill={`url(#${fillId})`} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={!reducedMotion} animationDuration={350} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="analysis-empty" role="status">
            <ChartNoAxesCombined size={28} aria-hidden="true" />
            <p>{history.length ? 'لا توجد بيانات كافية لهذه الفترة' : 'لا توجد بيانات تاريخية متاحة بعد'}</p>
          </div>
        )}
      </div>

      {daily && chartData.length > 0 && <p className="text-xs text-[var(--muted-ink)]">متوسطات القراءات اليومية · {chartData.length} يوم رصد بتوقيت ليبيا</p>}

      <dl className="analysis-statistics">
        {[
          { label: 'أعلى سعر', value: statistics.max },
          { label: 'أقل سعر', value: statistics.min },
          { label: 'متوسط القراءات', value: statistics.sum / data.length },
          { label: 'التغير', value: change },
        ].map((stat, index) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd style={index === 3 && data.length >= 2 ? { color: trendColor } : undefined}>
              <strong dir="ltr">{data.length && (index !== 3 || data.length >= 2) ? `${index === 3 && change > 0 ? '+' : ''}${stat.value.toFixed(2)}` : '—'}</strong>
              <span>{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      {data.length > 0 && (
        <details className="analysis-records">
          <summary><List size={18} aria-hidden="true" />القراءات التاريخية <span>{data.length} قراءة</span><ChevronDown size={16} aria-hidden="true" /></summary>
          <table>
            <caption>أحدث {Math.min(data.length, 20)} قراءة في الفترة المحددة</caption>
            <thead><tr><th scope="col">التاريخ والوقت</th><th scope="col">السعر ({unit})</th></tr></thead>
            <tbody>{data.slice(-20).reverse().map((point, index) => (
              <tr key={`${point.time}-${index}`}>
                <td><time dateTime={new Date(point.time).toISOString()} dir="ltr">{observationDate(point.time)}</time></td>
                <td><span dir="ltr">{point.value.toFixed(2)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </details>
      )}
      </div>
      <div id="analysis-panel-spread" role="tabpanel" aria-labelledby="analysis-tab-spread" hidden={view !== 'spread'}>
        {view === 'spread' && <CashChecksSpreadSection history={history} rates={rates} isOffline={isOffline} />}
      </div>
    </section>
  );
};
