import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MessageSquare, Send, CheckCircle2, AlertCircle, ArrowRight, User } from 'lucide-react';

export const Contact = ({ onBack }: { onBack?: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', phone: '', message: '' });
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'حدث خطأ أثناء إرسال الرسالة');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('حدث خطأ في الاتصال بالخادم');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32 sm:py-16 sm:pb-16 space-y-6 sm:space-y-8"
    >
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span>العودة</span>
        </button>
      )}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
          <Mail className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gradient tracking-tight">
          اتصل بنا
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          نحن هنا لمساعدتك. أرسل لنا استفسارك وسنقوم بالرد عليك في أقرب وقت ممكن.
        </p>
      </div>

      <div className="glass-panel-heavy premium-border rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-xl shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-emerald-400 font-bold text-sm mb-1">سرعة الاستجابة</h3>
            <p className="text-emerald-400/80 text-xs leading-relaxed">
              نضمن لك الإجابة على استفساراتك عبر واتساب أو البريد الإلكتروني في أقل من 24 ساعة.
            </p>
          </div>
        </div>

        {status === 'success' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center space-y-4"
          >
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-gradient">تم الإرسال بنجاح!</h3>
            <p className="text-slate-400">شكراً لتواصلك معنا. سنتصل بك قريباً.</p>
            <button 
              onClick={() => setStatus('idle')}
              className="mt-6 px-6 py-2 glass-panel hover-lift rounded-xl text-white transition-colors"
            >
              إرسال رسالة أخرى
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            {status === 'error' && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                الاسم (اختياري)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="اسمك الكريم"
                className="w-full bg-[#0f172a]/40 border border-slate-700/50 rounded-2xl px-4 py-3.5 sm:py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-[#1e293b]/60 transition-all text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@domain.com"
                className="w-full bg-[#0f172a]/40 border border-slate-700/50 rounded-2xl px-4 py-3.5 sm:py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-[#1e293b]/60 transition-all text-base sm:text-sm text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                رقم الهاتف (واتساب)
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+218 9X XXX XXXX"
                className="w-full bg-[#0f172a]/40 border border-slate-700/50 rounded-2xl px-4 py-3.5 sm:py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-[#1e293b]/60 transition-all text-base sm:text-sm text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                الرسالة
              </label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="اكتب رسالتك أو استفسارك هنا..."
                rows={5}
                className="w-full bg-[#0f172a]/40 border border-slate-700/50 rounded-2xl px-4 py-3.5 sm:py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-[#1e293b]/60 transition-all text-base sm:text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {status === 'loading' ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  إرسال الرسالة
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
};
