import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Scale, WifiOff } from 'lucide-react';
import { HistoryPoint, Rates } from '../../types/rates';
import { buildSpreadModel, spreadNumber, spreadReading } from '../../utils/cashChecksSpread';
import { formatLibyaDate } from '../../utils/rateHistory';

interface Props { history: HistoryPoint[]; rates: Rates | null; isOffline: boolean; onOpenDetails: () => void }
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function CashChecksSpreadSummary({ history, rates, isOffline, onOpenDetails }: Props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const updateClock = () => { if (document.visibilityState !== 'hidden') setNow(Date.now()); };
    const timer = setInterval(updateClock, 60000);
    document.addEventListener('visibilitychange', updateClock);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', updateClock); };
  }, []);
  const model = useMemo(() => buildSpreadModel(history, rates, 1, Math.max(now, Date.now())), [history, rates, now]);
  const { latest, pending, stale } = model;
  const status = isOffline ? 'غير متصل · بيانات محفوظة' : pending ? 'بانتظار لقطة أحدث' : stale ? 'لقطة قديمة · ليست سعرًا حاليًا' : 'لقطة مشتركة';
  const StatusIcon = isOffline ? WifiOff : Clock3;

  return <section className="spread-teaser" aria-label="ملخص فجوة الكاش والصكوك">
    <div className="spread-teaser-copy">
      <h2><Scale size={20} aria-hidden="true" />فجوة الكاش والصكوك</h2>
      <p>{latest ? spreadReading(model).headline : 'بانتظار لقطة مشتركة للسعرين'}</p>
      <div className={`spread-teaser-status ${isOffline || pending || stale ? 'is-caution' : ''}`}>
        {latest ? <><StatusIcon size={14} aria-hidden="true" /><span>{status}</span>
          <time dateTime={new Date(latest.time).toISOString()} dir="ltr">{formatLibyaDate(latest.time)} · {clock.format(latest.time)}</time></>
          : <span>لا تُحسب الفجوة من أسعار بأوقات مختلفة</span>}
      </div>
    </div>
    <dl className="spread-teaser-values">
      <div><dt>الفرق لكل دولار</dt><dd><strong dir="ltr">{latest ? spreadNumber(latest.gap, true) : '—'}</strong><span>د.ل</span></dd></div>
      <div><dt>النسبة من سعر الكاش</dt><dd><b dir="ltr">{latest ? `${spreadNumber(latest.premium, true)}%` : '—'}</b></dd></div>
    </dl>
    <button type="button" onClick={onOpenDetails} aria-label="عرض المزيد عن فجوة الكاش والصكوك">عرض المزيد<ArrowLeft size={17} aria-hidden="true" /></button>
  </section>;
}
