import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Minus, X, Calculator, CheckCircle2, Copy, Share2, ChartNoAxesCombined } from "lucide-react";
import { Rates, CURRENCIES, METAL_IDS } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";
import { useDialogAccessibility } from "../../hooks/useDialogAccessibility";

interface CurrencyChartModalProps {
  selectedRate: { code: string; name: string; market: 'official' | 'parallel' } | null;
  setSelectedRate: (rate: { code: string; name: string; market: 'official' | 'parallel' } | null) => void;
  rates: Rates | null;
  configTerms: any[];
  chartData: { time: string; value: number }[];
  chartStats: { max: number; min: number; avg: number; isUp: boolean; change: number; changePercent: number };
  advancedStats: { ma30: number; support: number; resistance: number };
  chartRange: '24h' | '7d' | 'all';
  setChartRange: (range: '24h' | '7d' | 'all') => void;
  triggerHaptic: (pattern?: number | number[]) => void;
  handleShareCardImage: (code: string, name: string, price: number, isGold?: boolean) => void;
}

export const CurrencyChartModal: React.FC<CurrencyChartModalProps> = ({
  selectedRate, setSelectedRate, rates, configTerms, chartData, chartStats,
  advancedStats, chartRange, setChartRange, triggerHaptic, handleShareCardImage,
}) => {
  const [amount, setAmount] = useState('100');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const dialogRef = useDialogAccessibility(!!selectedRate, () => setSelectedRate(null));
  useEffect(() => {
    setCopied(false); setCopyError(false); setShowHistoryTable(false); setAmount('100');
  }, [selectedRate?.code, selectedRate?.market]);

  return (
    <AnimatePresence>
      {selectedRate && (() => {
        const currentRate = (selectedRate.market === 'parallel' ? rates?.parallel[selectedRate.code] : rates?.official[selectedRate.code]) || 0;
        const decimals = selectedRate.market === 'official' ? 4 : (selectedRate.code === 'EGP' || selectedRate.code === 'TRY' ? 3 : 2);
        const market = selectedRate.market === 'parallel' ? 'السوق الموازي' : 'المصرف المركزي';
        const isMetal = METAL_IDS.includes(selectedRate.code);
        const rangeLabel = chartRange === '24h' ? '24 ساعة' : chartRange === '7d' ? '7 أيام' : 'كل السجل';
        const color = chartStats.change > 0 ? 'var(--positive)' : chartStats.change < 0 ? 'var(--negative)' : 'var(--official)';
        const TrendIcon = chartStats.change > 0 ? ArrowUpRight : chartStats.change < 0 ? ArrowDownRight : Minus;
        const parsedAmount = Number(amount);
        const total = amount !== '' && Number.isFinite(parsedAmount) && parsedAmount >= 0 && currentRate > 0 ? parsedAmount * currentRate : null;
        const updatedAt = Date.parse(rates?.lastUpdated || '');
        const intraday = chartData.length > 1 && Date.parse(chartData[chartData.length - 1].time) - Date.parse(chartData[0].time) < 172800000;
        const handleCopyRate = async () => {
          triggerHaptic(8);
          try {
            await navigator.clipboard.writeText(`${selectedRate.name} (${market}): ${currentRate.toFixed(decimals)} د.ل`);
            setCopyError(false); setCopied(true); setTimeout(() => setCopied(false), 2000);
          } catch { setCopied(false); setCopyError(true); }
        };

        return (
          <div className="currency-detail-overlay">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedRate(null)} className="currency-detail-backdrop" />
            <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="currency-dialog-title"
              tabIndex={-1} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }} className="currency-detail-dialog" dir="rtl">
              <div className="currency-detail-header">
                <span aria-hidden="true"><FlagIcon flagCode={configTerms.find(term => term.id === selectedRate.code)?.flag || CURRENCIES.find(item => item.code === selectedRate.code)?.flag}
                  name={selectedRate.name} className="w-10 h-8" /></span>
                <div>
                  <h2 id="currency-dialog-title">{selectedRate.name}</h2>
                  <p>{market}<span dir="ltr">{selectedRate.code}</span></p>
                </div>
                <button aria-label="إغلاق" title="إغلاق" onClick={() => { triggerHaptic(6); setSelectedRate(null); }}>
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="currency-detail-content">
                <div className="currency-detail-price">
                  <div><p>السعر الحالي</p>
                    <div><strong dir="ltr">{currentRate > 0 ? currentRate.toFixed(decimals) : '—'}</strong><span>د.ل</span></div>
                    {Number.isFinite(updatedAt) && <small>تحديث البيانات: <time dateTime={new Date(updatedAt).toISOString()}>{format(updatedAt, 'dd/MM/yyyy · HH:mm')}</time></small>}
                  </div>
                  {chartData.length >= 2 && (
                    <div className="currency-detail-trend">
                      <div style={{ color }}><TrendIcon size={18} aria-hidden="true" /><strong dir="ltr">{chartStats.change > 0 ? '+' : ''}{chartStats.change.toFixed(decimals)} د.ل</strong></div>
                      <span style={{ color }} dir="ltr">{chartStats.changePercent > 0 ? '+' : ''}{chartStats.changePercent.toFixed(2)}%</span>
                      <small>التغير خلال {rangeLabel}</small>
                    </div>
                  )}
                </div>

                <div className="currency-detail-grid">
                  <section className="currency-detail-history" aria-label="حركة السعر">
                    <div className="currency-detail-chart-heading">
                      <h3>حركة السعر</h3>
                      <div role="group" aria-label="فترة الرسم البياني">
                        {(['24h', '7d', 'all'] as const).map(range => (
                          <button key={range} aria-pressed={chartRange === range} onClick={() => { setChartRange(range); triggerHaptic(5); }}>
                            {range === '24h' ? '24 ساعة' : range === '7d' ? '7 أيام' : 'الكل'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="currency-detail-chart" role="group" aria-label="الرسم البياني للسعر">
                      {chartData.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} accessibilityLayer margin={{ top: 12, right: 4, left: 4, bottom: 4 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--muted-ink)' }}
                              tickFormatter={time => format(new Date(time), chartRange === '24h' || intraday ? 'HH:mm' : 'dd/MM')}
                              minTickGap={32} axisLine={false} tickLine={false} />
                            <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 12, fill: 'var(--muted-ink)' }}
                              axisLine={false} tickLine={false} tickFormatter={value => Number(value).toFixed(decimals)} width={68} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }}
                              itemStyle={{ color, fontSize: 14, fontWeight: 700 }} labelStyle={{ color: 'var(--muted-ink)', fontSize: 12 }}
                              labelFormatter={time => format(new Date(String(time)), 'dd/MM/yyyy · HH:mm')}
                              formatter={(value: number) => [`${Number(value).toFixed(decimals)} د.ل`, 'السعر']} />
                            <Area type="linear" dataKey="value" stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.08} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="currency-detail-empty" role="status"><ChartNoAxesCombined size={28} aria-hidden="true" /><p>لا توجد بيانات تاريخية كافية لهذه الفترة</p></div>}
                    </div>
                    {chartData.length > 0 && (
                      <details onToggle={event => setShowHistoryTable(event.currentTarget.open)} className="currency-detail-records">
                        <summary>القراءات التاريخية</summary>
                        {showHistoryTable && <div>
                          <table>
                            <caption className="sr-only">سجل سعر {selectedRate.name} للفترة المحددة بالدينار الليبي</caption>
                            <thead><tr><th scope="col">التاريخ والوقت</th><th scope="col">السعر (د.ل)</th></tr></thead>
                            <tbody>{chartData.map((point, index) => (
                              <tr key={`${point.time}-${index}`}><td><time dateTime={point.time} dir="ltr">{format(new Date(point.time), 'dd/MM/yyyy · HH:mm')}</time></td><td><span dir="ltr">{point.value.toFixed(decimals)}</span></td></tr>
                            ))}</tbody>
                          </table>
                        </div>}
                      </details>
                    )}
                  </section>

                  <div className="currency-detail-information">
                    <section aria-label="ملخص الفترة">
                      <h3>ملخص الفترة</h3>
                      <dl className="currency-detail-statistics">
                        {[
                          { label: 'أعلى سعر', value: chartStats.max },
                          { label: 'أقل سعر', value: chartStats.min },
                          { label: 'متوسط القراءات', value: chartStats.avg },
                          { label: 'الفرق بين الأعلى والأقل', value: Math.max(0, chartStats.max - chartStats.min) },
                        ].map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd><strong dir="ltr">{chartData.length ? stat.value.toFixed(decimals) : '—'}</strong><span>د.ل</span></dd></div>)}
                      </dl>
                    </section>

                    <section className="currency-detail-converter" aria-labelledby="detail-converter-title">
                      <h3 id="detail-converter-title"><Calculator size={18} aria-hidden="true" />تحويل سريع للدينار</h3>
                      <label htmlFor="detail-amount">{isMetal ? 'الكمية' : 'المبلغ بالعملة الأجنبية'}</label>
                      <input id="detail-amount" type="number" inputMode="decimal" min="0" step="any" dir="ltr" value={amount}
                        onChange={event => setAmount(event.target.value)} placeholder="0" />
                      <div className="currency-detail-presets" role="group" aria-label="مبالغ التحويل السريع">
                        {[50, 100, 500, 1000, 5000].map(value => <button key={value} aria-pressed={amount === String(value)}
                          onClick={() => { triggerHaptic(4); setAmount(String(value)); }}>{value.toLocaleString('en-US')}</button>)}
                      </div>
                      <div className="currency-detail-total"><span>القيمة بالدينار الليبي</span>
                        <output htmlFor="detail-amount"><strong dir="ltr">{total !== null && Number.isFinite(total) ? total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</strong><span>د.ل</span></output>
                      </div>
                    </section>

                    <details className="currency-detail-long-range">
                      <summary>ملخص آخر 30 يومًا</summary>
                      <dl>{[
                        { label: 'أعلى قراءة', value: advancedStats.resistance },
                        { label: 'أقل قراءة', value: advancedStats.support },
                        { label: 'متوسط القراءات', value: advancedStats.ma30 },
                      ].map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd dir="ltr">{stat.value > 0 ? stat.value.toFixed(decimals) : '—'} د.ل</dd></div>)}</dl>
                    </details>
                  </div>
                </div>
              </div>

              <div className="currency-detail-footer">
                <button onClick={handleCopyRate} disabled={currentRate <= 0} aria-label="نسخ السعر" title="نسخ السعر">
                  {copied ? <CheckCircle2 size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  <span role="status">{copyError ? 'تعذر النسخ' : copied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>
                <button disabled={currentRate <= 0} aria-label="مشاركة بطاقة السعر" title="مشاركة بطاقة السعر"
                  onClick={() => { triggerHaptic(8); handleShareCardImage(selectedRate.code, selectedRate.name, currentRate, selectedRate.market === 'official'); }}>
                  <Share2 size={18} aria-hidden="true" /><span>مشاركة</span>
                </button>
                <button className="currency-detail-close" onClick={() => { triggerHaptic(6); setSelectedRate(null); }}>إغلاق</button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
};
