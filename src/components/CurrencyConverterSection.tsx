import React from "react";
import { motion } from "motion/react";
import { ArrowLeftRight, ArrowUpDown, ChevronDown } from "lucide-react";
import { METAL_IDS } from "../types/rates";

interface CurrencyConverterSectionProps {
  activeTab: string;
  configTerms: any[];
  convCurrency: string;
  setConvCurrency: (currency: string) => void;
  convActiveField: 'top' | 'parallel' | 'official';
  setConvActiveField: (field: 'top' | 'parallel' | 'official') => void;
  convInputValue: string;
  setConvInputValue: (val: string) => void;
  topAmount: number;
  parallelAmount: number;
  officialAmount: number;
  triggerHaptic: (pattern?: number | number[]) => void;
}

export const CurrencyConverterSection: React.FC<CurrencyConverterSectionProps> = ({
  activeTab,
  configTerms,
  convCurrency,
  setConvCurrency,
  convActiveField,
  setConvActiveField,
  convInputValue,
  setConvInputValue,
  topAmount,
  parallelAmount,
  officialAmount,
  triggerHaptic,
}) => {
  const detectCurrency = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('$') || lower.includes('usd') || lower.includes('دولار')) return 'USD';
    if (lower.includes('€') || lower.includes('eur') || lower.includes('يورو')) return 'EUR';
    if (lower.includes('£') || lower.includes('gbp') || lower.includes('باوند') || lower.includes('استرليني')) return 'GBP';
    if (lower.includes('tnd') || lower.includes('تونسي')) return 'TND';
    if (lower.includes('egp') || lower.includes('جنيه') || lower.includes('مصر')) return 'EGP';
    if (lower.includes('try') || lower.includes('₺') || lower.includes('ليرة') || lower.includes('تركي')) return 'TRY';
    if (lower.includes('cad') || lower.includes('كندي')) return 'CAD';
    if (lower.includes('aed') || lower.includes('درهم') || lower.includes('اماراتي')) return 'AED';
    if (lower.includes('sar') || lower.includes('ريال') || lower.includes('سعودي')) return 'SAR';
    if (lower.includes('lyd') || lower.includes('د.ل') || lower.includes('دينار') || lower.includes('ليبي')) return 'LYD';
    return null;
  };

  return (
    <section id="currency-converter-section" className={`converter-section ${activeTab === 'converter' ? '' : 'hidden md:block'}`}>
      <div className="relative max-w-4xl mx-auto">
        <div className="converter-heading">
          <div className="converter-heading-icon">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <h3>المحول الذكي</h3>
            <p>السوق الموازي والمصرف المركزي</p>
          </div>
        </div>

        <div className="converter-tool">
          <div className="converter-source">
            
            <div className="converter-source-fields">
              <div className="min-w-0">
                <label htmlFor="converter-currency">
                  اختر العملة
                </label>
                <div className="relative">
                  <select 
                    id="converter-currency"
                    aria-label="عملة التحويل"
                    value={convCurrency}
                    onChange={(e) => {
                      setConvCurrency(e.target.value);
                      if (convActiveField !== 'top') {
                        setConvActiveField('top');
                        setConvInputValue(topAmount.toString());
                      }
                    }}
                    className="converter-select"
                  >
                    {configTerms.filter(t => !METAL_IDS.includes(t.id) && t.id !== "OFFICIAL_USD").map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="converter-select-chevron" />
                </div>
              </div>

              <div className="min-w-0">
                <label htmlFor="converter-foreign">
                  المبلغ بالعملة الأجنبية
                </label>
                <motion.input 
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  id="converter-foreign"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  aria-label="المبلغ بالعملة الأجنبية"
                  value={convActiveField === 'top' ? convInputValue : (topAmount ? (topAmount % 1 === 0 ? topAmount : topAmount.toFixed(2)) : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConvActiveField('top');
                    setConvInputValue(val);
                    const detected = detectCurrency(val);
                    if (detected && detected !== 'LYD') {
                      setConvCurrency(detected);
                    }
                  }}
                  className="converter-amount"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="converter-divider">
            <motion.button
              aria-label="إدخال القيمة بالدينار"
              title="إدخال القيمة بالدينار"
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                triggerHaptic(10);
                setConvActiveField('parallel');
              }}
              className="converter-direction"
            >
              <ArrowUpDown aria-hidden="true" className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="converter-results">

            <div>
              <div className="converter-results-heading">
                <h4>
                  القيمة بالدينار الليبي (LYD)
                </h4>
              </div>

              <div className="converter-result-fields">
                <div className="converter-market converter-market-parallel">
                  <label htmlFor="converter-parallel">السوق الموازي</label>
                  <div className="converter-value" dir="ltr">
                    <span>LYD</span>
                    <motion.input
                      id="converter-parallel"
                      inputMode="decimal"
                      step="any"
                      aria-label="المبلغ بالدينار في السوق الموازي"
                      type="number"
                      value={convActiveField === 'parallel' ? convInputValue : (parallelAmount ? (parallelAmount % 1 === 0 ? parallelAmount : parallelAmount.toFixed(2)) : '')}
                      onChange={(e) => {
                        setConvActiveField('parallel');
                        setConvInputValue(e.target.value);
                      }}
                      className="converter-amount"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="converter-market converter-market-official">
                  <label htmlFor="converter-official">السعر الرسمي</label>
                  <div className="converter-value" dir="ltr">
                    <span>LYD</span>
                    <motion.input
                      id="converter-official"
                      inputMode="decimal"
                      step="any"
                      aria-label="المبلغ بالدينار بالسعر الرسمي"
                      type="number"
                      value={convActiveField === 'official' ? convInputValue : (officialAmount ? (officialAmount % 1 === 0 ? officialAmount : officialAmount.toFixed(2)) : '')}
                      onChange={(e) => {
                        setConvActiveField('official');
                        setConvInputValue(e.target.value);
                      }}
                      className="converter-amount"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
