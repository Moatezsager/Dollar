import React, { forwardRef } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Rates, CurrencyItem, METAL_IDS } from "../types/rates";
import { PdfFlagIcon } from "./modals/PdfExportModal";

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

export const PrintableBulletin = forwardRef<HTMLDivElement, PrintableBulletinProps>(
  (
    {
      rates,
      configTerms,
      staleCurrencies,
      officialCurrencyList,
      selectedCurrencies,
      selectedOfficialCurrencies,
      usdRate,
      prevUsdRate,
      usdChecksRate,
      prevUsdChecksRate,
    },
    ref
  ) => {
    return (
      <div 
        id="pdf-report-container"
        ref={ref} 
        className="opacity-0 pointer-events-none absolute top-[-9999px] left-[-9999px] print:opacity-100 print:pointer-events-auto print:static print:block"
        style={{ 
          width: '210mm',
          minHeight: '297mm',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: "'Cairo', 'Arial', sans-serif",
          lineHeight: '1.5',
          direction: 'rtl',
          margin: '0',
          padding: '15mm 15mm',
          boxSizing: 'border-box'
        }}
        dir="rtl"
      >
        {/* Institutional Masthead with Official Logo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '3px solid #0f172a', marginBottom: '20px' }}>
          {/* Right: Official Logo & Network Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '64px', height: '64px', border: '2px solid #0f172a', padding: '2px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/logo.png" alt="شعار مؤشر الدينار" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', margin: '0', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
                شبكة مؤشر الدينار الإحصائية
              </h1>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', margin: '4px 0 0' }}>
                النشرة الإحصائية المعتمدة لأسعار الصرف والمعادن الثمينة في ليبيا
              </p>
              <p style={{ fontSize: '11px', color: '#475569', margin: '2px 0 0', fontWeight: '600' }}>
                منصة الرصد والتحليل الاقتصادي اللحظي | dinar-index.ly
              </p>
            </div>
          </div>

          {/* Left: Document Verification & Publication Metadata */}
          <div style={{ textAlign: 'left', border: '1.5px solid #0f172a', padding: '10px 14px', backgroundColor: '#f8fafc', minWidth: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>رقم النشرة:</span>
              <span style={{ fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}>
                DI-LY-{format(new Date(), "yyyyMMdd")}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>تاريخ الإصدار:</span>
              <span style={{ fontWeight: 'bold', color: '#0f172a' }}>
                {format(new Date(), "dd MMMM yyyy", { locale: ar })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
              <span>وقت الرصد:</span>
              <span style={{ fontWeight: 'bold', color: '#059669' }}>
                {format(new Date(), "HH:mm")} (توقيت طرابلس)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '10px', color: '#059669', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
              <span>حالة الاعتماد:</span>
              <span style={{ fontWeight: 'bold' }}>بيانات معتمدة رسمياً</span>
            </div>
          </div>
        </div>

        {/* Dynamic Executive Highlights Strip */}
        {(() => {
          const selectedParallel = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          const selectedMetals = configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          const selectedOfficial = officialCurrencyList.filter(c => selectedOfficialCurrencies.includes(c.code));

          const highlights: Array<{
            id: string;
            title: string;
            market: string;
            rate: number;
            prevRate: number;
            flagCode?: string;
            accentColor: string;
          }> = [];

          // 1. USD Cash if selected
          const usdTerm = configTerms.find(c => c.id === 'USD_CASH' || c.id === 'USD');
          if (usdTerm && selectedCurrencies.includes(usdTerm.id)) {
            const r = rates?.parallel[usdTerm.id] || usdRate || 0;
            const p = rates?.previousParallel?.[usdTerm.id] || prevUsdRate || r;
            highlights.push({ id: usdTerm.id, title: "الدولار الموازي (كاش)", market: "السوق الموازي", rate: r, prevRate: p, flagCode: "us", accentColor: "#059669" });
          }

          // 2. USD Checks if selected
          const chkTerm = configTerms.find(c => c.id === 'USD_CHECKS' || c.id === 'USD_JBANK' || c.id === 'USD_NCB');
          if (chkTerm && selectedCurrencies.includes(chkTerm.id)) {
            const r = rates?.parallel[chkTerm.id] || usdChecksRate || 0;
            const p = rates?.previousParallel?.[chkTerm.id] || prevUsdChecksRate || r;
            highlights.push({ id: chkTerm.id, title: "الدولار (صكوك)", market: "المقاصة المصرفية", rate: r, prevRate: p, flagCode: "us", accentColor: "#1d4ed8" });
          }

          // 3. Gold 18 if selected
          const goldTerm = configTerms.find(c => c.id === 'GOLD_SCRAP_18' || c.id === 'GOLD_CAST_18');
          if (goldTerm && selectedCurrencies.includes(goldTerm.id)) {
            const r = rates?.parallel[goldTerm.id] || 0;
            const p = rates?.previousParallel?.[goldTerm.id] || r;
            highlights.push({ id: goldTerm.id, title: "ذهب كسر 18", market: "سوق الصاغة / جرام", rate: r, prevRate: p, flagCode: "gold", accentColor: "#b45309" });
          }

          // 4. Official USD if selected
          if (selectedOfficialCurrencies.includes('USD')) {
            const r = rates?.official['USD'] || 0;
            const p = rates?.previousOfficial?.['USD'] || r;
            highlights.push({ id: 'OFF_USD', title: "الدولار الرسمي", market: "مصرف ليبيا المركزي", rate: r, prevRate: p, flagCode: "us", accentColor: "#475569" });
          }

          // Backfill up to 3 items if fewer than 3 were matched
          if (highlights.length < 3) {
            for (const p of selectedParallel) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === p.id)) continue;
              const r = rates?.parallel[p.id] || 0;
              const prev = rates?.previousParallel?.[p.id] || r;
              highlights.push({ id: p.id, title: p.name, market: "السوق الموازي", rate: r, prevRate: prev, flagCode: p.flag, accentColor: "#059669" });
            }
          }
          if (highlights.length < 3) {
            for (const m of selectedMetals) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === m.id)) continue;
              const r = rates?.parallel[m.id] || 0;
              const prev = rates?.previousParallel?.[m.id] || r;
              highlights.push({ id: m.id, title: m.name, market: "سوق المعادن", rate: r, prevRate: prev, flagCode: m.flag, accentColor: "#b45309" });
            }
          }
          if (highlights.length < 3) {
            for (const off of selectedOfficial) {
              if (highlights.length >= 3) break;
              if (highlights.some(h => h.id === `OFF_${off.code}`)) continue;
              const r = rates?.official[off.code] || 0;
              const prev = rates?.previousOfficial?.[off.code] || r;
              highlights.push({ id: `OFF_${off.code}`, title: `${off.name} (رسمي)`, market: "مصرف المركزي", rate: r, prevRate: prev, flagCode: off.flag, accentColor: "#1d4ed8" });
            }
          }

          if (highlights.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '10px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${highlights.length}, 1fr)`, gap: '14px' }}>
                {highlights.map(item => {
                  const diff = item.rate - item.prevRate;
                  const isUp = diff > 0.0001;
                  const isDown = diff < -0.0001;

                  return (
                    <div 
                      key={`pdf-high-${item.id}`}
                      style={{ 
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #0f172a',
                        borderRight: `5px solid ${item.accentColor}`,
                        padding: '12px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PdfFlagIcon flagCode={item.flagCode} size={18} />
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{item.title}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold' }}>{item.market}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>
                          {item.rate.toFixed(item.id.startsWith('OFF_') ? 3 : 2)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>د.ل</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontSize: '11px' }}>
                        <span style={{ color: '#475569' }}>السابق: {item.prevRate.toFixed(item.id.startsWith('OFF_') ? 3 : 2)}</span>
                        <span style={{ fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr' }}>
                          {!isUp && !isDown ? '▬ مستقر' : isUp ? `▲ +${Math.abs(diff).toFixed(2)}` : `▼ -${Math.abs(diff).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Section 1: Parallel Market Currencies */}
        {(() => {
          const selectedParallel = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          if (selectedParallel.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  أولاً: أسعار الصرف في السوق الموازي (الصحيفة الموازية)
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد العملات المدرجة: {selectedParallel.length} عملة
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>العملة / وسيلة الدفع</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>الرمز</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الحالي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedParallel.map((c, idx) => {
                      const rate = rates?.parallel[c.id] || 0;
                      const prev = rates?.previousParallel?.[c.id] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;

                      return (
                        <tr key={`pdf-par-row-${c.id}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#475569', fontFamily: 'monospace', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {c.id}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00' : isUp ? `+${diff.toFixed(2)}` : `${diff.toFixed(2)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d' }}>
                            {!isUp && !isDown ? 'مستقر' : isUp ? 'ارتفاع ▲' : 'انخفاض ▼'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Section 2: Gold & Precious Metals */}
        {(() => {
          const selectedMetals = configTerms.filter(c => METAL_IDS.includes(c.id) && selectedCurrencies.includes(c.id) && !staleCurrencies.has(c.id));
          if (selectedMetals.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  ثانياً: أسعار الذهب والمعادن الثمينة (سوق الصاغة)
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد الأصناف المدرجة: {selectedMetals.length} صنف
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>الصنف / العيار</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>الوحدة</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الحالي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMetals.map((c, idx) => {
                      const rate = rates?.parallel[c.id] || 0;
                      const prev = rates?.previousParallel?.[c.id] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;
                      const unit = c.id.includes('LIRA') || c.id.includes('MUJARA') ? 'قطعة' : 'جرام';

                      return (
                        <tr key={`pdf-metal-row-${c.id}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#475569', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {unit}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(2)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00' : isUp ? `+${diff.toFixed(2)}` : `${diff.toFixed(2)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d' }}>
                            {!isUp && !isDown ? 'مستقر' : isUp ? 'ارتفاع ▲' : 'انخفاض ▼'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Section 3: Official Central Bank Rates */}
        {(() => {
          const selectedOfficial = officialCurrencyList.filter(c => selectedOfficialCurrencies.includes(c.code));
          if (selectedOfficial.length === 0) return null;

          return (
            <div className="pdf-avoid-break" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '2px solid #0f172a', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                  ثالثاً: أسعار الصرف الرسمية الصادرة عن مصرف ليبيا المركزي
                </h2>
                <span style={{ fontSize: '11px', color: '#475569', marginRight: 'auto', fontWeight: 'bold' }}>
                  عدد العملات المدرجة: {selectedOfficial.length} عملة
                </span>
              </div>

              <div style={{ border: '1.5px solid #0f172a', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #0f172a', color: '#0f172a' }}>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 'bold', borderLeft: '1px solid #0f172a' }}>العملة الرسمية</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 'bold', width: '80px', borderLeft: '1px solid #0f172a' }}>رمز ISO</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '110px', borderLeft: '1px solid #0f172a' }}>السعر الرسمي</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>السعر السابق</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 'bold', width: '100px', borderLeft: '1px solid #0f172a' }}>مقدار التغير</th>
                      <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 'bold', width: '90px', borderLeft: '1px solid #0f172a' }}>نسبة التغير</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 'bold', width: '90px' }}>مصدر البيانات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOfficial.map((c, idx) => {
                      const rate = rates?.official[c.code] || 0;
                      const prev = rates?.previousOfficial?.[c.code] || rate;
                      const diff = rate - prev;
                      const isUp = diff > 0.0001;
                      const isDown = diff < -0.0001;
                      const pct = prev > 0 ? (Math.abs(diff) / prev * 100).toFixed(2) : '0.00';
                      const isEven = idx % 2 === 0;

                      return (
                        <tr key={`pdf-off-row-${c.code}`} style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 'bold', color: '#0f172a', borderLeft: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PdfFlagIcon flagCode={c.flag} size={18} />
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 8px', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1' }}>
                            {c.code}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {rate > 0 ? `${rate.toFixed(3)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', color: '#475569', fontWeight: '600', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {prev > 0 ? `${prev.toFixed(3)} د.ل` : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 12px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', fontFamily: 'monospace', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.000' : isUp ? `+${diff.toFixed(3)}` : `${diff.toFixed(3)}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 'bold', color: !isUp && !isDown ? '#475569' : isUp ? '#dc2626' : '#15803d', direction: 'ltr', borderLeft: '1px solid #cbd5e1' }}>
                            {!isUp && !isDown ? '0.00%' : isUp ? `+${pct}%` : `-${pct}%`}
                          </td>
                          <td style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 'bold', fontSize: '10px', color: '#334155' }}>
                            مصرف ليبيا المركزي
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Authentic Institutional Certification & Footer */}
        <div className="pdf-avoid-break" style={{ marginTop: '30px', paddingTop: '16px', borderTop: '3px solid #0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
            {/* Right: Methodology and Disclaimer */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px' }}>
                منهجية الرصد الميداني ومصادر البيانات:
              </p>
              <p style={{ fontSize: '10px', color: '#475569', lineHeight: '1.6', margin: '0 0 6px' }}>
                تم إعداد هذه النشرة الإحصائية وفق منهجية الرصد المباشر والتوثيق الميداني لتداولات أسواق الصرف الأجنبي والذهب والمعادن الثمينة في المدن الليبية الرئيسية (طرابلس، بنغازي، مصراتة)، بالتعاون مع كبار المتداولين المعتمدين والمؤسسات المصرفية الرسمية، إلى جانب النشرات الرسمية الدورية الصادرة عن مصرف ليبيا المركزي.
              </p>
              <p style={{ fontSize: '9px', color: '#64748b', lineHeight: '1.5', margin: '0' }}>
                تنويه قانوني: تعتبر هذه النشرة وثيقة إحصائية واسترشادية لتوثيق حركة الأسعار اللحظية لأغراض التوثيق الإحصائي والتحليل المالي والبحث الأكاديمي. تخضع جميع أسواق التداول للتأثر المستمر بآليات العرض والطلب المحلي والعوامل والظروف الاقتصادية والسياسية المؤثرة في حركة السوق.
              </p>
            </div>

            {/* Left: Official Digital Seal / Institutional Stamp */}
            <div style={{ border: '2px solid #0f172a', padding: '10px 18px', backgroundColor: '#f8fafc', textAlign: 'center', minWidth: '200px', flexShrink: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px', letterSpacing: '0.5px' }}>
                مؤشر الدينار الليبي
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155', margin: '0 0 4px' }}>
                إدارة الرصد والتحليل المالي
              </p>
              <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#059669', margin: '0 0 6px' }}>
                ✓ معتمد للتوثيق والطباعة
              </p>
              <p style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace', fontWeight: 'bold', margin: '0', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                REF: DI-AUT-{format(new Date(), "yyyyMMdd")}
              </p>
            </div>
          </div>

          {/* Legal / Copyright Bar */}
          <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#475569' }}>
            <span>الموقع الرسمي للشبكة: dinar-index.ly</span>
            <span style={{ fontWeight: 'bold' }}>جميع الحقوق محفوظة © شبكة مؤشر الدينار 2026</span>
            <span>نظام التقارير المالية اللحظي v2.5</span>
          </div>
        </div>
      </div>
    );
  }
);

PrintableBulletin.displayName = "PrintableBulletin";
