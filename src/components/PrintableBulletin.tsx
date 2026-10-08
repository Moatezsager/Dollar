import React, { forwardRef } from 'react';
import { Rates, CurrencyItem, METAL_IDS } from '../types/rates';
import { PdfFlagIcon } from './modals/PdfExportModal';

interface PrintableBulletinProps {
  rates: Rates | null;
  configTerms: any[];
  staleCurrencies: Set<string>;
  officialCurrencyList: CurrencyItem[];
  selectedCurrencies: string[];
  selectedOfficialCurrencies: string[];
  usdRate: number;
  prevUsdRate: number;
  usdChecksRate: number;
  prevUsdChecksRate: number;
}

const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export const PrintableBulletin = forwardRef<HTMLDivElement, PrintableBulletinProps>(({
  rates, configTerms, staleCurrencies, officialCurrencyList, selectedCurrencies, selectedOfficialCurrencies,
}, ref) => {
  const parallel = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && selectedCurrencies.includes(c.id) &&
    !staleCurrencies.has(c.id) && isPrice(rates?.parallel[c.id]));
  const official = officialCurrencyList.filter(c => selectedOfficialCurrencies.includes(c.code) && isPrice(rates?.official[c.code]));
  const groups = [
    { id: 'parallel', title: 'عملات السوق الموازي', unit: 'لكل وحدة من العملة', official: false,
      items: parallel.filter(c => !METAL_IDS.includes(c.id)).map(c => ({ code: c.id, name: c.name, flag: c.flag })) },
    { id: 'metals', title: 'الذهب والمعادن', unit: 'حسب وحدة الصنف المبينة', official: false,
      items: parallel.filter(c => METAL_IDS.includes(c.id)).map(c => ({ code: c.id, name: c.name, flag: c.flag })) },
    { id: 'official', title: 'أسعار الصرف الرسمية', unit: 'الأسعار المنسوبة إلى مصرف ليبيا المركزي', official: true, items: official },
  ];
  const dateFormatter = new Intl.DateTimeFormat('ar-LY', {
    timeZone: 'Africa/Tripoli', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const updated = rates?.lastUpdated ? new Date(rates.lastUpdated) : null;
  const updatedLabel = updated && Number.isFinite(updated.getTime()) ? dateFormatter.format(updated) : 'وقت التحديث غير متاح';

  return (
    <div id="pdf-report-container" ref={ref} className="pdf-bulletin" dir="rtl">
      <style>{`
        #pdf-report-container.pdf-bulletin { position: absolute; top: -9999px; left: -9999px; width: 210mm; padding: 12mm; opacity: 0; pointer-events: none; background: #fff; color: #17262e; font-family: 'Cairo', Arial, sans-serif; font-size: 11px; line-height: 1.7; letter-spacing: 0; box-sizing: border-box; }
        .pdf-bulletin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #047857; padding-bottom: 16px; margin-bottom: 16px; }
        .pdf-bulletin-brand { display: flex; align-items: center; gap: 12px; }
        .pdf-bulletin-brand img { width: 48px; height: 48px; object-fit: contain; border-radius: 4px; }
        .pdf-bulletin h1 { font-size: 22px; font-weight: 800; margin: 0; }
        .pdf-bulletin-header p { color: #52656f; margin: 4px 0 0; font-size: 11px; }
        .pdf-bulletin-meta { color: #52656f; font-size: 10px; line-height: 1.9; }
        .pdf-bulletin-meta strong { color: #17262e; font-weight: 600; }
        .pdf-bulletin-summary { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #eef6f2; color: #17262e; padding: 10px 12px; margin-bottom: 20px; border-inline-start: 3px solid #047857; }
        .pdf-bulletin-summary strong { font-size: 13px; }
        .pdf-bulletin-section { margin-bottom: 22px; break-inside: auto; }
        .pdf-bulletin-section h2 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .pdf-bulletin-section > p { color: #52656f; font-size: 10px; margin-bottom: 8px; }
        .pdf-bulletin table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .pdf-bulletin th { background: #e9eef0; font-size: 10px; font-weight: 700; }
        .pdf-bulletin th, .pdf-bulletin td { padding: 8px 6px; border-bottom: 1px solid #cad4d9; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
        .pdf-bulletin th:first-child, .pdf-bulletin td:first-child { width: 30%; text-align: right; }
        .pdf-bulletin td:first-child > div { display: flex; align-items: center; gap: 8px; }
        .pdf-bulletin td:first-child strong { font-size: 11px; font-weight: 600; }
        .pdf-bulletin td:first-child small { display: block; color: #52656f; font-size: 9px; }
        .pdf-bulletin tbody tr:nth-child(even) { background: #f4f6f7; }
        .pdf-bulletin .pdf-number { font-family: 'Cairo', Arial, sans-serif; font-variant-numeric: tabular-nums; direction: ltr; }
        .pdf-bulletin .pdf-current { font-weight: 800; font-size: 12px; }
        .pdf-bulletin .pdf-up { color: #be123c; }
        .pdf-bulletin .pdf-down { color: #047857; }
        .pdf-bulletin-notes { border-top: 1px solid #cad4d9; padding-top: 12px; color: #52656f; font-size: 10px; }
        .pdf-bulletin-notes p { margin-bottom: 6px; }
        .pdf-bulletin-footer { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid #cad4d9; margin-top: 16px; padding-top: 8px; font-size: 9px; color: #52656f; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body, body #root .app-shell { background: #fff !important; color-scheme: light !important; }
          body #root, body #root .app-shell { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .app-shell > :not(#pdf-report-container) { display: none !important; }
          #pdf-report-container.pdf-bulletin { display: block !important; position: static !important; width: auto !important; min-height: 0 !important; padding: 0 2mm !important; margin: 0 !important; opacity: 1 !important; pointer-events: auto; }
          .pdf-bulletin thead { display: table-header-group; }
          .pdf-bulletin tr, .pdf-bulletin-header, .pdf-bulletin-summary, .pdf-bulletin-notes, .pdf-bulletin-footer { break-inside: avoid; }
          .pdf-bulletin-section h2, .pdf-bulletin-section > p { break-after: avoid; }
        }
      `}</style>
      <header className="pdf-bulletin-header">
        <div className="pdf-bulletin-brand"><img src="/logo.png" alt="" /><div><h1>مؤشر الدينار</h1><p>نشرة أسعار العملات والمعادن · ليبيا</p></div></div>
        <div className="pdf-bulletin-meta">
          <div>إعداد النسخة: <strong>{dateFormatter.format(new Date())}</strong></div>
          <div>تحديث البيانات: <strong>{updatedLabel}</strong></div>
          <div>الأوقات بتوقيت طرابلس · الأسعار بالدينار الليبي</div>
        </div>
      </header>
      <div className="pdf-bulletin-summary"><strong>نشرة الأسعار</strong><span>{parallel.length + official.length} صنف · مقارنة بالقراءة السابقة المتاحة</span></div>
      {groups.filter(group => group.items.length > 0).map(group => (
        <section className="pdf-bulletin-section" key={group.id} data-market={group.id}>
          <h2>{group.title}</h2><p>{group.unit} · {group.items.length} صنف</p>
          <table>
            <thead><tr><th scope="col">العملة / الصنف</th><th scope="col">السعر الحالي</th><th scope="col">السعر السابق</th><th scope="col">التغير</th><th scope="col">التغير %</th><th scope="col">الحركة</th></tr></thead>
            <tbody>{group.items.map(item => {
              const price = (group.official ? rates?.official[item.code] : rates?.parallel[item.code]) as number;
              const previous = group.official ? rates?.previousOfficial?.[item.code] : rates?.previousParallel?.[item.code];
              const hasPrevious = isPrice(previous);
              const difference = hasPrevious ? price - previous : null;
              const decimals = group.official ? 3 : 2;
              const changed = difference !== null && Math.abs(difference) >= .5 * Math.pow(10, -decimals);
              const tone = changed ? difference! > 0 ? 'pdf-up' : 'pdf-down' : '';
              const unit = group.id === 'metals' ? item.code.includes('LIRA') || item.code.includes('MUJARA') ? 'قطعة' : 'جرام' : item.code;
              return (
                <tr key={item.code} data-code={item.code}>
                  <td><div><PdfFlagIcon flagCode={item.flag} size={16} /><span><strong>{item.name}</strong><small>{unit}</small></span></div></td>
                  <td className="pdf-number pdf-current">{price.toFixed(decimals)}</td>
                  <td className="pdf-number">{hasPrevious ? previous.toFixed(decimals) : '—'}</td>
                  <td className={`pdf-number ${tone}`}>{difference === null ? '—' : changed ? `${difference > 0 ? '+' : ''}${difference.toFixed(decimals)}` : (0).toFixed(decimals)}</td>
                  <td className={`pdf-number ${tone}`}>{difference === null ? '—' : changed ? `${difference > 0 ? '+' : ''}${(difference / previous! * 100).toFixed(2)}%` : '0.00%'}</td>
                  <td className={tone}>{difference === null ? 'غير متاح' : changed ? difference > 0 ? 'ارتفاع ↑' : 'انخفاض ↓' : 'مستقر'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </section>
      ))}
      {parallel.length + official.length === 0 && <p>لا تتوفر أسعار للأصناف المختارة حاليًا.</p>}
      <div className="pdf-bulletin-notes">
        <p><strong>مصادر البيانات:</strong> أسعار السوق الموازي والمعادن من المصادر التي تعتمدها المنصة، والأسعار الرسمية من البيانات المنسوبة إلى مصرف ليبيا المركزي. المنصة مستقلة ولا تمثل المصرف أو جهة حكومية.</p>
        <p>الأسعار مرجع للمقارنة، وليست عرض بيع أو شراء. قد تختلف بحسب المكان والمبلغ وطريقة الدفع. قد تتأخر البيانات؛ وقت إعداد النسخة ليس وقت آخر تداول في السوق.</p>
        <p>المقارنة بالقراءة السابقة المتاحة، وليست بالضرورة مقارنة يومية. الرمز «—» يعني عدم توفر قراءة سابقة. الأصناف التي لا يتوفر سعرها وقت إعداد النشرة لا تُدرج.</p>
      </div>
      <footer className="pdf-bulletin-footer"><span>مؤشر الدينار · Dollar Price</span><span>{typeof window !== 'undefined' ? window.location.host : ''}</span><span>نشرة معلومات · ليست وثيقة اعتماد رسمية</span></footer>
    </div>
  );
});

PrintableBulletin.displayName = 'PrintableBulletin';
