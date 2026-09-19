import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('installPromptVisibility', { detail: showPrompt }));
  }, [showPrompt]);

  useEffect(() => {
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    if (isIosDevice) {
      setIsIOS(true);
      // Delay showing prompt slightly
      setTimeout(() => setShowPrompt(true), 3000);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', async () => {
      try {
        await fetch('/api/track/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'appinstalled_event' })
        });
      } catch (e) {}
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      try {
// Tracked by appinstalled event instead to prevent double counting
      } catch (e) {
        console.error('Failed to track install', e);
      }
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-md z-[100]"
        >
          <div className="bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-4">
            
            {showIOSInstructions ? (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex flex-col gap-3 text-right"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm">كيفية التثبيت على الآيفون</h3>
                  <button onClick={handleDismiss} className="p-1 text-white/50 hover:text-white rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                    <Share className="w-5 h-5" />
                  </div>
                  <p>1. اضغط على زر المشاركة في أسفل الشاشة</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <p>2. اختر <strong>إضافة إلى الشاشة الرئيسية</strong></p>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.3)] border border-emerald-400/20">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right">
                    <h3 className="text-white font-bold text-sm sm:text-base">تثبيت التطبيق</h3>
                    <p className="text-zinc-400 text-xs sm:text-sm">للوصول السريع وتجربة أفضل</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2" dir="ltr">
                  <button 
                    onClick={handleInstallClick}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                  >
                    تثبيت
                  </button>
                  <button 
                    onClick={handleDismiss}
                    className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                    aria-label="تجاهل"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
