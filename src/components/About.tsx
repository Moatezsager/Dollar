import React, { useEffect } from 'react';
import { ArrowRight, Info, Users, Smartphone, ShieldCheck, Globe, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface AboutProps {
  onBack: () => void;
}

export default function About({ onBack }: AboutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-zinc-400 hover:text-white"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Info className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold">عن المنصة</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 space-y-8">
        
        {/* Intro */}
        <section className="bg-[#111111] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black mb-2 text-white">مؤشر الدينار</h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                نحن فريق عمل ليبي شغوف بالتقنية والاقتصاد، لاحظنا الصعوبة اليومية التي يواجهها المواطن والتاجر في تتبع أسعار الصرف الحقيقية وسط فوضى وتعدد المصادر. من هنا انطلق "مؤشر الدينار" ليكون المنصة الأولى والأكثر استقراراً وموثوقية لعرض أسعار العملات والذهب في السوق الليبي.
              </p>
            </div>
          </div>
        </section>

        {/* How we work */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2 px-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            كيف نجمع الأسعار؟
          </h3>
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 sm:p-8">
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-6">
              عوضاً عن الاعتماد على مصدر واحد أو جهة معينة، يعتمد "مؤشر الدينار" على شبكة واسعة ومتصلة من المراسلين والمتعاملين الموثوقين في قلب السوق الموازي (في طرابلس، بنغازي، زليتن، وغيرها). 
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5">
                <ShieldCheck className="w-6 h-6 text-emerald-400 mb-3" />
                <h4 className="font-bold text-white mb-2">مقاطعة البيانات</h4>
                <p className="text-xs sm:text-sm text-zinc-500">يقوم فريقنا ومنظومتنا بمقاطعة الأسعار الواردة من مختلف المصادر على مدار الساعة لتقديم متوسط دقيق يعكس الواقع الفعلي للسوق، بعيداً عن الشائعات أو التلاعب.</p>
              </div>
              <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5">
                <Users className="w-6 h-6 text-blue-400 mb-3" />
                <h4 className="font-bold text-white mb-2">حيادية تامة</h4>
                <p className="text-xs sm:text-sm text-zinc-500">نحن جهة تقنية مستقلة؛ لا نبيع ولا نشتري ولا نتدخل في السوق بأي شكل. هدفنا الوحيد هو توفير المعلومة الصحيحة والشفافة للجميع في نفس الوقت.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2 px-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            منظومتنا وتطبيقاتنا
          </h3>
          <div className="space-y-3">
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 sm:p-6 flex items-start gap-4 hover:bg-[#151515] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-1 text-base sm:text-lg">منصة الويب (النسخة الحالية)</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">مصممة بأحدث التقنيات لتكون سريعة جداً وتعمل بكفاءة عالية حتى مع ضعف الإنترنت. توفر رسومات بيانية متقدمة، حاسبة عملات، وتحديثات لحظية دون الحاجة لتحديث الصفحة.</p>
              </div>
            </div>

            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 sm:p-6 flex items-start gap-4 hover:bg-[#151515] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-1 text-base sm:text-lg">تطبيق الهواتف الذكية (Android)</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">تطبيق خفيف وسريع صُمم ليكون رفيقك المالي اليومي. يتميز بخاصية الإشعارات الفورية (Push Notifications) لتنبيهك فوراً عند حدوث أي قفزة أو هبوط مفاجئ في الأسعار.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
