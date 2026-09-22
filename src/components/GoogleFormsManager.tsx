import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Copy, 
  Check, 
  LogOut, 
  BarChart3, 
  Calendar, 
  MessageSquare, 
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  HelpCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  signInWithGoogleWorkspace, 
  googleLogout, 
  getGoogleAccessToken, 
  initGoogleAuth 
} from '../lib/googleAuth';
import { 
  listUserGoogleForms, 
  getGoogleFormDetails, 
  getGoogleFormResponses, 
  createGoogleForm,
  GoogleDriveFormItem,
  GoogleFormDetails,
  GoogleFormResponsesResult
} from '../services/googleForms';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface GoogleFormsManagerProps {
  token?: string;
  setError?: (msg: string) => void;
  setSuccess?: (msg: string) => void;
}

export function GoogleFormsManager({ token: _adminToken }: GoogleFormsManagerProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Forms state
  const [formsList, setFormsList] = useState<GoogleDriveFormItem[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedForm, setSelectedForm] = useState<GoogleFormDetails | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponsesResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Create Modal & Confirmation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('استطلاع توقعات أسعار الدولار والذهب');
  const [newFormDescription, setNewFormDescription] = useState('شاركنا رأيك حول اتجاه أسعار العملات في السوق الموازي للأيام القادمة.');
  const [selectedTemplate, setSelectedTemplate] = useState<'rates_forecast' | 'app_feedback' | 'custom'>('rates_forecast');
  const [creatingForm, setCreatingForm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; onConfirm: () => void } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setLoadingAuth(false);
        fetchForms(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogleWorkspace();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        showNotification('success', `تم تسجيل الدخول بنجاح بحساب ${result.user.email}`);
        fetchForms(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      showNotification('error', err.message || 'فشل تسجيل الدخول باستخدام Google');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setCurrentUser(null);
    setAccessToken(null);
    setFormsList([]);
    setSelectedForm(null);
    setFormResponses(null);
    showNotification('success', 'تم تسجيل الخروج بنجاح.');
  };

  const fetchForms = async (tokenOverride?: string) => {
    const token = tokenOverride || accessToken || getGoogleAccessToken();
    if (!token) return;
    setLoadingForms(true);
    try {
      const forms = await listUserGoogleForms(token);
      setFormsList(forms);
    } catch (err: any) {
      console.error('Error fetching forms:', err);
      showNotification('error', err.message || 'فشل جلب قائمة النماذج من Google Drive');
    } finally {
      setLoadingForms(false);
    }
  };

  const handleSelectForm = async (formItem: GoogleDriveFormItem) => {
    const token = accessToken || getGoogleAccessToken();
    if (!token) return;
    setLoadingDetails(true);
    setSelectedForm(null);
    setFormResponses(null);
    try {
      const [details, responses] = await Promise.all([
        getGoogleFormDetails(formItem.id, token),
        getGoogleFormResponses(formItem.id, token).catch(() => ({ responses: [] }))
      ]);
      setSelectedForm(details);
      setFormResponses(responses);
    } catch (err: any) {
      console.error('Error fetching form details:', err);
      showNotification('error', err.message || 'فشل تحميل تفاصيل النموذج.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleConfirmCreateForm = () => {
    setConfirmDialog({
      isOpen: true,
      title: `إنشاء نموذج Google Forms جديد بعنوان "${newFormTitle}"؟`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await executeCreateForm();
      }
    });
  };

  const executeCreateForm = async () => {
    const token = accessToken || getGoogleAccessToken();
    if (!token) {
      showNotification('error', 'يرجى تسجيل الدخول أولاً');
      return;
    }

    setCreatingForm(true);
    try {
      let questions: any[] = [];
      if (selectedTemplate === 'rates_forecast') {
        questions = [
          {
            title: 'ما هي توقعاتك لاتجاه سعر صرف الدولار مقابل الدينار خلال الأيام القادمة؟',
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: 'ارتفاع (صعود مستمر)' },
                    { value: 'استقرار نسبي' },
                    { value: 'انخفاض وتراجع في السعر' }
                  ]
                }
              }
            }
          },
          {
            title: 'ما هو النطاق السعري المتوقع للدولار كاش (مثال: 6.80 - 7.00)؟',
            questionItem: {
              question: {
                required: false,
                textQuestion: { paragraph: false }
              }
            }
          },
          {
            title: 'ما هي المدينة / السوق الرئيسي الذي تتابعه؟',
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: 'طرابلس (سوق المشير / الدهماني)' },
                    { value: 'بنغازي (سوق الفندق / الصابري)' },
                    { value: 'مصراتة' },
                    { value: 'مدينة أخرى' }
                  ]
                }
              }
            }
          },
          {
            title: 'أي ملاحظات أو تحليل إضافي حول حركة السوق والذهب؟',
            questionItem: {
              question: {
                required: false,
                textQuestion: { paragraph: true }
              }
            }
          }
        ];
      } else if (selectedTemplate === 'app_feedback') {
        questions = [
          {
            title: 'ما مدى رضاك عن سرعة ودقة تحديث أسعار العملات في الموقع؟',
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: 'ممتازة ودقيقة جداً' },
                    { value: 'جيدة' },
                    { value: 'تحتاج إلى تحديث أسرع' }
                  ]
                }
              }
            }
          },
          {
            title: 'ما هي الميزة الإضافية التي تود رؤيتها في التحديثات القادمة؟',
            questionItem: {
              question: {
                required: true,
                textQuestion: { paragraph: true }
              }
            }
          }
        ];
      }

      const created = await createGoogleForm(newFormTitle, newFormDescription, token, questions);
      showNotification('success', `تم إنشاء نموذج Google Forms بنجاح!`);
      setShowCreateModal(false);
      fetchForms();
      setSelectedForm(created);
    } catch (err: any) {
      console.error('Create form failed:', err);
      showNotification('error', err.message || 'فشل إنشاء النموذج');
    } finally {
      setCreatingForm(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-slate-800/60 rounded-3xl">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">جاري تهيئة الاتصال بخدمات Google...</p>
      </div>
    );
  }

  // Not signed in view
  if (!currentUser || !accessToken) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-[#0a0f1d] to-[#020617] border border-slate-700/60 rounded-[2.5rem] p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative max-w-xl mx-auto space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400 shadow-xl shadow-blue-500/10">
              <ClipboardList className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
                تكامل نماذج Google Forms
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                اربط حساب Google الخاص بك لإنشاء وإدارة استطلاعات الرأي واستبيانات أسعار السوق الموازي ومتابعة استجابات وتحليلات المتابعين مباشرة.
              </p>
            </div>

            <div className="p-4 bg-white/[0.03] border border-slate-800/80 rounded-2xl text-xs text-slate-400 text-right space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>إمكانية إنشاء استطلاعات واستبيانات فورية للمتابعين</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>قراءة وتحليل استجابات الزوار وإحصائيات التوقعات</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>مشاركة الروابط الرسمية لنماذج Google Forms بنقرة واحدة</span>
              </div>
            </div>

            {/* Official Google Sign In Button */}
            <div className="pt-2 flex justify-center">
              <button 
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                className="gsi-material-button group cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1f1f1f',
                  padding: '12px 24px',
                  borderRadius: '16px',
                  fontWeight: 700,
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)',
                  border: '1px solid #e2e8f0'
                }}
              >
                {isSigningIn ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-700" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ width: '22px', height: '22px', display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
                <span>تسجيل الدخول باستخدام Google</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Signed in dashboard view
  return (
    <div className="space-y-6">
      {/* Notifications */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
              feedbackMsg.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Profile & Actions Header */}
      <div className="bg-white/[0.02] border border-slate-700/50 rounded-[2rem] p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt={currentUser.displayName || ''} className="w-12 h-12 rounded-2xl border border-slate-700 object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              {currentUser.email?.[0]?.toUpperCase() || 'G'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">{currentUser.displayName || 'مستخدم Google'}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                متصل
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono" dir="ltr">{currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء استطلاع جديد</span>
          </button>

          <button
            onClick={() => fetchForms()}
            disabled={loadingForms}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-slate-800 transition-all active:scale-95"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${loadingForms ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={handleGoogleLogout}
            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all active:scale-95"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Forms List & Details View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-400 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              <span>النماذج المتوفرة في Google Drive</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">({formsList.length})</span>
          </div>

          {loadingForms ? (
            <div className="py-16 text-center bg-white/[0.02] border border-slate-800/60 rounded-3xl">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">جاري تحميل النماذج...</p>
            </div>
          ) : formsList.length === 0 ? (
            <div className="p-8 text-center bg-white/[0.02] border border-slate-800/60 rounded-3xl space-y-4">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <p className="text-white font-bold text-sm">لا توجد نماذج Google Forms حتى الآن</p>
                <p className="text-xs text-slate-500 mt-1">ابدأ بإنشاء استطلاع جديد لتوقعات السوق والعملات</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-all"
              >
                إنشاء نموذج الآن
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
              {formsList.map((form) => {
                const isSelected = selectedForm?.formId === form.id;
                return (
                  <div
                    key={form.id}
                    onClick={() => handleSelectForm(form)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : 'bg-white/[0.02] hover:bg-white/[0.04] border-slate-800/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400'
                        }`}>
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{form.name}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {form.modifiedTime ? format(new Date(form.modifiedTime), 'yyyy/MM/dd HH:mm', { locale: ar }) : '---'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-emerald-400' : ''}`} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px]">
                      <a
                        href={form.webViewLink || `https://docs.google.com/forms/d/${form.id}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>فتح في Google</span>
                      </a>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(`https://docs.google.com/forms/d/e/${form.id}/viewform`, form.id);
                        }}
                        className="text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedId === form.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === form.id ? 'تم النسخ' : 'نسخ الرابط'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Form Preview & Responses */}
        <div className="lg:col-span-7">
          {loadingDetails ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-slate-800/60 rounded-3xl p-8">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
              <p className="text-sm text-slate-400">جاري تحميل الأسئلة والاستجابات من Google Forms API...</p>
            </div>
          ) : selectedForm ? (
            <div className="space-y-6">
              {/* Form Overview Header */}
              <div className="bg-white/[0.02] border border-slate-700/60 rounded-3xl p-6 relative overflow-hidden shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedForm.info.title}</h3>
                    {selectedForm.info.description && (
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{selectedForm.info.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={selectedForm.responderUri || `https://docs.google.com/forms/d/${selectedForm.formId}/viewform`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض للملء</span>
                    </a>
                    <a
                      href={`https://docs.google.com/forms/d/${selectedForm.formId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>تعديل النموذج</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/60 text-xs">
                  <div className="bg-black/30 p-3 rounded-2xl border border-slate-800/50">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1 font-mono">الأسئلة</span>
                    <span className="text-base font-black text-white font-mono">{selectedForm.items?.length || 0}</span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-2xl border border-slate-800/50">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1 font-mono">الردود المسجلة</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {formResponses?.responses?.length || 0}
                    </span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-2xl border border-slate-800/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1 font-mono">معرف النموذج</span>
                    <span className="text-xs font-mono text-slate-400 truncate block" dir="ltr">{selectedForm.formId}</span>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="bg-white/[0.02] border border-slate-800/60 rounded-3xl p-6">
                <h4 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>بنود وأسئلة النموذج</span>
                </h4>

                <div className="space-y-3">
                  {selectedForm.items && selectedForm.items.length > 0 ? (
                    selectedForm.items.map((item, idx) => (
                      <div key={item.itemId || idx} className="p-4 bg-black/30 border border-slate-800/60 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-white">{item.title}</span>
                          {item.questionItem?.question.required && (
                            <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-bold">إلزامي</span>
                          )}
                        </div>

                        {item.questionItem?.question.choiceQuestion?.options && (
                          <div className="mt-2 mr-7 flex flex-wrap gap-2">
                            {item.questionItem.question.choiceQuestion.options.map((opt, oIdx) => (
                              <span key={oIdx} className="text-xs bg-white/5 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
                                • {opt.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد أسئلة مسجلة في هذا النموذج.</p>
                  )}
                </div>
              </div>

              {/* Responses Overview */}
              <div className="bg-white/[0.02] border border-slate-800/60 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>آخر الاستجابات والردود المستلمة</span>
                  </h4>
                  <button
                    onClick={() => handleSelectForm({ id: selectedForm.formId, name: selectedForm.info.title })}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>تحديث الردود</span>
                  </button>
                </div>

                {formResponses?.responses && formResponses.responses.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {formResponses.responses.map((resp, rIdx) => (
                      <div key={resp.responseId || rIdx} className="p-4 bg-black/40 border border-slate-800/60 rounded-2xl text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono">
                          <span>رد رقم #{formResponses.responses!.length - rIdx}</span>
                          <span>{resp.lastSubmittedTime ? format(new Date(resp.lastSubmittedTime), 'yyyy/MM/dd HH:mm:ss', { locale: ar }) : '---'}</span>
                        </div>
                        {resp.answers && Object.entries(resp.answers).map(([qId, ans]) => (
                          <div key={qId} className="bg-white/[0.02] p-2 rounded-xl border border-slate-800/40">
                            <span className="text-slate-400 block mb-0.5 text-[11px]">
                              {selectedForm.items?.find(i => i.questionItem?.question.questionId === qId)?.title || `سؤال (${qId.slice(0, 6)}...)`}:
                            </span>
                            <span className="text-white font-bold">
                              {ans.textAnswers?.answers?.map(a => a.value).join(', ') || '---'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    لم يتم تسجيل أي ردود بعد لهذا النموذج حتى الآن. شارك رابط النموذج لبدء جمع الإجابات.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-slate-800/60 rounded-3xl p-8 text-center">
              <ClipboardList className="w-12 h-12 text-slate-700 mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">اختر نموذجاً من القائمة</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                انقر على أي نموذج في القائمة الجانبية لعرض الأسئلة والاستجابات والتحليلات مباشرة.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create New Form Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b1120] border border-slate-700/70 rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">إنشاء نموذج Google Forms جديد</h3>
                    <p className="text-xs text-slate-400">اختر قالباً جاهزاً أو قم بتخصيص النموذج</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Template Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300">نوع القالب الجاهز:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setSelectedTemplate('rates_forecast');
                      setNewFormTitle('استطلاع توقعات أسعار الدولار والذهب');
                      setNewFormDescription('شاركنا رأيك حول اتجاه أسعار العملات في السوق الموازي للأيام القادمة.');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedTemplate === 'rates_forecast'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>توقعات أسعار العملات</span>
                    </div>
                    <p className="text-[11px] text-slate-400">أسئلة جاهزة حول اتجاه السوق والنطاق السعري</p>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedTemplate('app_feedback');
                      setNewFormTitle('استبيان رأي مستخدمي المنصة');
                      setNewFormDescription('نود معرفة تجربتك مع موقع وتطبيق أسعار العملات ومقترحاتك للتطوير.');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedTemplate === 'app_feedback'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-blue-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>تقييم ومقترحات المستخدمين</span>
                    </div>
                    <p className="text-[11px] text-slate-400">تقييم سرعة التحديثات والميزات المطلوبة</p>
                  </div>
                </div>
              </div>

              {/* Title and Description Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">عنوان النموذج:</label>
                  <input
                    type="text"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/60"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">وصف النموذج:</label>
                  <textarea
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    className="w-full h-20 bg-black/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/60 resize-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCreateForm}
                  disabled={creatingForm || !newFormTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {creatingForm ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>إنشاء وحفظ في Google</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Explicit User Confirmation Dialog (Mandatory for Workspace mutations) */}
      <AnimatePresence>
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[300] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0f172a] border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">تأكيد الإجراء في Google Forms</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.title}</p>
              
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
                >
                  تأكيد وإنشاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
