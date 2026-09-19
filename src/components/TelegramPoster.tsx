import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

export const TelegramPoster = ({ token }: { token: string }) => {
  const [channel, setChannel] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerateMarketView = async () => {
    setError(null);
    setSuccess(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/admin/telegram/generate-analysis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage(data.message);
        setSuccess('تم توليد رؤية السوق بنجاح. يمكنك المراجعة والتعديل قبل النشر.');
      } else {
        setError(data.error || 'حدث خطأ أثناء توليد التحليل');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!channel || !message) {
      setError('يرجى تحديد القناة وكتابة الرسالة');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/telegram/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ channel, message })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess('تم نشر الرسالة بنجاح!');
        setMessage(''); // Clear message after sending
      } else {
        setError(data.error || 'حدث خطأ أثناء إرسال الرسالة');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <MessageSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">النشر في تيليجرام</h2>
          <p className="text-xs text-zinc-400 mt-1">نشر رسالة جديدة مباشرة في القنوات</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">معرف القناة (بدون @)</label>
          <input
            type="text"
            placeholder="مثال: libya_rates"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
            dir="ltr"
          />
        </div>

        <div>
           <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-zinc-300">محتوى الرسالة</label>
            <button
              onClick={handleGenerateMarketView}
              disabled={isGenerating}
              className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'جاري التوليد...' : 'ذكاء اصطناعي لرؤية السوق'}
            </button>
          </div>
          <textarea
            rows={5}
            placeholder="اكتب رسالتك هنا..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-y leading-relaxed"
            dir="rtl"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-400 leading-relaxed">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-400 leading-relaxed">{success}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={isSending || !channel || !message}
          className="w-full py-3 px-4 bg-gradient-to-l from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>إرسال الآن</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
        <button
          onClick={async () => {
            if (!channel) {
              setError('يرجى تحديد القناة');
              return;
            }
            setError(null);
            setSuccess(null);
            try {
              const response = await fetch('/api/admin/telegram/official-broadcast', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ channel })
              });
              const data = await response.json();
              if (response.ok && data.success) {
                setSuccess('تم إرسال أسعار المصرف المركزي بنجاح!');
              } else {
                setError(data.error || 'حدث خطأ أثناء إرسال أسعار المصرف المركزي');
              }
            } catch (err: any) {
              setError(err.message || 'حدث خطأ في الاتصال بالخادم');
            }
          }}
          className="w-full py-3 px-4 bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg mt-3"
        >
          <span>نشر أسعار المركزي</span>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
