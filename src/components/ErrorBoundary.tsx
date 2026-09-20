import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logErrorToServer } from '../utils/logger';
import { safeStorage } from '../utils/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    logErrorToServer(error, 'React ErrorBoundary: ' + (errorInfo?.componentStack || ''));
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen w-full bg-[#091121] text-white flex flex-col items-center justify-center p-6 text-center font-sans"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

          <div className="relative z-10 max-w-sm w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <img src="/logo.png" alt="مؤشر الدينار" className="w-10 h-10 object-contain rounded-xl" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">مؤشر الدينار</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              حدث خطأ غير متوقع أثناء تحميل الصفحة. اضغط أدناه لإعادة تحديث البيانات.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
              >
                إعادة تحميل الصفحة
              </button>

              <button
                onClick={() => {
                  try {
                    safeStorage.clear();
                  } catch {}
                  window.location.href = '/';
                }}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs transition-colors border border-slate-800"
              >
                مسح الذاكرة المؤقتة والبدء من جديد
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
