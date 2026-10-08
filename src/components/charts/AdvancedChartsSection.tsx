import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { ChartNoAxesCombined, TrendingUp, TrendingDown, Minus, List, ChevronDown } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { HistoryPoint } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";

interface AdvancedChartsSectionProps {
  activeTab: string;
  chartAnalysisCurrency: string;
  setChartAnalysisCurrency: (curr: string) => void;
  chartAnalysisRange: '1w' | '1m' | '6m' | '1y' | 'all';
  setChartAnalysisRange: (range: '1w' | '1m' | '6m' | '1y' | 'all') => void;
  history: HistoryPoint[];
}

const currencies = [
  { id: 'USD_CASH', label: 'دولار كاش', flag: 'us' },
  { id: 'USD_CHECKS', label: 'دولار صكوك', flag: 'us' },
  { id: 'EUR', label: 'يورو', flag: 'eu' },
  { id: 'GOLD_SCRAP_18', label: 'ذهب كسر 18', flag: 'gold' },
];
const ranges = [
  { id: '1w', label: 'أسبوع', days: 7 },
  { id: '1m', label: 'شهر', days: 30 },
  { id: '6m', label: '6 أشهر', days: 180 },
  { id: '1y', label: 'سنة', days: 365 },
  { id: 'all', label: 'الكل', days: Infinity },
] as const;

export const AdvancedChartsSection: React.FC<AdvancedChartsSectionProps> = ({
  activeTab, chartAnalysisCurrency, setChartAnalysisCurrency,
  chartAnalysisRange, setChartAnalysisRange, history,
}) => {
  const reducedMotion = useReducedMotion();
  const currency = currencies.find(item => item.id === chartAnalysisCurrency) || currencies[0];
  const data = useMemo(() => {
    const days = ranges.find(item => item.id === chartAnalysisRange)?.days ?? Infinity;
    const cutoff = days === Infinity ? 0 : Date.now() - days * 86400000;
    return history.map(point => {
      const time = Date.parse(point.time);
      const value = chartAnalysisCurrency === 'USD_CASH' ? point.usdParallel || point.ratesParallel?.USD :
        chartAnalysisCurrency === 'USD_CHECKS' ? point.ratesParallel?.USD_CHECKS || point.ratesParallel?.USD_JBANK || point.ratesParallel?.USD_NCB :
        point.ratesParallel?.[chartAnalysisCurrency];
      return { time, value };
    }).filter((point): point is { time: number; value: number } =>
      Number.isFinite(point.time) && point.time >= cutoff && typeof point.value === 'number' && Number.isFinite(point.value) && point.value > 0
    ).sort((a, b) => a.time - b.time);
  }, [history, chartAnalysisCurrency, chartAnalysisRange]);
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
          {last && <p>آخر قراءة: <time dateTime={new Date(last.time).toISOString()}>{format(last.time, 'dd/MM/yyyy · HH:mm')}</time></p>}
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
          {first && last && <span dir="ltr">{format(first.time, 'dd/MM/yyyy')} — {format(last.time, 'dd/MM/yyyy')}</span>}
        </div>
      </div>

      <div className="analysis-chart" role="group" aria-label={`الرسم البياني لحركة ${currency.label}`}>
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} accessibilityLayer margin={{ top: 20, right: 8, left: 8, bottom: 8 }}>
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} scale="time"
                tick={{ fill: 'var(--muted-ink)', fontSize: 12 }} tickFormatter={time => format(time, intraday ? 'HH:mm' : 'dd/MM')}
                minTickGap={32} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fill: 'var(--muted-ink)', fontSize: 12 }}
                tickFormatter={value => Number(value).toFixed(2)} axisLine={false} tickLine={false} width={64} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }}
                itemStyle={{ color: trendColor, fontSize: 14, fontWeight: 700 }}
                labelStyle={{ color: 'var(--muted-ink)', fontSize: 12 }}
                labelFormatter={time => format(Number(time), 'dd/MM/yyyy · HH:mm')}
                formatter={(value: number) => [`${Number(value).toFixed(2)} ${unit}`, currency.label]} />
              <Area type="linear" dataKey="value" stroke={trendColor} strokeWidth={2.5}
                fill={trendColor} fillOpacity={0.08} isAnimationActive={!reducedMotion} animationDuration={350} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="analysis-empty" role="status">
            <ChartNoAxesCombined size={28} aria-hidden="true" />
            <p>{history.length ? 'لا توجد بيانات كافية لهذه الفترة' : 'لا توجد بيانات تاريخية متاحة بعد'}</p>
          </div>
        )}
      </div>

      <dl className="analysis-statistics">
        {[
          { label: 'أعلى سعر', value: statistics.max },
          { label: 'أقل سعر', value: statistics.min },
          { label: 'متوسط السعر', value: statistics.sum / data.length },
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
                <td><time dateTime={new Date(point.time).toISOString()} dir="ltr">{format(point.time, 'dd/MM/yyyy · HH:mm')}</time></td>
                <td><span dir="ltr">{point.value.toFixed(2)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </details>
      )}
    </section>
  );
};
