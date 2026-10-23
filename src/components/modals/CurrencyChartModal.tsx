import React, { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus, X, Calculator, CheckCircle2, Copy, Share2, ChartNoAxesCombined, FileDown, Download, LoaderCircle, ExternalLink } from "lucide-react";
import { Rates, CURRENCIES, METAL_IDS } from "../../types/rates";
import { FlagIcon } from "../FlagIcon";
import { useDialogAccessibility } from "../../hooks/useDialogAccessibility";
import { formatLibyaDate } from '../../utils/rateHistory';
import { PriceChartTooltip } from '../charts/PriceChartTooltip';

const libyaDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Tripoli', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const libyaTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const libyaDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', day: '2-digit', month: '2-digit' });

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
}

export const CurrencyChartModal: React.FC<CurrencyChartModalProps> = ({
  selectedRate, setSelectedRate, rates, configTerms, chartData, chartStats,
  advancedStats, chartRange, setChartRange, triggerHaptic,
}) => {
  const [amount, setAmount] = useState('100');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; url: string; generatedAt: string } | null>(null);
  const [pdfProgress, setPdfProgress] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const exportRequest = useRef<AbortController | null>(null);
  const sharePending = useRef(false);
  const fillId = useId();
  const dialogRef = useDialogAccessibility(!!selectedRate, () => setSelectedRate(null));
  useEffect(() => {
    setCopied(false); setCopyError(false); setShowHistoryTable(false); setAmount('100');
  }, [selectedRate?.code, selectedRate?.market]);
  useEffect(() => {
    setPdf(null); setPdfError(''); setShareMessage(''); setPdfProgress('');
    return () => { exportRequest.current?.abort(); exportRequest.current = null; };
  }, [selectedRate?.code, selectedRate?.market, chartRange]);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  let canSharePdf = false;
  try { canSharePdf = !!pdf && !!navigator.share && !!navigator.canShare?.({ files: [pdf.file] }); } catch { /* Download remains available. */ }

  const preparePdf = async () => {
    if (!selectedRate || !rates || exportRequest.current || sharePending.current) return;
    const input = {
      ...selectedRate, price: rates[selectedRate.market][selectedRate.code],
      lastUpdated: rates.lastUpdated, lastChanged: rates.lastChanged?.[selectedRate.market]?.[selectedRate.code],
      range: chartRange, points: chartData.map(point => ({ ...point })),
      amount: amount.trim() ? Number(amount) : null, advanced: { ...advancedStats },
    };
    const controller = new AbortController(); exportRequest.current = controller;
    triggerHaptic(8); setPdfProgress('جارٍ تجهيز التقرير'); setPdfError(''); setShareMessage('');
    try {
      // Freeze the selected price and history before loading the export-only code.
      const { createCurrencyPdf } = await import('../CurrencyPdfReport');
      const result = await createCurrencyPdf(input, controller.signal, label => { if (!controller.signal.aborted) setPdfProgress(label); });
      if (!controller.signal.aborted) setPdf({ ...result, url: URL.createObjectURL(result.file) });
    } catch (error) {
      if (!controller.signal.aborted) setPdfError(error instanceof Error ? error.message : 'تعذر إنشاء التقرير. أعد المحاولة.');
    } finally {
      if (exportRequest.current === controller) { exportRequest.current = null; setPdfProgress(''); }
    }
  };
  const sharePdf = async () => {
    if (!pdf || !canSharePdf || sharePending.current || exportRequest.current) return;
    sharePending.current = true; setSharing(true); setPdfError(''); setShareMessage('');
    try {
      // Sharing on this fresh tap preserves the phone's native user activation.
      await navigator.share({ files: [pdf.file], title: `مؤشر الدينار · ${selectedRate?.name}` });
      setShareMessage('تمت مشاركة التقرير.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') setShareMessage('أُلغيت المشاركة؛ التقرير ما زال جاهزًا.');
      else setPdfError('تعذرت المشاركة من المتصفح. يمكنك تحميل ملف PDF ومشاركته مباشرة.');
    } finally { sharePending.current = false; setSharing(false); }
  };

  return (
    <AnimatePresence>
      {selectedRate && (() => {
        const currentRate = (selectedRate.market === 'parallel' ? rates?.parallel[selectedRate.code] : rates?.official[selectedRate.code]) || 0;
        const decimals = selectedRate.market === 'official' ? 4 : (selectedRate.code === 'EGP' || selectedRate.code === 'TRY' ? 3 : 2);
        const market = selectedRate.market === 'parallel' ? 'السوق الموازي' : 'المصرف المركزي';
        const isMetal = METAL_IDS.includes(selectedRate.code);
        const color = chartStats.change > 0 ? 'var(--positive)' : chartStats.change < 0 ? 'var(--negative)' : 'var(--official)';
        const TrendIcon = chartStats.change > 0 ? ArrowUpRight : chartStats.change < 0 ? ArrowDownRight : Minus;
        const parsedAmount = Number(amount);
        const total = amount !== '' && Number.isFinite(parsedAmount) && parsedAmount >= 0 && currentRate > 0 ? parsedAmount * currentRate : null;
        const changedAt = Date.parse(rates?.lastChanged?.[selectedRate.market]?.[selectedRate.code] || '');
        const updatedAt = Number.isFinite(changedAt) ? changedAt : Date.parse(rates?.lastUpdated || '');
        const firstReading = chartData[0], lastReading = chartData[chartData.length - 1];
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
                    {Number.isFinite(updatedAt) && <small>{Number.isFinite(changedAt) ? 'آخر تغير للسعر' : 'تحديث البيانات'}: <time dateTime={new Date(updatedAt).toISOString()} dir="ltr">{selectedRate.market === 'official' ? formatLibyaDate(updatedAt) : libyaDateTime.format(updatedAt)}</time></small>}
                  </div>
                  {chartData.length >= 2 && (
                    <div className="currency-detail-trend">
                      <div style={{ color }}><TrendIcon size={18} aria-hidden="true" /><strong dir="ltr">{chartStats.change > 0 ? '+' : ''}{chartStats.change.toFixed(decimals)} د.ل</strong></div>
                      <span style={{ color }} dir="ltr">{chartStats.changePercent > 0 ? '+' : ''}{chartStats.changePercent.toFixed(selectedRate.market === 'official' ? 4 : 2)}%</span>
                      <small>{selectedRate.market === 'official' ? 'التغير بين الأيام المعروضة' : 'التغير بين القراءات المعروضة'}</small>
                      <small className="currency-detail-period">
                        <span>من <time dateTime={firstReading.time} dir="ltr">{selectedRate.market === 'official' ? formatLibyaDate(firstReading.time) : libyaDateTime.format(new Date(firstReading.time))}</time></span>
                        <span>إلى <time dateTime={lastReading.time} dir="ltr">{selectedRate.market === 'official' ? formatLibyaDate(lastReading.time) : libyaDateTime.format(new Date(lastReading.time))}</time></span>
                      </small>
                      <small>بتوقيت ليبيا</small>
                    </div>
                  )}
                </div>

                <div className="currency-detail-grid">
                  <section className="currency-detail-history" aria-label="حركة السعر">
                    <div className="currency-detail-chart-heading">
                      <h3>حركة السعر</h3>
                      <div role="group" aria-label="فترة الرسم البياني">
                        {(selectedRate.market === 'official' ? ['7d', 'all'] as const : ['24h', '7d', 'all'] as const).map(range => (
                          <button key={range} aria-pressed={chartRange === range} onClick={() => { setChartRange(range); triggerHaptic(5); }}>
                            {range === '24h' ? '24 ساعة' : range === '7d' ? '7 أيام' : 'الكل'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedRate.market === 'official' && <p className="currency-detail-daily-note">آخر سعر رسمي متاح لكل يوم · {chartData.length} يوم</p>}
                    <div className="currency-detail-chart market-chart" role="group" aria-label="الرسم البياني للسعر">
                      {chartData.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} accessibilityLayer margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
                            <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.18} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
                            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 6" />
                            <XAxis dataKey={point => Date.parse(point.time)} type="number" scale="time" domain={['dataMin', 'dataMax']} tick={{ fontSize: 12, fill: 'var(--muted-ink)' }}
                              ticks={selectedRate.market === 'official' ? chartData.map(point => Date.parse(point.time)) : undefined}
                              tickFormatter={time => selectedRate.market === 'official' ? libyaDate.format(new Date(time)) : (chartRange === '24h' || intraday ? libyaTime : libyaDate).format(new Date(time))}
                              minTickGap={36} tickMargin={10} padding={{ left: 10, right: 10 }} axisLine={false} tickLine={false} />
                            <YAxis domain={['auto', 'auto']} orientation="right" tickCount={selectedRate.market === 'official' ? 2 : 5} tick={{ fontSize: 12, fill: 'var(--muted-ink)' }}
                              tickMargin={8} axisLine={false} tickLine={false} tickFormatter={value => Number(value).toFixed(decimals)} width={72} />
                            <Tooltip content={({ active, payload }) => <PriceChartTooltip active={active} payload={payload} caption={selectedRate.market === 'official' ? 'السعر الرسمي لليوم' : selectedRate.name} unit={isMetal ? 'د.ل / غرام' : 'د.ل'} color={color} decimals={decimals} daily={selectedRate.market === 'official'} />} />
                            <Area type={selectedRate.market === 'official' ? 'stepAfter' : 'monotoneX'} dataKey="value" stroke={color} strokeWidth={2.8}
                              strokeLinecap="round" strokeLinejoin="round" connectNulls={false} fill={`url(#${fillId})`}
                              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="currency-detail-empty" role="status"><ChartNoAxesCombined size={28} aria-hidden="true" /><p>لا توجد بيانات تاريخية كافية لهذه الفترة</p></div>}
                    </div>
                    {chartData.length > 0 && (
                      <details open={showHistoryTable} onToggle={event => setShowHistoryTable(event.currentTarget.open)} className="currency-detail-records">
                        <summary>القراءات التاريخية</summary>
                        {showHistoryTable && <div>
                          <table>
                            <caption className="sr-only">سجل سعر {selectedRate.name} للفترة المحددة بالدينار الليبي</caption>
                            <thead><tr><th scope="col">{selectedRate.market === 'official' ? 'اليوم' : 'التاريخ والوقت'}</th><th scope="col">السعر (د.ل)</th></tr></thead>
                            <tbody>{chartData.map((point, index) => (
                              <tr key={`${point.time}-${index}`}><td><time dateTime={point.time} dir="ltr">{selectedRate.market === 'official' ? formatLibyaDate(point.time) : libyaDateTime.format(new Date(point.time))}</time></td><td><span dir="ltr">{point.value.toFixed(decimals)}</span></td></tr>
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
                      <summary>القراءات المتاحة خلال آخر 30 يومًا</summary>
                      <dl>{[
                        { label: 'أعلى قراءة', value: advancedStats.resistance },
                        { label: 'أقل قراءة', value: advancedStats.support },
                        { label: 'متوسط القراءات', value: advancedStats.ma30 },
                      ].map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd dir="ltr">{stat.value > 0 ? stat.value.toFixed(decimals) : '—'} د.ل</dd></div>)}</dl>
                    </details>
                  </div>
                </div>
              </div>

              {(pdfProgress || pdf || pdfError) && <div className="currency-report-panel" aria-busy={!!pdfProgress || sharing}>
                {pdfProgress && <p role="status"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />{pdfProgress}</p>}
                {pdf && !pdfProgress && <><div className="currency-report-ready"><span role="status"><CheckCircle2 size={16} aria-hidden="true" />التقرير جاهز</span><a href={pdf.url} target="_blank" rel="noopener noreferrer" aria-label="فتح تقرير PDF" title="فتح تقرير PDF"><ExternalLink size={17} aria-hidden="true" /></a></div>
                  <p className="currency-report-stamp">لقطة محفوظة في <bdi>{libyaDateTime.format(new Date(pdf.generatedAt))}</bdi> · توقيت طرابلس</p>
                  <div className="currency-report-buttons"><a href={pdf.url} download={pdf.file.name}><Download size={17} aria-hidden="true" />تحميل PDF</a>
                    {canSharePdf && <button onClick={sharePdf} disabled={sharing || !!pdfProgress}><Share2 size={17} aria-hidden="true" />{sharing ? 'جارٍ المشاركة' : 'مشاركة PDF'}</button>}</div>
                  {!canSharePdf && <p className="currency-report-stamp">يمكنك مشاركة الملف بعد تحميله على جهازك.</p>}
                </>}
                {shareMessage && <p role="status">{shareMessage}</p>}
                {pdfError && <p role="alert">{pdfError}</p>}
              </div>}
              <div className="currency-detail-footer">
                <button onClick={handleCopyRate} disabled={currentRate <= 0} aria-label="نسخ السعر" title={copyError ? 'تعذر النسخ؛ أعد المحاولة' : copied ? 'تم النسخ' : 'نسخ السعر'}>
                  {copyError ? <X size={18} aria-hidden="true" /> : copied ? <CheckCircle2 size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  <span role="status">{copyError ? 'تعذر النسخ' : copied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>
                <button disabled={!Number.isFinite(currentRate) || currentRate <= 0 || !!pdfProgress || sharing} aria-label="إعداد تقرير العملة PDF" title="إعداد تقرير العملة PDF"
                  onClick={preparePdf}>
                  {pdfProgress ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <FileDown size={18} aria-hidden="true" />}<span>{pdfProgress ? 'جارٍ الإعداد' : pdf ? 'تحديث التقرير' : 'تقرير PDF'}</span>
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
