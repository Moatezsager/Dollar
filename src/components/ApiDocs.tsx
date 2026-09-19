import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Code2, Zap, Lock, Database, ArrowRight, Terminal, Server, Globe, ShieldCheck, Cpu, Braces } from 'lucide-react';

interface ApiDocsProps {
  onBack: () => void;
}

export const ApiDocs: React.FC<ApiDocsProps> = ({ onBack }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [codeLang, setCodeLang] = useState<'js' | 'py' | 'curl'>('js');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const snippets = {
    js: `// جلب أسعار الدولار واليورو اللحظية (مجاني)
fetch('https://dollar-price-qp14.onrender.com/api/public/rates')
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      console.log('سعر الدولار كاش:', result.data.USD);
      console.log('سعر اليورو:', result.data.EUR);
      console.log('سعر الجنيه الإسترليني:', result.data.GBP);
      console.log('آخر تحديث:', result.lastUpdated);
    }
  })
  .catch(error => console.error('خطأ في الاتصال:', error));`,
    py: `# جلب أسعار الدولار واليورو اللحظية (مجاني)
import requests

url = 'https://dollar-price-qp14.onrender.com/api/public/rates'
try:
    response = requests.get(url)
    result = response.json()
    
    if result.get('success'):
        print('سعر الدولار كاش:', result['data']['USD'])
        print('سعر اليورو:', result['data']['EUR'])
        print('سعر الجنيه الإسترليني:', result['data']['GBP'])
        print('آخر تحديث:', result['lastUpdated'])
except Exception as e:
    print('خطأ في الاتصال:', e)`,
    curl: `# جلب أسعار الدولار واليورو اللحظية (مجاني)
curl -X GET "https://dollar-price-qp14.onrender.com/api/public/rates" \\
  -H "Accept: application/json"`
  };

  const supportedTechs = [
    "Node.js", "Python", "PHP", "Laravel", "React", "Flutter", "Swift", "Go", "Java", "C#"
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16"
      dir="rtl"
    >
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
        
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm font-medium bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full w-fit border border-white/5"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </button>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide uppercase mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              RESTful API
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6 leading-tight">
              بوابة المطورين <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-400 to-cyan-400">
                لأسعار الصرف اللحظية
              </span>
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-8">
              واجهة برمجية (API) احترافية وموثوقة لربط تطبيقاتك ومواقعك بأسعار الصرف في السوق الموازي والرسمي. تكامل سلس وسريع لضمان أفضل تجربة للمستخدم.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-zinc-300 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>حماية عالية</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-300 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>استجابة سريعة</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-300 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                <Server className="w-4 h-4 text-blue-400" />
                <span>استقرار 99.9%</span>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex relative w-72 h-72 items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="relative z-10 w-48 h-48 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <Braces className="w-20 h-20 text-emerald-400/80" />
            </div>
            <div className="absolute top-10 -right-4 z-20 w-16 h-16 bg-[#111] border border-white/10 rounded-2xl shadow-xl flex items-center justify-center transform -rotate-12 animate-bounce" style={{ animationDuration: '3s' }}>
              <Terminal className="w-8 h-8 text-blue-400" />
            </div>
            <div className="absolute bottom-10 -left-4 z-20 w-16 h-16 bg-[#111] border border-white/10 rounded-2xl shadow-xl flex items-center justify-center transform rotate-12 animate-bounce" style={{ animationDuration: '4s' }}>
              <Globe className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Supported Languages */}
      <div className="border-y border-white/5 py-8">
        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">متوافق مع جميع لغات البرمجة وإطارات العمل</h3>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {supportedTechs.map((tech) => (
            <div key={tech} className="px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-zinc-300 text-sm font-medium hover:bg-white/[0.05] hover:border-white/10 transition-colors cursor-default">
              {tech}
            </div>
          ))}
          <div className="px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-zinc-500 text-sm font-medium">
            وغيرها الكثير...
          </div>
        </div>
      </div>

      {/* Pricing / Tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Free Tier */}
        <div className="relative rounded-3xl bg-[#0a0a0a] border border-white/10 p-6 sm:p-8 overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 shadow-lg hover:shadow-emerald-500/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">الباقة المجانية</h2>
                  <p className="text-sm text-emerald-400 font-medium mt-1">مفتوحة ومتاحة للجميع</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-2xl font-black text-white">مجاناً</span>
              </div>
            </div>
            
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              وصول مجاني لأسعار الدولار (USD)، اليورو (EUR)، والجنيه الإسترليني (GBP) اللحظية في السوق الموازي. مثالية للمشاريع الناشئة والتطبيقات الشخصية.
            </p>

            <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden mb-8">
              <div className="flex items-center justify-between px-2 py-2 border-b border-white/5 bg-white/[0.02] overflow-x-auto hide-scrollbar">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCodeLang('js')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${codeLang === 'js' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    JavaScript
                  </button>
                  <button 
                    onClick={() => setCodeLang('py')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${codeLang === 'py' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Python
                  </button>
                  <button 
                    onClick={() => setCodeLang('curl')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${codeLang === 'curl' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    cURL
                  </button>
                </div>
                <button 
                  onClick={() => handleCopy(snippets[codeLang], 'free')}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors shrink-0 mr-2"
                  title="نسخ الكود"
                >
                  {copiedId === 'free' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-5 overflow-x-auto" dir="ltr">
                <AnimatePresence mode="wait">
                  <motion.pre 
                    key={codeLang}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-mono text-zinc-300 leading-relaxed"
                  >
                    <code>{snippets[codeLang]}</code>
                  </motion.pre>
                </AnimatePresence>
              </div>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span>سعر الدولار واليورو (بيع وشراء) في السوق الموازي</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span>تحديثات مستمرة للأسعار</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span>لا يتطلب تسجيل دخول أو مفتاح API</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Paid Tier */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-amber-500/20 p-6 sm:p-8 overflow-hidden group hover:border-amber-500/40 transition-all duration-500 shadow-[0_0_40px_rgba(245,158,11,0.05)] hover:shadow-[0_0_40px_rgba(245,158,11,0.1)]">
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -ml-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 p-[1px]">
                  <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">الباقة الاحترافية</h2>
                  <p className="text-sm text-amber-400 font-medium mt-1">للمؤسسات والشركات</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-zinc-400 line-through mr-2"></span>
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">مدفوعة</span>
              </div>
            </div>
            
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              وصول شامل لجميع بيانات المنصة. مصممة لتلبية احتياجات الأعمال المتقدمة، المتاجر الإلكترونية، والتطبيقات المالية التي تتطلب دقة وتفاصيل متكاملة.
            </p>

            <div className="bg-[#111]/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6 mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
              
              <div className="relative z-10 flex flex-col items-center justify-center text-center py-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
                  <Lock className="w-8 h-8 text-amber-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">كود الربط محمي</h4>
                <p className="text-sm text-zinc-400 max-w-[250px]">
                  يتم توفير مفاتيح الربط (API Keys) والتوثيق الكامل للعملاء المشتركين فقط لضمان جودة الخدمة.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h4 className="text-sm font-bold text-white mb-4">المميزات الحصرية:</h4>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-amber-400" />
                </div>
                <span>جميع العملات الأجنبية (دولار، يورو، باوند، دينار تونسي، الخ)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-amber-400" />
                </div>
                <span>أسعار الصكوك لجميع المصارف (التجارة، الوحدة، الجمهورية...)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-amber-400" />
                </div>
                <span>أسعار الحوالات الدولية (دبي، تركيا، الصين)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-amber-400" />
                </div>
                <span>أسعار السوق الرسمي (مصرف ليبيا المركزي)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-300">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-amber-400" />
                </div>
                <span>دعم فني مخصص وأولوية في الاستجابة (SLA)</span>
              </li>
            </div>

            <button className="w-full py-4 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-base font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2 transform hover:-translate-y-1">
              <Lock className="w-5 h-5" />
              طلب الاشتراك (تواصل معنا)
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
