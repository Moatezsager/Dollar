import React, { useEffect, useMemo, useState } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS, Step, CallBackProps, TooltipRenderProps } from 'react-joyride';
import { ArrowLeft, ArrowRight, Banknote, Building2, ChartNoAxesCombined, Coins, ArrowLeftRight, Settings2, X, type LucideIcon } from 'lucide-react';
import { safeStorage } from '../../utils/storage';
import '../../styles/app-guide.css';

export type TourSection = 'main' | 'gold' | 'charts' | 'converter';

export const TOUR_STEPS: (Step & { data: { section: TourSection; Icon: LucideIcon; summary: string } })[] = [
  {
    target: '[data-tour="primary-price"]', title: 'الأسعار الرئيسية',
    content: 'تابع الدولار واليورو وآخر تغيّر. تعرض الرئيسية أيضًا الصكوك والحوالات؛ افتح أي بطاقة لقراءة التفاصيل.',
    placement: 'bottom', disableBeacon: true,
    data: { section: 'main', Icon: Banknote, summary: 'الدولار واليورو، الصكوك والحوالات وتفاصيل العملات.' },
  },
  {
    target: '#official-rates-grid > div:first-child', title: 'أسعار المصرف المركزي',
    content: 'أسعار الصرف الرسمية المعتمدة من مصرف ليبيا المركزي، منفصلة عن أسعار السوق الموازي.',
    placement: 'bottom', disableBeacon: true,
    data: { section: 'main', Icon: Building2, summary: 'الأسعار الرسمية للعملات مقابل الدينار الليبي.' },
  },
  {
    target: '[data-tour="metals-heading"]', title: 'الذهب والفضة',
    content: 'أسعار المعادن حسب النوع والعيار. افتح بطاقة متاحة للاطلاع على تفاصيلها.',
    placement: 'bottom', disableBeacon: true,
    data: { section: 'gold', Icon: Coins, summary: 'المعادن المتاحة، العيارات ووحدات التسعير.' },
  },
  {
    target: '.analysis-toolbar', title: 'التحليل والرسوم البيانية',
    content: 'اختر العملة والفترة الزمنية لمقارنة حركة السعر. يعتمد الرسم على القراءات التاريخية المتاحة.',
    placement: 'bottom', disableBeacon: true,
    data: { section: 'charts', Icon: ChartNoAxesCombined, summary: 'حركة الأسعار خلال الفترة التي تختارها.' },
  },
  {
    target: '#converter-foreign', title: 'محوّل العملات',
    content: 'اختر العملة وأدخل المبلغ. تظهر قيمته بالدينار في السوقين، ويمكنك إدخال الدينار للتحويل العكسي.',
    placement: 'bottom', disableBeacon: true,
    data: { section: 'converter', Icon: ArrowLeftRight, summary: 'تحويل المبالغ ومقارنة الموازي بالسعر الرسمي.' },
  },
  {
    target: '#more-menu-btn', title: 'الإعدادات والمزيد',
    content: 'من هنا تصل إلى الإعدادات والتنبيهات، مشاركة الموقع، نشرة PDF والتواصل مع الفريق.',
    placement: 'bottom', isFixed: true, disableBeacon: true,
    data: { section: 'main', Icon: Settings2, summary: 'تفضيلات الجهاز، التنبيهات والمشاركة والتواصل.' },
  },
];

export function CustomTourTooltip({ index, step, size, backProps, closeProps, primaryProps, skipProps, tooltipProps, isLastStep }: TooltipRenderProps) {
  const Icon = step.data.Icon as LucideIcon;
  return <div {...tooltipProps} className="tour-tooltip" dir="rtl" aria-labelledby={`tour-title-${index}`} aria-describedby={`tour-description-${index}`}>
    <header className="tour-header">
      <span>الخطوة {index + 1} من {size}</span>
      <button {...closeProps} className="tour-icon" aria-label="إغلاق الجولة" title="إغلاق الجولة"><X aria-hidden="true" /></button>
    </header>
    <div className="tour-body">
      <div className="tour-heading"><Icon aria-hidden="true" /><h3 id={`tour-title-${index}`}>{step.title}</h3></div>
      <p id={`tour-description-${index}`}>{step.content}</p>
    </div>
    <footer className="tour-footer">
      <progress max={size} value={index + 1} aria-label="تقدم الجولة" />
      <div className="tour-actions">
        {index > 0
          ? <button {...backProps} className="tour-back" aria-label="السابق"><ArrowRight aria-hidden="true" />السابق</button>
          : <button {...skipProps} className="tour-back" aria-label="تخطي الجولة">تخطي الجولة</button>}
        <button {...primaryProps} className="tour-next" aria-label={isLastStep ? 'إنهاء الجولة' : 'التالي'}>
          {isLastStep ? 'إنهاء الجولة' : 'التالي'}{!isLastStep && <ArrowLeft aria-hidden="true" />}
        </button>
      </div>
    </footer>
  </div>;
}

interface AppTourProps {
  runTour: boolean;
  initialStep?: number;
  onNavigate: (section: TourSection) => void;
  setRunTour?: (run: boolean) => void;
  triggerHaptic?: (pattern?: number | number[]) => void;
  onCallback?: (data: CallBackProps) => void;
  onCloseTour?: () => void;
}

export const AppTour: React.FC<AppTourProps> = ({ runTour, initialStep = 0, onNavigate, setRunTour, triggerHaptic, onCallback, onCloseTour }) => {
  const [stepIndex, setStepIndex] = useState(() => Math.max(0, Math.min(TOUR_STEPS.length - 1, initialStep)));
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 359px), (max-height: 480px)').matches);
  const steps = useMemo(() => TOUR_STEPS.map((step, index): Step => index === stepIndex
    ? { ...step, target: target || step.target, placement: compact ? 'center' : step.placement }
    : step), [stepIndex, target, compact]);

  const finish = () => {
    safeStorage.setItem('hasSeenTour', 'true');
    safeStorage.setItem('tourCompleted', 'true');
    setRunTour?.(false);
    triggerHaptic?.(10);
    onCloseTour?.();
    requestAnimationFrame(() => document.getElementById('more-menu-btn')?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const compactMedia = window.matchMedia('(max-width: 359px), (max-height: 480px)');
    const change = () => { setReady(false); setMobile(media.matches); setCompact(compactMedia.matches); };
    media.addEventListener('change', change);
    compactMedia.addEventListener('change', change);
    return () => { media.removeEventListener('change', change); compactMedia.removeEventListener('change', change); };
  }, []);

  useEffect(() => {
    if (!runTour) return;
    setReady(false);
    onNavigate(TOUR_STEPS[stepIndex].data.section);
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    // Wait for the selected tab to render; responsive headings may have a hidden twin.
    const locate = () => {
      const element = Array.from(document.querySelectorAll<HTMLElement>(TOUR_STEPS[stepIndex].target as string))
        .find(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
      if (element) { setTarget(element); setReady(true); }
      else if (++attempts < 40) timer = setTimeout(locate, 50);
      else if (stepIndex < TOUR_STEPS.length - 1) setStepIndex(stepIndex + 1);
      else finish();
    };
    timer = setTimeout(locate, 0);
    return () => clearTimeout(timer);
  }, [runTour, stepIndex, mobile, compact, onNavigate]);

  const handleCallback = (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED || data.action === ACTIONS.CLOSE) finish();
    else if (data.type === EVENTS.STEP_AFTER || data.type === EVENTS.TARGET_NOT_FOUND) {
      const next = data.index + (data.action === ACTIONS.PREV ? -1 : 1);
      setReady(false);
      if (next >= TOUR_STEPS.length) finish();
      else setStepIndex(Math.max(0, next));
    }
    onCallback?.(data);
  };

  return <Joyride steps={steps} stepIndex={stepIndex} run={runTour && ready} continuous showSkipButton showProgress
    callback={handleCallback} tooltipComponent={CustomTourTooltip} disableOverlayClose spotlightPadding={8}
    scrollToFirstStep scrollDuration={0} scrollOffset={mobile ? 80 : 112}
    locale={{ back: 'السابق', close: 'إغلاق الجولة', last: 'إنهاء الجولة', next: 'التالي', skip: 'تخطي الجولة', nextLabelWithProgress: 'التالي' }}
    floaterProps={{ disableAnimation: true }}
    styles={{ options: { zIndex: 1100, overlayColor: 'rgba(0,0,0,.58)', arrowColor: 'var(--surface)' }, spotlight: { borderRadius: 8 } }} />;
};
