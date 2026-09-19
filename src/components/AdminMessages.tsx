import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Mail, RefreshCw, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AdminMessagesProps {
  token: string;
}

export function AdminMessages({ token }: AdminMessagesProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMessages = async () => {
    if (!token) return;
    setMessagesLoading(true);
    try {
      const res = await fetch('/api/admin/messages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      setError("خطأ في جلب الرسائل");
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleUpdateMessageStatus = async (id: number, status: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/messages/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchMessages();
      }
    } catch (err) {
      setError("خطأ في تحديث حالة الرسالة");
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!token || !confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMessages();
      }
    } catch (err) {
      setError("خطأ في حذف الرسالة");
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [token]);

  return (
    <motion.div 
      key="messages"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <section className="glass-panel-heavy premium-border border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white mb-1">البريد الوارد</h2>
              <p className="text-sm text-slate-400">إدارة رسائل واستفسارات المستخدمين</p>
            </div>
          </div>
          <button
            onClick={fetchMessages}
            disabled={messagesLoading}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${messagesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-8">
          {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-xl mb-4">{error}</div>}
          
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>لا توجد رسائل واردة</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`p-6 rounded-2xl border transition-all ${msg.status === 'new' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-slate-700/50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${msg.status === 'new' ? 'bg-emerald-500 animate-pulse' : msg.status === 'replied' ? 'bg-blue-500' : 'bg-zinc-500'}`} />
                      <div>
                        <h3 className="font-bold text-white">{msg.email}</h3>
                        <p className="text-xs text-slate-400" dir="ltr">{msg.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar })}
                      </span>
                      <div className="h-4 w-px bg-white/10 mx-2"></div>
                      <select
                        value={msg.status}
                        onChange={(e) => handleUpdateMessageStatus(msg.id, e.target.value)}
                        className="bg-black/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="new">جديدة</option>
                        <option value="read">مقروءة</option>
                        <option value="replied">تم الرد</option>
                      </select>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="حذف الرسالة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {msg.message}
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <a 
                      href={`mailto:${msg.email}`}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      رد عبر الإيميل
                    </a>
                    <a 
                      href={`https://wa.me/${msg.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      رد عبر واتساب
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}
