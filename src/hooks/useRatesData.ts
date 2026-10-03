import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Rates, HistoryPoint, AppStatus, ToastItem } from "../types/rates";
import { safeStorage } from "../utils/storage";
import { decodeData } from "../utils/security";
import { processIncomingVersion } from "../utils/autoUpdater";
import { logErrorToServer } from "../utils/logger";

interface UseRatesDataOptions {
  playNotificationSound?: (type: 'up' | 'down') => void;
}

export function useRatesData(options?: UseRatesDataOptions) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [configTerms, setConfigTerms] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notificationThreshold, setNotificationThreshold] = useState(0.001);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    } catch {
      return false;
    }
  });

  const ratesRef = useRef<Rates | null>(null);
  const thresholdRef = useRef<number>(0.001);
  const lastNotifiedRef = useRef<Record<string, number>>({});
  const configTermsRef = useRef<any[]>([]);

  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);

  useEffect(() => {
    configTermsRef.current = configTerms;
  }, [configTerms]);

  useEffect(() => {
    thresholdRef.current = notificationThreshold;
  }, [notificationThreshold]);

  const addToast = (title: string, body: string, type: 'up' | 'down' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showPriceNotification = async (code: string, name: string, oldPrice: number, newPrice: number) => {
    const diff = newPrice - oldPrice;
    const absDiff = Math.abs(diff);
    
    // 1. Check threshold
    if (absDiff < thresholdRef.current) return;

    // 2. Prevent duplicate notifications
    try {
      const lastNotifyData = safeStorage.getItem(`last_notify_${code}`);
      if (lastNotifyData) {
        const { price, time } = JSON.parse(lastNotifyData);
        const timeDiff = Date.now() - time;
        if (price === newPrice && timeDiff < 10 * 60 * 1000) {
          return;
        }
      }
    } catch (e) {
      console.warn("Notification storage check failed", e);
    }

    const direction = diff > 0 ? 'ارتفاع' : 'انخفاض';
    const arrow = diff > 0 ? '📈' : '📉';
    const title = `${arrow} ${direction} في سعر ${name}`;
    const body = `السعر الجديد: ${newPrice.toFixed(2)} د.ل (تغير بمقدار ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`;

    try {
      safeStorage.setItem(`last_notify_${code}`, JSON.stringify({
        price: newPrice,
        time: Date.now()
      }));
    } catch (e) {
      console.warn("Failed to save notification state to storage", e);
    }

    // In-app toast & sound
    addToast(title, body, diff > 0 ? 'up' : 'down');
    if (options?.playNotificationSound) {
      options.playNotificationSound(diff > 0 ? 'up' : 'down');
    }

    // Native notification
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: 'https://flagcdn.com/w80/ly.png',
            badge: 'https://flagcdn.com/w80/ly.png',
            vibrate: [200, 100, 200],
            tag: `price-change-${code}`,
            renotify: true,
            data: { url: 'https://dollar-price-qp14.onrender.com/' },
            silent: false,
            dir: 'rtl',
            actions: [
              { action: 'open', title: 'فتح التطبيق' }
            ]
          } as any);
        }
      }
    } catch (err) {
      console.error("Failed to show notification:", err);
      logErrorToServer(err, "useRatesData: showPriceNotification");
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/config?t=${Date.now()}`);
      if (!response.ok) return;
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;
      const data = await response.json();
      if (data && data.terms) {
        setConfigTerms(data.terms);
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
      logErrorToServer(error, "useRatesData: fetchConfig");
    }
  };

  const fetchData = async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      if (forceRefresh) {
        await fetchConfig();
      }
      const [ratesResult, historyResult] = await Promise.allSettled([
        fetch(forceRefresh ? "/api/rates?refresh=true" : "/api/rates", { signal: AbortSignal.timeout(30000) }),
        fetch("/api/history", { signal: AbortSignal.timeout(30000) }),
      ]);
      
      if (ratesResult.status === 'rejected') throw ratesResult.reason;
      if (historyResult.status === 'rejected') throw historyResult.reason;

      const ratesRes = ratesResult.value;
      const historyRes = historyResult.value;

      if (!ratesRes.ok || !historyRes.ok) {
        if (ratesRes.status === 502 || historyRes.status === 502) return;
        throw new Error("Network response was not ok");
      }

      const ratesContentType = ratesRes.headers.get("content-type");
      const historyContentType = historyRes.headers.get("content-type");

      if (!ratesContentType?.includes("application/json") || !historyContentType?.includes("application/json")) {
        return;
      }

      const ratesJson = await ratesRes.json();
      const historyJson = await historyRes.json();
      
      const newRates: Rates | null = typeof ratesJson === 'string' ? decodeData(ratesJson) : ratesJson;
      const newHistory = typeof historyJson === 'string' ? decodeData(historyJson) : historyJson;
      
      if (!newRates || !newHistory) {
        console.error("Failed to decode rates or history");
        setIsRefreshing(false);
        return;
      }
      
      // Check for price changes to notify
      let hasChanges = false;
      const currentRates = ratesRef.current;
      
      if (currentRates) {
        const isNewer = new Date(newRates.lastUpdated).getTime() > new Date(currentRates.lastUpdated).getTime();
        
        if (isNewer) {
          const currenciesToCheck = Object.keys(newRates.parallel);
          const changes: { code: string; name: string; oldPrice: number; newPrice: number; priority: number }[] = [];
          const priorityIds = ["USD", "USD_JBANK", "USD_CHECKS", "EUR", "GOLD"];
          
          currenciesToCheck.forEach(code => {
            const oldPrice = currentRates.parallel[code];
            const newPrice = newRates.parallel[code];
            
            if (oldPrice && newPrice && Math.abs(oldPrice - newPrice) >= thresholdRef.current) {
              if (lastNotifiedRef.current[code] !== newPrice) {
                const term = configTermsRef.current.find(t => t.id === code);
                const name = term ? term.name : code;
                const priority = priorityIds.indexOf(code);
                
                changes.push({ 
                  code, 
                  name, 
                  oldPrice, 
                  newPrice, 
                  priority: priority === -1 ? 999 : priority 
                });
                lastNotifiedRef.current[code] = newPrice;
              }
            }
          });

          if (changes.length > 0) {
            hasChanges = true;
            changes.sort((a, b) => a.priority - b.priority);
            
            const maxIndividual = 3;
            const toNotify = changes.slice(0, maxIndividual);
            const remainingCount = changes.length - maxIndividual;
            
            for (const change of toNotify) {
              showPriceNotification(change.code, change.name, change.oldPrice, change.newPrice).catch(err => {
                console.error("Error showing notification:", err);
              });
            }
            
            if (remainingCount > 0) {
              const summaryTitle = "📊 تحديثات أسعار إضافية";
              const summaryBody = `بالإضافة للعملات الرئيسية، تم رصد تغيرات في أسعار ${remainingCount} عملات وأصناف أخرى في السوق.`;
              addToast(summaryTitle, summaryBody, "info");
              
              try {
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(summaryTitle, {
                      body: summaryBody,
                      icon: 'https://flagcdn.com/w80/ly.png',
                      badge: 'https://flagcdn.com/w80/ly.png',
                      tag: 'price-change-summary',
                      renotify: true,
                      dir: 'rtl'
                    } as any);
                  }).catch(() => {});
                }
              } catch (err) {
                console.error("Failed to show summary notification:", err);
              }
            }
          }
        }
      }

      setRates(newRates);
      setHistory(newHistory);
      setLastFetchTime(new Date());

      // Fetch status
      try {
        const statusRes = await fetch("/api/status");
        if (statusRes.ok) {
          const contentType = statusRes.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const statusData = await statusRes.json();
            setAppStatus(statusData);
          }
        }
      } catch (err) {
        logErrorToServer(err, "useRatesData: fetchStatus");
      }

      // Persist to local storage
      try {
        safeStorage.setItem('lyd_rates', JSON.stringify(newRates));
        safeStorage.setItem('lyd_history', JSON.stringify(newHistory));
      } catch (err) {
        console.warn("Failed to save to storage:", err);
      }

      if (hasChanges) {
        addToast("تم تحديث الأسعار", "تم رصد تغييرات جديدة في السوق وتحديث البيانات", "info");
      }
    } catch (error) {
      const errName = error && typeof error === 'object' ? (error as any).name : '';
      const errMsg = error && typeof error === 'object' ? (error as any).message : '';
      
      if (error instanceof TypeError && errMsg === "Failed to fetch") {
        console.warn("Server might be restarting or network is down...");
      } else if (errName === 'AbortError' || errName === 'TimeoutError' || (typeof errMsg === 'string' && errMsg.includes('signal timed out'))) {
        console.warn("Fetch request timed out");
      } else {
        const isNetworkError = typeof errMsg === 'string' && errMsg.includes("Network response was not ok");
        if (!isNetworkError) {
          console.error("Failed to fetch data:", error);
          logErrorToServer(error, "useRatesData: fetchData");
        }
        if (forceRefresh) {
          addToast("خطأ في التحديث", "تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً", "info");
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (typeof window === 'undefined' || !("Notification" in window) || typeof Notification === 'undefined') {
        addToast("غير مدعوم", "متصفحك لا يدعم الإشعارات", "info");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        addToast("تم تفعيل التنبيهات", "ستصلك إشعارات عند تغير الأسعار الهامة", "info");
      } else {
        addToast("تم رفض التنبيهات", "يرجى تفعيل الإشعارات من إعدادات المتصفح", "info");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      logErrorToServer(error, "useRatesData: requestNotificationPermission");
      addToast("خطأ", "تعذر تفعيل الإشعارات", "info");
    }
  };

  // Socket.io Real-time connection
  useEffect(() => {
    let socket: any = null;

    const connect = () => {
      try {
        let deviceId = safeStorage.getItem('__deviceId');
        if (!deviceId) {
          deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          safeStorage.setItem('__deviceId', deviceId);
        }
        socket = io('/', {
          query: { deviceId },
          transports: ['polling', 'websocket'],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          timeout: 15000
        });

        socket.on('online_count', (data: any) => {
          setOnlineCount(data.count);
        });

        socket.on('rates_update', (data: any) => {
          const decodedRates = decodeData(data.rates);
          if (decodedRates) {
            setRates(decodedRates);
          }
        });

        socket.on('app_version', (data: any) => {
          if (data?.version) {
            processIncomingVersion(data.version);
          }
        });

        socket.on('connect_error', (err: any) => {
          console.warn('Socket.io connection notice (polling fallback active):', err?.message || err);
        });
      } catch (err) {
        console.warn('Socket.io initialization notice:', err);
      }
    };

    connect();

    // Fallback polling for online count
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/stats/active');
        if (res.ok) {
          const data = await res.json();
          setOnlineCount(data.count);
        }
      } catch (err) {
        console.debug("Polling active users failed", err);
      }
    }, 30000);

    return () => {
      if (socket) socket.disconnect();
      clearInterval(pollInterval);
    };
  }, []);

  // Online / offline and cache load
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    try {
      const savedRates = safeStorage.getItem('lyd_rates');
      const savedHistory = safeStorage.getItem('lyd_history');
      if (savedRates) setRates(JSON.parse(savedRates));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (err) {
      console.warn("Storage not available:", err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConfig().catch(() => {});
    fetchData().catch(() => {});
  }, []);

  return {
    rates,
    setRates,
    history,
    setHistory,
    configTerms,
    loading,
    isRefreshing,
    lastFetchTime,
    isOffline,
    onlineCount,
    appStatus,
    toasts,
    addToast,
    removeToast,
    notificationsEnabled,
    notificationThreshold,
    setNotificationThreshold,
    requestNotificationPermission,
    fetchData,
    fetchConfig,
  };
}
