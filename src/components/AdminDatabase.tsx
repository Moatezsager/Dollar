import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Database, RefreshCw, Save, X, Edit2, Trash2 } from 'lucide-react';

interface AdminDatabaseProps {
  token: string;
  config: any;
}

export function AdminDatabase({ token, config }: AdminDatabaseProps) {
  const [dbMarket, setDbMarket] = useState<'parallel' | 'official'>('parallel');
  const [dbCurrency, setDbCurrency] = useState<string>('USD');
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const fetchDbRecords = async () => {
    if (!token) return;
    setDbLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/admin/records/${dbMarket}/${dbCurrency}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDbRecords(data.records);
      } else {
        setError(data.message || "فشل جلب السجلات");
      }
    } catch (err) {
      setError("خطأ في الاتصال");
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchDbRecords();
  }, [dbMarket, dbCurrency, token]);

  const handleUpdateRecord = async (id: string) => {
    if (!token || !editValue) return;
    clearMessages();
    try {
      const res = await fetch(`/api/admin/records/${dbMarket}/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currency: dbCurrency, value: editValue })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("تم تحديث السجل بنجاح");
        setEditingRecord(null);
        fetchDbRecords();
      } else {
        setError(data.message || "فشل التحديث");
      }
    } catch (err) {
      setError("خطأ في الاتصال");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!token || !confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    clearMessages();
    try {
      const res = await fetch(`/api/admin/records/${dbMarket}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("تم حذف السجل بنجاح");
        fetchDbRecords();
      } else {
        setError(data.message || "فشل الحذف");
      }
    } catch (err) {
      setError("خطأ في الاتصال");
    }
  };

  return (
    <motion.div 
      key="database"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <section className="glass-panel-heavy premium-border border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="p-8 border-b border-slate-800/60 flex items-center gap-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Database className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">قاعدة البيانات</h2>
            <p className="text-slate-400">عرض وتعديل السجلات التاريخية للأسعار</p>
          </div>
        </div>

        <div className="p-8">
          {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-xl mb-6">{error}</div>}
          {success && <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl mb-6">{success}</div>}

          <div className="flex flex-col md:flex-row gap-4 mb-6 relative">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-2">السوق</label>
              <select
                value={dbMarket}
                onChange={(e) => setDbMarket(e.target.value as 'parallel' | 'official')}
                className="w-full bg-black/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="parallel">السوق الموازي</option>
                <option value="official">السوق الرسمي</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-2">العملة / الصنف</label>
              <select
                value={dbCurrency}
                onChange={(e) => setDbCurrency(e.target.value)}
                className="w-full bg-black/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {config?.terms?.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchDbRecords}
                disabled={dbLoading}
                className="h-[50px] px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${dbLoading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
            </div>
          </div>

          <div className="overflow-x-auto relative">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-6 py-4">التاريخ والوقت</th>
                  <th className="px-6 py-4">السعر</th>
                  <th className="px-6 py-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dbRecords.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Database className="w-10 h-10 text-zinc-800" />
                        <p className="text-zinc-600">لا توجد سجلات مسجلة حالياً لهذه العملة.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dbRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-white">
                            {new Date(record.recorded_at).toLocaleDateString('ar-LY')}
                          </span>
                          <span className="text-[10px] text-slate-500 pr-1">
                            {new Date(record.recorded_at).toLocaleTimeString('ar-LY')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingRecord === record.id ? (
                          <input
                            type="number"
                            step="0.001"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-32 bg-black border border-emerald-500/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                            autoFocus
                          />
                        ) : (
                          <span className="text-lg font-bold text-emerald-400">
                            {Number(record.value).toFixed(3)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {editingRecord === record.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateRecord(record.id)}
                                className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-colors"
                                title="حفظ"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingRecord(null)}
                                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-zinc-700 hover:text-white transition-colors"
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingRecord(record.id);
                                  setEditValue(record.value.toString());
                                }}
                                className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                                title="تعديل السعر"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record.id)}
                                className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                title="حذف السجل"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
