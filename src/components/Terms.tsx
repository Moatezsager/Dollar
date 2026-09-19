import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function Terms({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-32"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8"
      >
        <ArrowRight className="w-5 h-5" />
        <span>العودة</span>
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">سياسة الاستخدام</h1>
          <p className="text-zinc-400 mt-1">تحديث: سبتمبر 2026</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-3xl border border-white/5 p-6 md:p-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            مقدمة
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            مرحباً بك في منصة "مؤشر الدينار". باستخدامك لهذه المنصة، فإنك توافق على الامتثال والالتزام بشروط وأحكام الاستخدام التالية التي تحكم علاقة المنصة معك.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            طبيعة المعلومات والبيانات
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            الأسعار المعروضة في التطبيق هي عبارة عن أسعار استرشادية تقريبية مبنية على متوسط السوق لحظة الإصدار. لا تتحمل المنصة أو فريق التطوير أي مسؤولية عن أية قرارات مالية، استثمارية، أو تجارية يتم اتخاذها بناءً على هذه البيانات. الأسعار قد تتغير بسرعة وحسب المنطقة.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            إخلاء المسؤولية
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            "مؤشر الدينار" منصة معلوماتية بحتة، ولا تمثل أي جهة حكومية أو رسمية (باستثناء عرضها لبيانات مصرف ليبيا المركزي ضمن قسم السوق الرسمي كمصدر معلن). استخدامك للمنصة يكون على مسؤوليتك الشخصية بالكامل.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            حقوق الملكية الفكرية
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            كافة حقوق التصميم، البرمجيات، الواجهات، وآليات العرض مملوكة لمنصة "مؤشر الدينار" وفريق التطوير (GreenBox). يمنع نسخ أو إعادة نشر أي جزء من المنصة أو بياناتها لأغراض تجارية دون إذن مسبق.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            الاستخدام المقبول
          </h2>
          <ul className="list-disc list-inside text-zinc-400 leading-relaxed space-y-2">
            <li>يمنع استخدام المنصة لأي أغراض غير قانونية.</li>
            <li>يمنع محاولة اختراق أو تعطيل البنية التحتية للمنصة أو واجهات برمجة التطبيقات (API).</li>
            <li>يحق لنا حظر أي عنوان IP يتسبب في ضغط غير مبرر على خوادم المنصة (مثل هجمات DDoS أو السكرابينغ المكثف).</li>
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
