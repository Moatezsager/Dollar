import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, Mail, Send } from 'lucide-react';

export const Contact = ({ onBack }: { onBack?: () => void }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const submitting = useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const payload = Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, value.trim()]));
    if (!payload.email || !payload.phone || !payload.message || payload.message.length > 1000) {
      setStatus('error');
      setErrorMessage('أكمل بيانات التواصل واكتب رسالة لا تتجاوز 1000 حرف.');
      return;
    }
    submitting.current = true;
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new Error(typeof data?.error === 'string' ? data.error :
          response.status === 429 ? 'أرسلت عدة رسائل خلال وقت قصير. انتظر قليلًا قبل المحاولة مجددًا.' :
          'لم نتمكن من تأكيد إرسال الرسالة. بقي النص محفوظًا في هذه الصفحة.');
      }
      setFormData({ name: '', email: '', phone: '', message: '' });
      setStatus('success');
      requestAnimationFrame(() => successRef.current?.focus());
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error && error.name !== 'TypeError' ? error.message :
        'تعذر الاتصال. بقيت رسالتك في الصفحة؛ تحقق من اتصالك قبل المحاولة مجددًا.');
    } finally {
      submitting.current = false;
    }
  };

  return (
    <article className="content-page contact-page" dir="rtl">
      <style>{`
        .content-page.contact-page { max-width: 880px; padding: 28px 16px 160px; margin-inline: auto; color: var(--ink); }
        .contact-page button { min-height: 44px; border-radius: 8px; }
        .contact-back { display: inline-flex; align-items: center; gap: 8px; color: var(--muted-ink); margin-bottom: 24px; font-size: 14px; }
        .contact-header { padding-bottom: 24px; border-bottom: 1px solid var(--line); }
        .contact-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
        .contact-header p { color: var(--muted-ink); font-size: 15px; }
        .contact-layout { display: grid; gap: 32px; padding-top: 28px; }
        .contact-form { min-width: 0; }
        .contact-form fieldset { display: grid; gap: 20px; min-width: 0; }
        .contact-field label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .contact-field label span { color: var(--muted-ink); font-weight: 400; font-size: 12px; }
        .contact-page .contact-field :is(input, textarea) { display: block; width: 100%; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 12px; font-size: 16px; }
        .contact-field textarea { min-height: 160px; resize: vertical; line-height: 1.8; }
        .contact-field input:disabled, .contact-field textarea:disabled { opacity: .7; }
        .contact-field :is(input, textarea):focus-visible, .contact-page button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
        .contact-count { display: flex; justify-content: space-between; gap: 12px; color: var(--muted-ink); font-size: 12px; margin-top: 8px; }
        .contact-submit { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; width: 100%; background: var(--positive); color: var(--page); font-size: 15px; font-weight: 700; margin-top: 24px; }
        .contact-submit:disabled { cursor: wait; opacity: .7; }
        .contact-error { color: var(--negative); font-size: 14px; line-height: 1.8; padding: 12px 0; margin-bottom: 12px; border-bottom: 1px solid var(--line); }
        .contact-notes { color: var(--muted-ink); font-size: 14px; line-height: 1.9; }
        .contact-notes h2 { color: var(--ink); font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .contact-notes section + section { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line); }
        .contact-notes ul { list-style: disc; padding-inline-start: 20px; }
        .contact-notes li + li { margin-top: 8px; }
        .contact-success { padding: 24px 0; }
        .contact-success h2 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; }
        .contact-success p { color: var(--muted-ink); font-size: 15px; }
        .contact-success > svg { color: var(--positive); }
        .contact-success button { display: inline-flex; align-items: center; gap: 8px; margin-top: 24px; padding: 10px 16px; border: 1px solid var(--line); color: var(--positive); font-size: 14px; font-weight: 600; }
        @media (min-width: 768px) { .contact-layout { grid-template-columns: minmax(0, 1fr) 240px; gap: 40px; } .contact-page { padding-top: 40px; } }
      `}</style>
      {onBack && <button className="contact-back" onClick={onBack}><ArrowRight size={18} aria-hidden="true" />العودة</button>}
      <header className="contact-header">
        <h1>اتصل بنا</h1>
        <p>لديك ملاحظة على سعر، مشكلة في الموقع أو اقتراح؟ أرسلها لنا هنا.</p>
      </header>
      <div className="contact-layout">
        {status === 'success' ? (
          <section className="contact-success" role="status">
            <CheckCircle2 size={36} aria-hidden="true" />
            <h2 ref={successRef} tabIndex={-1}>تم الإرسال بنجاح!</h2>
            <p>وصلت رسالتك إلى المنصة. سنراجعها، وقد نتواصل معك عبر البيانات التي أرسلتها.</p>
            <button onClick={() => setStatus('idle')}><Mail size={18} aria-hidden="true" />إرسال رسالة أخرى</button>
          </section>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit} aria-busy={status === 'loading'}>
            {status === 'error' && <p className="contact-error" role="alert">{errorMessage}</p>}
            <fieldset disabled={status === 'loading'}>
              <div className="contact-field">
                <label htmlFor="contact-name">الاسم <span>(اختياري)</span></label>
                <input id="contact-name" name="name" aria-label="الاسم (اختياري)" autoComplete="name" maxLength={100} placeholder="اسمك الكريم"
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-email">البريد الإلكتروني</label>
                <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} dir="ltr" placeholder="name@example.com"
                  value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-phone">رقم الهاتف (واتساب)</label>
                <input id="contact-phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} dir="ltr" placeholder="09X XXX XXXX"
                  value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-message">الرسالة</label>
                <textarea id="contact-message" name="message" required maxLength={1000} rows={6} aria-describedby="contact-message-count" placeholder="اكتب رسالتك هنا..."
                  value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} />
                <div className="contact-count" id="contact-message-count"><span>الحد الأقصى 1000 حرف</span><span dir="ltr">{formData.message.length} / 1000</span></div>
              </div>
            </fieldset>
            <button className="contact-submit" type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              {status === 'loading' ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
            </button>
          </form>
        )}
        <aside className="contact-notes">
          <section><h2>حتى نفهم ملاحظتك</h2><ul>
            <li>عند الإبلاغ عن سعر، اذكر العملة والسوق ووقت الملاحظة.</li>
            <li>عند حدوث مشكلة، اذكر نوع الجهاز والمتصفح وما حدث.</li>
            <li>نراجع الاقتراحات والرسائل بحسب موضوعها؛ لا يوجد موعد رد مضمون.</li>
          </ul></section>
          <section><h2>بيانات التواصل</h2><p>نطلب البريد ورقم الهاتف للمتابعة عند الحاجة. قد تُحفظ الرسالة وتُحوّل إلى قناة الإدارة على Telegram. لا ترسل كلمات مرور أو بيانات بطاقات أو وثائق حساسة.</p></section>
          <section><h2>عن الأسعار</h2><p>المنصة تعرض معلومات للمقارنة، ولا تنفّذ بيعًا أو شراءً للعملات.</p></section>
        </aside>
      </div>
    </article>
  );
};
