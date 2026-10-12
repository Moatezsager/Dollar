import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, Compass, Play, RotateCcw, Video, X } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { TOUR_STEPS } from '../ui/AppTour';
import '../../styles/app-guide.css';

interface AppGuideProps {
  onClose: () => void;
  onTryConverter: () => void;
  onStartTour: (index?: number) => void;
}

const steps = [
  ['اختر العملة', 'حدد الدولار أو العملة التي تريد التحويل منها.'],
  ['أدخل المبلغ', 'اكتب المبلغ في خانة العملة الأجنبية.'],
  ['قارن النتيجة', 'ستظهر القيمة بالدينار حسب السوق الموازي والسعر الرسمي.'],
  ['حوّل من الدينار', 'أدخل القيمة في إحدى خانتي الدينار ليظهر ما يعادلها بالعملة المختارة.'],
];

export default function AppGuide({ onClose, onTryConverter, onStartTour }: AppGuideProps) {
  const dialogRef = useDialogAccessibility(true, onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'overview' | 'converter'>('overview');
  const variant = mobile ? 'mobile' : 'desktop';

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, [variant, view]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const pause = () => { if (document.hidden) videoRef.current?.pause(); };
    const media = window.matchMedia('(max-width: 767px)');
    const resize = () => { videoRef.current?.pause(); setMobile(media.matches); setStarted(false); setFailed(false); };
    document.addEventListener('visibilitychange', pause);
    media.addEventListener('change', resize);
    return () => {
      videoRef.current?.pause();
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('visibilitychange', pause);
      media.removeEventListener('change', resize);
    };
  }, []);

  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (failed) { setFailed(false); video.load(); }
    try { await video.play(); } catch { setFailed(true); }
  };

  const selectView = (next: 'overview' | 'converter') => {
    if (next === view) return;
    videoRef.current?.pause();
    setStarted(false);
    setFailed(false);
    setView(next);
  };

  const handleTabKey = (event: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'converter' : view === 'overview' ? 'converter' : 'overview';
    selectView(next);
    document.getElementById(`guide-tab-${next}`)?.focus();
  };

  return <div className="guide-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" tabIndex={-1} dir="rtl">
      <header className="guide-header">
        <img className="guide-logo" src="/logo.png" width="36" height="36" alt="مؤشر الدينار" />
        <h2 id="guide-title">الدليل الشامل للتطبيق</h2>
        <button className="guide-icon" onClick={onClose} aria-label="إغلاق الدليل" title="إغلاق الدليل"><X aria-hidden="true" /></button>
      </header>
      <div className="guide-tabs" role="tablist" aria-label="محتوى الدليل">
        {([
          ['overview', 'جولة تعريفية', Compass], ['converter', 'درس المحوّل', Video],
        ] as const).map(([id, label, Icon]) => <button key={id} id={`guide-tab-${id}`} role="tab"
          aria-selected={view === id} tabIndex={view === id ? 0 : -1} aria-controls={`guide-panel-${id}`}
          onClick={() => selectView(id)} onKeyDown={handleTabKey}>
          <Icon aria-hidden="true" />{label}
        </button>)}
      </div>
      <div className="guide-content" role="tabpanel" id={`guide-panel-${view}`} aria-labelledby={`guide-tab-${view}`}>
        {view === 'overview' ? <>
          <div className="guide-intro"><h3>تعرّف على أقسام المنصة</h3><p>ابدأ الجولة من البداية، أو اختر القسم الذي تريد التعرف عليه.</p></div>
          <ol className="guide-outline">{TOUR_STEPS.map((step, index) => {
            const Icon = step.data.Icon;
            return <li key={index}><button className="guide-topic" onClick={() => onStartTour(index)} aria-label={`استكشاف ${step.title}`}>
              <span className="guide-topic-icon"><Icon aria-hidden="true" /></span>
              <span className="guide-topic-copy"><strong>{step.title}</strong><small>{step.data.summary}</small></span>
              <ChevronLeft aria-hidden="true" className="guide-topic-arrow" />
            </button></li>;
          })}</ol>
        </> : <>
        <div className="guide-lesson-heading"><h3>محوّل العملات</h3><span>20 ثانية · مثال تدريبي</span></div>
        <div className="guide-lesson">
          <div className={`guide-media guide-media-${variant}`}>
            <video key={variant} ref={videoRef} controls={started} playsInline preload="none" tabIndex={0}
              poster={`/guide/converter-${variant}.jpg`} aria-label="درس استخدام محوّل العملات، بأرقام تدريبية"
              onPlay={() => { setStarted(true); setFailed(false); }} onError={() => { setStarted(false); setFailed(true); }}
              aria-describedby="guide-example-note">
              <source src={`/guide/converter-${variant}.mp4`} type="video/mp4" />
              <track kind="captions" src="/guide/converter-ar.vtt" srcLang="ar" label="العربية" />
            </video>
            {(!started || failed) && <div className="guide-play-layer">
              <button onClick={play} className="guide-play" aria-label={failed ? 'إعادة محاولة تشغيل الدرس' : 'تشغيل درس المحوّل'}>
                {failed ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}<span>{failed ? 'حاول مجددًا' : 'شاهد الدرس'}</span>
              </button>
            </div>}
          </div>
          <div className="guide-steps">
            <h4>خطوات التحويل</h4>
            <ol>{steps.map(([title, description], index) => <li key={title}>
              <span aria-hidden="true">{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div>
            </li>)}</ol>
            <p id="guide-example-note" className="guide-note">أرقام الدرس توضيحية فقط. المحوّل الفعلي يستخدم آخر الأسعار المتاحة في الموقع.</p>
            {failed && <p className="guide-error" role="status">تعذر تشغيل الفيديو. يمكنك متابعة الخطوات المكتوبة أو تجربة المحوّل مباشرة.</p>}
          </div>
        </div>
        </>}
      </div>
      <footer className="guide-footer">
        <span className="guide-footer-status">{view === 'overview' ? `${TOUR_STEPS.length} محطات · يمكنك إيقاف الجولة في أي وقت` : 'أرقام الفيديو توضيحية وليست أسعار اليوم'}</span>
        <button className="guide-primary" onClick={() => view === 'overview' ? onStartTour() : onTryConverter()}>
          {view === 'overview' ? 'ابدأ الجولة' : 'جرّب المحوّل'}<ArrowLeft aria-hidden="true" />
        </button>
      </footer>
    </div>
  </div>;
}
