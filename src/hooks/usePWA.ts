import { useState, useEffect, useCallback } from 'react';

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [os, setOs] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  const checkStandalone = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);
    return isStandalone;
  }, []);

  useEffect(() => {
    // OS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setOs('ios');
    } else if (/android/.test(userAgent)) {
      setOs('android');
    } else {
      setOs('desktop');
    }

    // Initial check
    checkStandalone();

    // Safari still exposes the older MediaQueryList listener API.
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => checkStandalone();
    if (displayMode.addEventListener) displayMode.addEventListener('change', handleDisplayModeChange);
    else displayMode.addListener(handleDisplayModeChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (displayMode.removeEventListener) displayMode.removeEventListener('change', handleDisplayModeChange);
      else displayMode.removeListener(handleDisplayModeChange);
    };
  }, [checkStandalone]);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    }
  };

  return { isInstalled, canInstall, promptInstall, os, checkStandalone };
}
