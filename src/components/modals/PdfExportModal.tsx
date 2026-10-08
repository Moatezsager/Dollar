import React, { useState } from 'react';
import { Coins, Printer, X } from 'lucide-react';
import { Rates, CurrencyItem, METAL_IDS } from '../../types/rates';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface PdfExportModalProps {
  showCurrencyModal: boolean;
  setShowCurrencyModal: (show: boolean) => void;
  configTerms: any[];
  staleCurrencies: Set<string>;
  officialCurrencyList: CurrencyItem[];
  selectedCurrencies: string[];
  setSelectedCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOfficialCurrencies: string[];
  setSelectedOfficialCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  rates: Rates | null;
  triggerHaptic: (pattern?: number | number[]) => void;
  generatePDF: (parallelList?: string[], officialList?: string[]) => void;
}

export const PdfFlagIcon = ({ flagCode, size = 24 }: { flagCode?: string; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const code = flagCode?.trim().toLowerCase();
  const isFlag = /^[a-z]{2}$/.test(code || '') && !failed;
  return (
    <span aria-hidden="true" style={{ width: size * 1.5, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {isFlag ? <img src={`https://flagcdn.com/w160/${code}.png`} alt="" onError={() => setFailed(true)}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2 }} /> :
        <Coins size={size * .8} color={code === 'gold' ? '#916000' : '#52656f'} />}
    </span>
  );
};

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  showCurrencyModal, setShowCurrencyModal, configTerms, staleCurrencies, officialCurrencyList,
  selectedCurrencies, setSelectedCurrencies, selectedOfficialCurrencies, setSelectedOfficialCurrencies,
  rates, triggerHaptic, generatePDF,
}) => {
  const [category, setCategory] = useState('all');
  const dialogRef = useDialogAccessibility(showCurrencyModal, () => setShowCurrencyModal(false));
  const available = configTerms.filter(c => c.id !== 'OFFICIAL_USD' && !staleCurrencies.has(c.id) &&
    Number.isFinite(rates?.parallel[c.id]) && (rates?.parallel[c.id] || 0) > 0);
  const official = officialCurrencyList.filter(c => Number.isFinite(rates?.official[c.code]) && (rates?.official[c.code] || 0) > 0);
  const selectedParallel = available.filter(c => selectedCurrencies.includes(c.id)).map(c => c.id);
  const selectedOfficial = official.filter(c => selectedOfficialCurrencies.includes(c.code)).map(c => c.code);
  const count = selectedParallel.length + selectedOfficial.length;
  const groups = [
    { id: 'parallel', title: 'السوق الموازي', items: available.filter(c => !METAL_IDS.includes(c.id)).map(c => ({ code: c.id, name: c.name, flag: c.flag })), official: false },
    { id: 'metals', title: 'الذهب والمعادن', items: available.filter(c => METAL_IDS.includes(c.id)).map(c => ({ code: c.id, name: c.name, flag: c.flag })), official: false },
    { id: 'official', title: 'السوق الرسمي', items: official, official: true },
  ];

  if (!showCurrencyModal) return null;
  return (
    <div className="pdf-selection-backdrop" onClick={event => { if (event.target === event.currentTarget) setShowCurrencyModal(false); }}>
      <style>{`
        .pdf-selection-backdrop { position: fixed; inset: 0; z-index: 100; background: rgb(0 0 0 / 70%); display: flex; justify-content: center; align-items: center; padding: 12px; }
        .pdf-selection { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; width: 100%; max-width: 720px; max-height: calc(100dvh - 24px); display: flex; flex-direction: column; }
        .pdf-selection-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px; border-bottom: 1px solid var(--line); }
        .pdf-selection-header h2 { font-size: 20px; font-weight: 800; }
        .pdf-selection-header p { font-size: 13px; color: var(--muted-ink); margin-top: 6px; }
        .pdf-selection button { min-height: 44px; border-radius: 8px; font-size: 13px; font-weight: 600; }
        .pdf-selection-close { width: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--muted-ink); }
        .pdf-selection-scroll { overflow-y: auto; min-height: 0; padding: 16px 20px; overscroll-behavior: contain; }
        .pdf-selection-filter { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
        .pdf-selection-filter button { padding: 8px; color: var(--muted-ink); }
        .pdf-selection-filter button[aria-pressed="true"] { color: var(--positive); background: var(--surface-raised); }
        .pdf-selection-actions { display: flex; gap: 16px; padding: 8px 0; }
        .pdf-selection-actions button { color: var(--positive); }
        .pdf-selection-group { border: 0; margin-top: 16px; min-width: 0; }
        .pdf-selection-group legend { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
        .pdf-selection-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
        .pdf-selection-item { display: flex; align-items: center; gap: 10px; padding: 12px; min-height: 68px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
        .pdf-selection-item:has(input:checked) { border-color: var(--positive); background: var(--surface-raised); }
        .pdf-selection-item input { width: 18px; height: 18px; min-height: 0; accent-color: var(--positive); flex-shrink: 0; }
        .pdf-selection-item > span:nth-of-type(2) { min-width: 0; flex: 1; }
        .pdf-selection-item strong { display: block; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
        .pdf-selection-item small { color: var(--muted-ink); font-size: 12px; font-variant-numeric: tabular-nums; }
        .pdf-selection-empty { color: var(--muted-ink); font-size: 14px; padding-block: 16px; }
        .pdf-selection-footer { padding: 16px 20px; border-top: 1px solid var(--line); flex-shrink: 0; }
        .pdf-selection-footer p { color: var(--muted-ink); font-size: 12px; line-height: 1.8; margin-bottom: 12px; }
        .pdf-selection-footer > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .pdf-selection-footer span { font-size: 13px; white-space: nowrap; }
        .pdf-selection-print { display: inline-flex; justify-content: center; align-items: center; gap: 8px; padding: 10px 16px; background: var(--positive); color: var(--page); }
        .pdf-selection-print:disabled { opacity: .5; cursor: not-allowed; }
        .pdf-selection :is(button, input):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
        @media (min-width: 540px) { .pdf-selection-filter { grid-template-columns: repeat(4, minmax(0, 1fr)); } .pdf-selection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-height: 600px) { .pdf-selection-header { padding: 12px 16px; } .pdf-selection-header p { display: none; } .pdf-selection-footer { padding: 12px 16px; } }
      `}</style>
      <div ref={dialogRef} className="pdf-selection" role="dialog" aria-modal="true" aria-labelledby="pdf-selection-title" tabIndex={-1} dir="rtl">
        <header className="pdf-selection-header">
          <div><h2 id="pdf-selection-title">نشرة الأسعار</h2><p>العملات والمعادن التي ستظهر في النشرة</p></div>
          <button className="pdf-selection-close" aria-label="إغلاق نافذة النشرة" title="إغلاق" onClick={() => setShowCurrencyModal(false)}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="pdf-selection-scroll">
          <div className="pdf-selection-filter" role="group" aria-label="تصفية أصناف النشرة">
            {[{ id: 'all', title: 'الكل' }, ...groups].map(group => <button key={group.id} aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.title}</button>)}
          </div>
          <div className="pdf-selection-actions">
            <button onClick={() => { setSelectedCurrencies(available.map(c => c.id)); setSelectedOfficialCurrencies(official.map(c => c.code)); }}>تحديد الكل</button>
            <button onClick={() => { setSelectedCurrencies([]); setSelectedOfficialCurrencies([]); }}>إلغاء التحديد</button>
          </div>
          {groups.filter(group => category === 'all' || category === group.id).map(group => (
            <fieldset className="pdf-selection-group" key={group.id}>
              <legend>{group.title}</legend>
              {group.items.length === 0 ? <p className="pdf-selection-empty">لا توجد أسعار متاحة في هذا القسم.</p> :
                <div className="pdf-selection-grid">{group.items.map(item => {
                  const selected = group.official ? selectedOfficialCurrencies : selectedCurrencies;
                  const checked = selected.includes(item.code);
                  const price = group.official ? rates?.official[item.code] : rates?.parallel[item.code];
                  return (
                    <label className="pdf-selection-item" key={item.code}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        triggerHaptic(8);
                        const update = (previous: string[]) => checked ? previous.filter(id => id !== item.code) : [...previous, item.code];
                        if (group.official) setSelectedOfficialCurrencies(update); else setSelectedCurrencies(update);
                      }} />
                      <PdfFlagIcon flagCode={item.flag} size={22} />
                      <span><strong>{item.name}</strong><small><bdi>{price?.toFixed(group.official ? 3 : 2)}</bdi> د.ل</small></span>
                    </label>
                  );
                })}</div>}
            </fieldset>
          ))}
        </div>
        <footer className="pdf-selection-footer">
          <p>الأسعار بالدينار الليبي. ستفتح نافذة طباعة المتصفح، ومنها يمكنك حفظ النشرة بصيغة PDF. هذه نشرة المنصة، وليست وثيقة اعتماد رسمية.</p>
          <div><span role="status">{count} صنف محدد</span><button className="pdf-selection-print" disabled={count === 0}
            onClick={() => generatePDF(selectedParallel, selectedOfficial)}><Printer size={18} aria-hidden="true" />طباعة / PDF</button></div>
        </footer>
      </div>
    </div>
  );
};
