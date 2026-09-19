import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function Privacy({ onBack }: { onBack: () => void }) {
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
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">سياسة الخصوصية</h1>
          <p className="text-zinc-400 mt-1">تحديث: سبتمبر 2026</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-3xl border border-white/5 p-6 md:p-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            حماية خصوصيتك
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            نحن في "مؤشر الدينار" نأخذ خصوصيتك على محمل الجد. هذه الصفحة توضح كيف نتعامل مع البيانات وما هي المعلومات التي قد نجمعها أثناء استخدامك للمنصة.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            البيانات التي نجمعها
          </h2>
          <ul className="list-disc list-inside text-zinc-400 leading-relaxed space-y-2">
            <li><strong>بيانات الاستخدام:</strong> نقوم بجمع إحصائيات عامة ومجهولة الهوية عن عدد الزوار النشطين لتحسين أداء الخوادم وضمان استقرار الخدمة.</li>
            <li><strong>بيانات الجهاز:</strong> قد نجمع معلومات تقنية عامة (مثل نوع المتصفح، أو نظام التشغيل) لتكييف واجهة المستخدم والتأكد من توافق المنصة.</li>
            <li><strong>الإشعارات (Push Notifications):</strong> إذا اشتركت في خدمة الإشعارات، فإننا نحتفظ برمز الاشتراك (Token) الخاص بجهازك لإرسال التنبيهات. لا نربط هذا الرمز بأي بيانات هوية شخصية.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            ما لا نجمعـــــــه
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            المنصة لا تتطلب إنشاء حساب، ولا نطلب أو نجمع أي بيانات شخصية مثل الأسماء، أرقام الهواتف، أو عناوين البريد الإلكتروني (إلا في حال قمت بمراسلتنا طوعياً عبر صفحة اتصل بنا).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            مشاركة البيانات
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            نحن لا نبيع، نؤجر، أو نشارك أي بيانات متعلقة باستخدامك للمنصة مع أي أطراف ثالثة لأغراض تسويقية أو إعلانية.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            ملفات الارتباط (Cookies)
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            نستخدم تقنيات التخزين المحلي (Local Storage) البسيطة في متصفحك لحفظ تفضيلاتك (مثل إعدادات المظهر المضغوط، وتفعيل الاهتزاز) حتى لا تضطر لإعادة ضبطها في كل مرة تزور فيها المنصة.
          </p>
        </section>
      </div>
    </motion.div>
  );
}
