import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Code2, Copy, ArrowRight, CheckCircle2, Terminal, Server, Shield, Zap } from 'lucide-react';

export const Developers = ({ onBack }: { onBack?: () => void }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const codeExamples = {
    curl: `curl -X GET "https://dollar-price-qp14.onrender.com/api/public/rates" \\
  -H "Accept: application/json"`,
    js: `fetch("https://dollar-price-qp14.onrender.com/api/public/rates")
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    python: `import requests

url = "https://dollar-price-qp14.onrender.com/api/public/rates"
response = requests.get(url)

if response.status_code == 200:
    print(response.json())
else:
    print("Error:", response.status_code)`,
    php: `<?php
$url = "https://dollar-price-qp14.onrender.com/api/public/rates";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
print_r($data);
?>`
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-12"
    >
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span>العودة</span>
        </button>
      )}
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-4">
          <Code2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">بوابة المطورين</h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          وفرنا لك واجهة برمجية (API) مجانية وبسيطة جداً للحصول على أسعار الدولار واليورو (كاش) في السوق الموازي، لتتمكن من عرضها في موقعك أو تطبيقك بكل سهولة.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <div className="p-3 bg-blue-500/10 rounded-xl w-fit mb-4">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">سريع ومجاني</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            وصول مجاني لأسعار الدولار واليورو (كاش) في السوق الموازي مع تحديثات مستمرة.
          </p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <div className="p-3 bg-emerald-500/10 rounded-xl w-fit mb-4">
            <Server className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">استقرار عالي</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            خوادم مستقرة مع نظام تخزين مؤقت (Caching) لضمان توفر الخدمة 99.9%.
          </p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl border-emerald-500/20">
          <div className="p-3 bg-rose-500/10 rounded-xl w-fit mb-4">
            <Shield className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">سهولة الاستخدام</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            بيانات بتنسيق JSON بسيط وواضح، جاهزة للاستخدام المباشر في أي تطبيق أو موقع إلكتروني.
          </p>
        </div>
      </div>

      {/* Endpoint Info */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-white/5">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Terminal className="w-6 h-6 text-emerald-400" />
            نقطة الوصول (Endpoint)
          </h2>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-black/50 p-4 rounded-2xl border border-white/5">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded-lg text-sm w-fit">GET</span>
            <code className="flex-1 text-zinc-300 font-mono text-sm sm:text-base text-left" dir="ltr">
              https://dollar-price-qp14.onrender.com/api/public/rates
            </code>
            <button 
              onClick={() => handleCopy(`https://dollar-price-qp14.onrender.com/api/public/rates`, 'endpoint')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-300 transition-colors"
            >
              {copiedId === 'endpoint' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-sm font-medium">{copiedId === 'endpoint' ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>
        </div>

        {/* Code Examples */}
        <div className="p-6 sm:p-8 bg-black/20">
          <h3 className="text-lg font-bold text-white mb-6">أمثلة برمجية</h3>
          
          <div className="space-y-8">
            {/* cURL */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-400">cURL</span>
                <button 
                  onClick={() => handleCopy(codeExamples.curl, 'curl')}
                  className="text-xs flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                >
                  {copiedId === 'curl' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  نسخ الكود
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 overflow-x-auto" dir="ltr">
                <pre className="text-sm text-emerald-300 font-mono"><code>{codeExamples.curl}</code></pre>
              </div>
            </div>

            {/* JavaScript */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-400">JavaScript (Fetch)</span>
                <button 
                  onClick={() => handleCopy(codeExamples.js, 'js')}
                  className="text-xs flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                >
                  {copiedId === 'js' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  نسخ الكود
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 overflow-x-auto" dir="ltr">
                <pre className="text-sm text-blue-300 font-mono"><code>{codeExamples.js}</code></pre>
              </div>
            </div>

            {/* Python */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-400">Python (Requests)</span>
                <button 
                  onClick={() => handleCopy(codeExamples.python, 'python')}
                  className="text-xs flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                >
                  {copiedId === 'python' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  نسخ الكود
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 overflow-x-auto" dir="ltr">
                <pre className="text-sm text-yellow-300 font-mono"><code>{codeExamples.python}</code></pre>
              </div>
            </div>

            {/* PHP */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-400">PHP (cURL)</span>
                <button 
                  onClick={() => handleCopy(codeExamples.php, 'php')}
                  className="text-xs flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                >
                  {copiedId === 'php' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  نسخ الكود
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 overflow-x-auto" dir="ltr">
                <pre className="text-sm text-purple-300 font-mono"><code>{codeExamples.php}</code></pre>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      {/* Premium API Notice */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6 sm:p-8 rounded-3xl text-center">
        <h3 className="text-xl font-bold text-amber-400 mb-3">هل تحتاج إلى جميع الأسعار والعمولات؟</h3>
        <p className="text-zinc-300 mb-6 max-w-2xl mx-auto">
          النسخة المجانية توفر أسعار الدولار واليورو فقط. للحصول على جميع الأسعار، العمولات، وأسعار الصكوك، يمكنك الاشتراك في النسخة المدفوعة (Premium API).
        </p>
        <button 
          onClick={() => window.open('https://t.me/moatezsager', '_blank')}
          className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-colors"
        >
          تواصل معنا للاشتراك
        </button>
      </div>
    </motion.div>
  );
};
