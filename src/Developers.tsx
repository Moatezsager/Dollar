import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Copy, ExternalLink, Play, Code2 } from 'lucide-react';
import { PUBLIC_RATES_PATH, PUBLIC_RATES_URL } from '../shared/developerApi';
import './styles/developer-api.css';

export const Developers = ({ onBack, onContact }: { onBack?: () => void; onContact?: () => void }) => {
  const endpoint = PUBLIC_RATES_URL;
  const [language, setLanguage] = useState<'JavaScript' | 'Python' | 'cURL'>('JavaScript');
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('لم يُرسل طلب بعد');
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  const examples = {
    JavaScript: `const response = await fetch(${JSON.stringify(endpoint)}, {
  cache: 'no-store',
  signal: AbortSignal.timeout(8000)
});
const result = await response.json();
if (!response.ok || !result.success || result.stale) {
  throw new Error(result.error || 'Rates unavailable');
}
console.log(result.data.USD, result.data.EUR);
console.log(result.lastUpdated);`,
    Python: `import requests

response = requests.get(
    ${JSON.stringify(endpoint)},
    headers={"User-Agent": "MyRatesApp/1.0"},
    timeout=8
)
response.raise_for_status()
result = response.json()
if not result["success"] or result["stale"]:
    raise ValueError("Rates unavailable")
print(result["data"]["USD"], result["data"]["EUR"])`,
    cURL: `curl --fail-with-body --max-time 8 \\\n  -H "Accept: application/json" \\\n  -H "User-Agent: MyRatesApp/1.0" \\\n  "${endpoint}"`,
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setFeedback('تم النسخ'); }
    catch { setFeedback('تعذر النسخ. يمكنك تحديد النص ونسخه يدويًا.'); }
  };
  const test = async () => {
    if (request.current) return;
    if (Date.now() < retryAt) { setFeedback('انتظر انتهاء مهلة إعادة المحاولة.'); return; }
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setBusy(true); setFeedback('');
    try {
      const response = await fetch(PUBLIC_RATES_PATH, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      setStatus(`HTTP ${response.status}`);
      setResult(JSON.stringify(data, null, 2));
      const retry = Number(response.headers.get('Retry-After'));
      setRetryAt(Date.now() + Math.max(60, Number.isFinite(retry) ? retry : 60) * 1000);
      if (!response.ok) setFeedback('الخدمة أعادت خطأ؛ راجع الحالة والتفاصيل أدناه قبل استخدام الأسعار.');
    } catch {
      if (request.current) { setStatus('تعذر إكمال الطلب'); setResult(''); setFeedback('تعذر الاتصال أو انتهت المهلة. أعد المحاولة لاحقًا.'); }
    } finally { clearTimeout(timeout); if (request.current) { request.current = null; setBusy(false); } }
  };
  return <article className="content-page developer-api" dir="rtl">
    {onBack && <button className="api-action" onClick={onBack}><ArrowRight size={18} aria-hidden="true" />العودة</button>}
    <header className="api-heading"><img src="/logo.png" alt="" width="48" height="48" /><div><h1>بوابة المطورين</h1><p>مؤشر الدينار · أسعار الدولار واليورو عبر API</p></div></header>
    <p className="api-lead">أحدث سعر متاح للدولار النقدي واليورو في السوق الموازي، بالدينار الليبي لكل وحدة. رابط مجاني بصيغة JSON، دون تسجيل أو مفتاح وصول.</p>
    <section aria-labelledby="api-endpoint-title">
      <h2 id="api-endpoint-title">رابط الأسعار</h2>
      <div className="api-endpoint" dir="ltr"><strong>GET</strong><code>{endpoint}</code><button onClick={() => copy(endpoint)} title="نسخ الرابط" aria-label="نسخ الرابط"><Copy size={18} /></button><a href={endpoint} target="_blank" rel="noopener noreferrer" title="فتح الرابط" aria-label="فتح رابط API"><ExternalLink size={18} /></a></div>
      <p>يُحدَّث الرد عند وصول البيانات إلى المنصة. هذا طلب HTTP لآخر سعر محفوظ، وليس بثًا مستمرًا أو ضمانًا لوصول كل تغيّر فور حدوثه في السوق.</p>
    </section>
    <div className="api-columns">
      <section aria-labelledby="api-code-title"><h2 id="api-code-title"><Code2 size={20} aria-hidden="true" />ابدأ الربط</h2>
        <div className="api-toolbar"><div role="group" aria-label="لغة المثال">{(['JavaScript', 'Python', 'cURL'] as const).map(item => <button key={item} aria-pressed={language === item} onClick={() => setLanguage(item)}>{item}</button>)}</div><button title="نسخ المثال" aria-label="نسخ المثال" onClick={() => copy(examples[language])}><Copy size={18} /></button></div>
        <pre dir="ltr" tabIndex={0}><code>{examples[language]}</code></pre>
        <p>من السيرفر أرسل <code dir="ltr">User-Agent: MyRatesApp/1.0</code>. المتصفح يرسل ترويسة التعريف تلقائيًا. لا تضع مفاتيح داخل الرابط.</p>
      </section>
      <section aria-labelledby="api-test-title"><h2 id="api-test-title">جرّب الاستجابة</h2>
        <div className="api-toolbar"><span dir="ltr">{status}</span><button className="api-primary" disabled={busy} onClick={test}><Play size={16} aria-hidden="true" />{busy ? 'جارٍ الطلب…' : 'إرسال طلب'}</button></div>
        <pre dir="ltr" tabIndex={0} aria-label="استجابة API">{result || '// Send a request to see the actual response.'}</pre>
        <p>التجربة ترسل طلبًا واحدًا عند الضغط، وتُحتسب ضمن حصتك.</p>
      </section>
    </div>
    <p className="api-feedback" role="status">{feedback}</p>
    <section><h2>قراءة البيانات</h2><dl className="api-fields">
      {[
        ['data.USD / data.EUR', 'سعر وحدة واحدة من العملة بالدينار الليبي. لا يشمل الرسمي أو الصكوك أو العمولات.'],
        ['lastUpdated', 'وقت أحدث سجل محفوظ للسوق الموازي بصيغة ISO 8601 وبتوقيت UTC؛ ليس وقت إرسال الطلب.'],
        ['lastChanged', 'آخر تغير معروف لسعر كل عملة؛ null يعني أن وقت التغير غير متاح. ثبات السعر لا يعني تعطل الخدمة.'],
        ['success / stale', 'استخدم الأسعار عندما success = true وstale = false. البيانات الأقدم من 12 ساعة تُعاد مع تحذير وحالة 503.'],
      ].map(([key, label]) => <div key={key}><dt dir="ltr">{key}</dt><dd>{label}</dd></div>)}
    </dl></section>
    <div className="api-columns"><section><h2>حدود الاستخدام</h2><p>الحصة المجانية الافتراضية 5 طلبات في الدقيقة لكل عنوان IP، وقد تُخفض أو تُمدد فترة الانتظار. الحد الفعلي يظهر في ترويسات <code>RateLimit-Limit</code> و<code>RateLimit-Remaining</code> و<code>RateLimit-Reset</code>.</p><p>ننصح بالجلب مرة كل خمس دقائق من سيرفر تطبيقك ومشاركة النتيجة بين مستخدميه، بدل إرسال طلب لكل زائر. عند ظهور 429، انتظر مدة <code>Retry-After</code>. لا تضف محاولات متوازية أو إعادة طلب مستمرة.</p></section>
    <section><h2>حالات الاستجابة</h2><dl className="api-fields">{[['200', 'الأسعار متاحة.'], ['403', 'طلب مرفوض؛ تحقق من User-Agent وسياسات الوصول.'], ['405', 'الطريقة غير مدعومة؛ استخدم GET.'], ['429', 'تجاوز حد الطلبات؛ احترم Retry-After.'], ['503', 'الخدمة معطلة مؤقتًا، أو البيانات ناقصة أو قديمة، أو السعة ممتلئة.']].map(([code, description]) => <div key={code}><dt>{code}</dt><dd>{description}</dd></div>)}</dl></section></div>
    <section aria-labelledby="api-subscription-title"><h2 id="api-subscription-title">تحتاج إلى جميع الأسعار؟</h2><p>يمكنك طلب اشتراك API مدفوع للوصول إلى جميع الأسعار المتاحة على المنصة. تواصل معنا واذكر اسم تطبيقك، والأسعار المطلوبة، ومعدل التحديث المتوقع؛ نحدد معك التغطية وحصة الطلبات وتفاصيل الاشتراك قبل التفعيل.</p><p>الاشتراك المدفوع يخضع لحصة متفق عليها، ولا يتيح طلبات غير محدودة.</p>{onContact ? <button className="api-primary" onClick={onContact}>اتصل بنا لطلب الاشتراك<ArrowRight size={18} aria-hidden="true" /></button> : <a className="api-primary api-action" href="https://t.me/moatezsager" target="_blank" rel="noopener noreferrer">تواصل لطلب الاشتراك</a>}</section>
    <footer><p>الأسعار مرجع معلوماتي وليست عرض بيع أو شراء. عند تعذر الخدمة، وضّح لمستخدميك أن آخر سعر محفوظ قديم، ولا تعرضه كأنه سعر جديد.</p></footer>
  </article>;
};
