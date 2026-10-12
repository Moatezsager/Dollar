import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { CurrencyConverterSection } from '../../src/components/CurrencyConverterSection';
import { useRatesCalculations } from '../../src/hooks/useRatesCalculations';
import '../../src/index.css';
import './capture.css';

// Training values never enter the public application or its price storage.
const rates = { parallel: { USD: 10, EUR: 12 }, official: { USD: 6, EUR: 7 }, lastUpdated: '2026-01-01T00:00:00Z' };
const terms = [{ id: 'USD', name: 'دولار أمريكي', flag: 'us' }, { id: 'EUR', name: 'يورو', flag: 'eu' }];
const captions = ['اختر الدولار من قائمة العملات.', 'أدخل 100 في خانة المبلغ بالعملة الأجنبية.', 'قارن القيمة بالدينار بين السوق الموازي والسعر الرسمي.', 'للتحويل العكسي، أدخل 500 دينار في خانة السوق الموازي.'];
const step = Number(new URLSearchParams(location.search).get('step') || 0);

function Capture() {
  const converter = useRatesCalculations({ rates, history: [], configTerms: terms, selectedRate: null });
  useEffect(() => {
    converter.setConvCurrency(step === 0 ? 'EUR' : 'USD');
    converter.setConvInputValue(step < 2 ? '' : '100');
  }, []);
  return <MotionConfig reducedMotion="always">
    <main className="app-shell capture-frame" dir="rtl">
      <header className="capture-brand">
        <img src="/logo.png" width="40" height="40" alt="" />
        <div><strong>مؤشر الدينار</strong><small>دليل محوّل العملات</small></div>
        <span>مثال تدريبي</span>
      </header>
      <CurrencyConverterSection activeTab="converter" configTerms={terms} {...converter} triggerHaptic={() => {}} />
      <footer><b>{step + 1} / 4</b><p>{captions[step]}</p><small>الأرقام توضيحية وليست أسعار السوق الحالية</small></footer>
    </main>
  </MotionConfig>;
}
createRoot(document.getElementById('capture')!).render(<Capture />);
