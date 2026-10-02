import React from "react";
import Joyride, { Step, CallBackProps, TooltipRenderProps } from 'react-joyride';
import { X, ArrowRight } from "lucide-react";
import { safeStorage } from "../../utils/storage";

export const TOUR_STEPS: Step[] = [
  {
    target: 'body',
    title: 'مرحباً بك في منصة المؤشر!',
    content: 'أهلاً بك في منصة المؤشر لأسعار الصرف. دليلك الشامل لمتابعة أسعار العملات في ليبيا لحظة بلحظة. دعنا نأخذك في جولة سريعة للتعرف على أهم الميزات.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#main-rates-grid',
    title: 'أسعار السوق الموازي',
    content: 'هنا يمكنك متابعة أحدث أسعار العملات الأجنبية في السوق الموازي، مع مؤشرات توضح اتجاه السعر (ارتفاع أو انخفاض) مقارنة بآخر تحديث.',
    placement: 'bottom',
  },
  {
    target: '#checks-grid',
    title: 'أسعار الصكوك',
    content: 'في هذا القسم، نعرض لك أسعار الدولار مقابل صكوك المصارف التجارية المختلفة (مثل التجارة والتنمية، الوحدة، الجمهورية).',
    placement: 'bottom',
  },
  {
    target: '#transfers-grid',
    title: 'حوالات العملة (خارج ليبيا)',
    content: 'هنا تجد أسعار حوالات العملة إلى أهم الوجهات التجارية (مثل تركيا، دبي، والصين) لتسهيل متابعة تكاليف الاستيراد.',
    placement: 'bottom',
  },
  {
    target: '#metals-grid',
    title: 'أسعار الذهب والمعادن الثمينة',
    content: 'قسم مخصص يعرض أسعار الذهب والفضة (كسر، مسبوك، ليرات) بالدينار الليبي بحديث لحظي يواكب البورصة والأسواق المحلية.',
    placement: 'top',
  },
  {
    target: '#official-rates-grid',
    title: 'أسعار السوق الرسمي',
    content: 'يعرض هذا القسم أسعار الصرف الرسمية المعتمدة من مصرف ليبيا المركزي للعملات الرئيسية، ويتم تحديثها تلقائياً.',
    placement: 'top',
  },
  {
    target: '#historical-chart',
    title: 'الرسم البياني للتغيرات',
    content: 'رسم بياني تفاعلي يعرض مسار تغير سعر الدولار في السوق الموازي خلال الفترة الماضية ليعطيك نظرة عامة سريعة على اتجاه السوق.',
    placement: 'bottom',
  },
  {
    target: '#currency-converter-section',
    title: 'محول العملات الذكي',
    content: 'أداة قوية لحساب القيم بين الدينار الليبي والعملات الأخرى. تعرض لك النتيجة في السوق الموازي والسعر الرسمي في نفس الوقت للمقارنة.',
    placement: 'top',
  },
  {
    target: '#converter-input',
    title: 'إدخال المبلغ والتبديل',
    content: 'أدخل المبلغ هنا، واختر العملة. يمكنك استخدام زر التبديل (الأسهم) لعكس عملية التحويل بين العملة الأجنبية والدينار الليبي بسهولة.',
    placement: 'top',
  },
  {
    target: '#mobile-bottom-nav',
    title: 'شريط التنقل السريع للهواتف',
    content: 'على الهواتف، يتيح لك هذا الشريط السفلي التنقل الفوري والمرن بين أسعار العملات، الذهب، الحاسبة، والرسوم الإحصائية بضغطة زر.',
    placement: 'top',
  },
  {
    target: '#more-menu-btn',
    title: 'خيارات إضافية',
    content: 'من هنا يمكنك مشاركة التطبيق مع الآخرين، تحميل تقرير PDF احترافي للأسعار الحالية، أو تخصيص إعدادات التنبيهات الذكية.',
    placement: 'bottom',
  }
];

export const CustomTourTooltip = ({
  continuous,
  index,
  step,
  size,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  onCloseTour,
}: TooltipRenderProps & { onCloseTour?: () => void }) => {
  const isFirstStep = index === 0;
  
  return (
    <div 
      {...tooltipProps} 
      className="relative glass-panel-heavy premium-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[360px] max-w-[92vw] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden" 
      dir="rtl"
    >
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 sm:mb-4 relative z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <span className="text-emerald-400 font-black text-base sm:text-lg">{index + 1}</span>
          </div>
          <h3 className="text-white font-black text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-white to-zinc-400">
            {step.title}
          </h3>
        </div>
        
        <button 
          {...closeProps} 
          className="text-slate-500 hover:text-white hover:bg-white/10 transition-all p-1 sm:p-1.5 rounded-full shrink-0 group -mr-1"
          onClick={(e) => {
            if (closeProps.onClick) closeProps.onClick(e);
            if (onCloseTour) onCloseTour();
            safeStorage.setItem('tourCompleted', 'true');
          }}
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Content */}
      <div className="text-slate-400 text-sm leading-relaxed mb-6 sm:mb-8 font-medium relative z-10 px-1 sm:px-2">
        {step.content}
      </div>

      {/* Progress & Actions */}
      <div className="flex flex-col gap-4 relative z-10">
        {/* Custom Progress Bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-l from-emerald-500 to-blue-500 rounded-full transition-all duration-500 relative"
            style={{ width: `${((index + 1) / size) * 100}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-row items-center justify-between mt-1 sm:mt-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {!isFirstStep && (
              <button {...backProps} className="px-2 sm:px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/5 rounded-lg sm:rounded-xl transition-all uppercase tracking-widest">
                السابق
              </button>
            )}
            {isFirstStep && (
              <button {...skipProps} className="px-2 sm:px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/5 rounded-lg sm:rounded-xl transition-all uppercase tracking-widest">
                تخطي
              </button>
            )}
          </div>
          
          <button 
            {...primaryProps} 
            className="group px-4 sm:px-6 py-2 sm:py-2.5 text-xs font-black bg-gradient-to-l from-emerald-500 to-emerald-400 text-[#050505] rounded-lg sm:rounded-xl hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] active:scale-95 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2"
          >
            {isLastStep ? 'إنهاء' : 'التالي'}
            {!isLastStep && <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 -scale-x-100 group-hover:translate-x-1 transition-transform" />}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AppTourProps {
  runTour: boolean;
  setRunTour?: (run: boolean) => void;
  triggerHaptic?: (pattern?: number | number[]) => void;
  onCallback?: (data: CallBackProps) => void;
  onCloseTour?: () => void;
}

export const AppTour: React.FC<AppTourProps> = ({ runTour, setRunTour, triggerHaptic, onCallback, onCloseTour }) => {
  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      safeStorage.setItem('hasSeenTour', 'true');
      if (setRunTour) setRunTour(false);
      if (triggerHaptic) triggerHaptic(10);
    }
    if (onCallback) onCallback(data);
  };

  const handleClose = () => {
    safeStorage.setItem('hasSeenTour', 'true');
    if (setRunTour) setRunTour(false);
    if (triggerHaptic) triggerHaptic(10);
    if (onCloseTour) onCloseTour();
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={runTour}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      callback={handleCallback}
      tooltipComponent={(props) => <CustomTourTooltip {...props} onCloseTour={handleClose} />}
      spotlightPadding={12}
      scrollOffset={100}
      floaterProps={{
        disableAnimation: true,
        styles: {
          floater: {
            filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
          },
          arrow: {
            length: 8,
            spread: 16,
          }
        }
      }}
      styles={{
        options: {
          zIndex: 1000,
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          arrowColor: '#121212',
        }
      }}
    />
  );
};
