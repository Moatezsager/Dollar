import React, { useEffect } from 'react';
import { ArrowRight, ArrowUpLeft } from 'lucide-react';

type InformationPageId = 'about' | 'privacy' | 'terms' | 'contact';

export interface InformationPageProps {
  onBack: () => void;
  onNavigate: (page: InformationPageId) => void;
}

export function InformationPage({ title, page, onBack, onNavigate, children }: InformationPageProps & {
  title: string;
  page: InformationPageId;
  children: React.ReactNode;
}) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);
  return (
    <article className="content-page information-page" dir="rtl">
      <button className="information-back" onClick={onBack}><ArrowRight size={18} aria-hidden="true" /><span>العودة</span></button>
      <header className="information-header">
        <div><h1>{title}</h1><p>مؤشر الدينار · Dollar Price</p></div>
        <span>آخر مراجعة: <time dateTime="2026-10-08">8 أكتوبر 2026</time></span>
      </header>
      <nav aria-label="معلومات المنصة" className="information-nav">
        {[
          { id: 'about', label: 'عن المنصة' },
          { id: 'privacy', label: 'الخصوصية' },
          { id: 'terms', label: 'الاستخدام' },
        ].map(item => (
          <button key={item.id} aria-current={page === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id as InformationPageId)}>{item.label}</button>
        ))}
      </nav>
      <div className="information-body">{children}</div>
      <footer className="information-contact">
        <div><h2>لديك سؤال أو ملاحظة؟</h2><p>راسلنا إذا لاحظت خطأ في البيانات أو أردت الاستفسار عن هذه الصفحات.</p></div>
        <button onClick={() => onNavigate('contact')}>اتصل بنا<ArrowUpLeft size={18} aria-hidden="true" /></button>
      </footer>
    </article>
  );
}
