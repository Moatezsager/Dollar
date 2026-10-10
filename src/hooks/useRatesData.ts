import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Rates, HistoryPoint, AppStatus, ToastItem } from "../types/rates";
import { safeStorage } from "../utils/storage";
import { decodeData } from "../utils/security";
import { processIncomingVersion } from "../utils/autoUpdater";
import { logErrorToServer } from "../utils/logger";
import { enablePush, disablePush, syncPushSubscription } from "../utils/pushNotifications";
import { DEFAULT_PRICE_THRESHOLD, priceChanges, priceDigest, isQuietTime } from "../../shared/notifications";

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
  const [notificationThreshold, setNotificationThreshold] = useState(() => {
    const saved = Number(safeStorage.getItem('notificationThreshold'));
    return saved >= 0.001 && saved <= 0.1 ? saved : DEFAULT_PRICE_THRESHOLD;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [inAppNotifications, setInAppNotifications] = useState(() => safeStorage.getItem('inAppNotifications') !== 'false');
  const inAppRef = useRef(inAppNotifications);
  const notificationBaseline = useRef<Rates | null>(null);
  const digestSnapshot = useRef<Rates | null>(null);
  const digestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratesRef = useRef<Rates | null>(null);
  const historyRef = useRef<HistoryPoint[]>([]);
  const socketRevisionRef = useRef(0);
  const thresholdRef = useRef<number>(notificationThreshold);
  const configTermsRef = useRef<any[]>([]);

  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const applyRates = (next: Rates) => {
    if (!next || !next.parallel || !next.official ||
        typeof next.parallel !== 'object' || Array.isArray(next.parallel) ||
        typeof next.official !== 'object' || Array.isArray(next.official) ||
        !Object.values({ ...next.parallel, ...next.official }).every(value => typeof value === 'number' && Number.isFinite(value)) ||
        !Number.isFinite(Date.parse(next.lastUpdated))) return false;
    const currentTime = Date.parse(ratesRef.current?.lastUpdated || '');
    if (Date.parse(next.lastUpdated) < currentTime) return false;
    ratesRef.current = next;
    setRates(next);
    setLastFetchTime(new Date());
    safeStorage.setItem('lyd_rates', JSON.stringify(next));
    return true;
  };

  const applyHistory = (next: HistoryPoint[]) => {
    historyRef.current = next;
    setHistory(next);
    safeStorage.setItem('lyd_history', JSON.stringify(next));
  };
  const appendRateHistory = (next: Rates, points = historyRef.current) => {
    const point: HistoryPoint = {
      time: next.lastUpdated,
      usdParallel: next.parallel.USD || 0,
      usdOfficial: next.official.USD || 0,
      ratesParallel: { ...next.parallel },
      ratesOfficial: { ...next.official },
    };
    const nextHistory = points.filter(item => item.time !== point.time);
    nextHistory.push(point);
    nextHistory.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    applyHistory(nextHistory);
  };

  useEffect(() => {
    configTermsRef.current = configTerms;
  }, [configTerms]);

  useEffect(() => {
    thresholdRef.current = notificationThreshold;
  }, [notificationThreshold]);

  const addToast = (title: string, body: string, type: 'up' | 'down' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev.slice(-2), { id, title, body, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    inAppRef.current = inAppNotifications;
    safeStorage.setItem('inAppNotifications', String(inAppNotifications));
  }, [inAppNotifications]);

  useEffect(() => {
    safeStorage.setItem('notificationThreshold', String(notificationThreshold));
  }, [notificationThreshold]);

  useEffect(() => {
    let active = true;
    syncPushSubscription().then(enabled => { if (active) setNotificationsEnabled(enabled); }).catch(() => {
      if (active) setNotificationError('تعذر مزامنة اشتراك الإشعارات. يمكنك إعادة التفعيل من هنا.');
    });
    const checkPermission = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') setNotificationsEnabled(false);
    };
    window.addEventListener('focus', checkPermission);
    return () => {
      active = false;
      window.removeEventListener('focus', checkPermission);
      if (digestTimer.current) clearTimeout(digestTimer.current);
      digestTimer.current = null;
    };
  }, []);

  const queuePriceDigest = (previous: Rates | null, next: Rates) => {
    if (!previous || Date.parse(next.lastUpdated) < Date.parse(previous.lastUpdated)) return;
    notificationBaseline.current ||= previous;
    if (!inAppRef.current || document.visibilityState !== 'visible') {
      notificationBaseline.current = next;
      digestSnapshot.current = null;
      return;
    }
    digestSnapshot.current = next;
    if (!priceChanges(notificationBaseline.current, next, thresholdRef.current, configTermsRef.current).length || digestTimer.current) return;
    const lastDigest = Number(safeStorage.getItem('last_inapp_digest')) || 0;
    digestTimer.current = setTimeout(() => {
      digestTimer.current = null;
      const snapshot = digestSnapshot.current, baseline = notificationBaseline.current;
      if (!snapshot || !baseline) return;
      const changes = priceChanges(baseline, snapshot, thresholdRef.current, configTermsRef.current);
      notificationBaseline.current = snapshot;
      digestSnapshot.current = null;
      if (!changes.length || !inAppRef.current || document.visibilityState !== 'visible') return;
      const digest = priceDigest(changes);
      addToast(digest.title, digest.body, 'info');
      safeStorage.setItem('last_inapp_digest', String(Date.now()));
      if (!isQuietTime()) options?.playNotificationSound?.(changes[0].newPrice > changes[0].oldPrice ? 'up' : 'down');
    }, Math.max(10000, 30000 - (Date.now() - lastDigest)));
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
    const socketRevision = socketRevisionRef.current;
    setIsRefreshing(true);
    try {
      if (forceRefresh) {
        await fetchConfig();
      }
      const [ratesResult, historyResult] = await Promise.allSettled([
        fetch(forceRefresh ? "/api/rates?refresh=true" : "/api/rates", { cache: 'no-store', signal: AbortSignal.timeout(30000) }),
        fetch("/api/history", { cache: 'no-store', signal: AbortSignal.timeout(30000) }),
      ]);
      
      if (ratesResult.status === 'rejected') throw ratesResult.reason;
      const ratesRes = ratesResult.value;
      const historyRes = historyResult.status === 'fulfilled' ? historyResult.value : null;

      if (!ratesRes.ok) {
        if (ratesRes.status === 502) return;
        throw new Error("Network response was not ok");
      }

      const ratesContentType = ratesRes.headers.get("content-type");
      const historyContentType = historyRes?.headers.get("content-type");

      if (!ratesContentType?.includes("application/json")) {
        return;
      }

      const ratesJson = await ratesRes.json();
      const historyJson = historyRes?.ok && historyContentType?.includes("application/json")
        ? await historyRes.json().catch(() => null) : null;
      
      const newRates: Rates | null = typeof ratesJson === 'string' ? decodeData(ratesJson) : ratesJson;
      const newHistory = typeof historyJson === 'string' ? decodeData(historyJson) : historyJson;
      
      if (!newRates) {
        console.error("Failed to decode rates or history");
        setIsRefreshing(false);
        return;
      }
      
      const currentRates = ratesRef.current;
      if (currentRates && (
        Date.parse(newRates.lastUpdated) < Date.parse(currentRates.lastUpdated) ||
        (socketRevision !== socketRevisionRef.current && Date.parse(newRates.lastUpdated) <= Date.parse(currentRates.lastUpdated))
      )) return;

      if (!applyRates(newRates)) return;
      queuePriceDigest(currentRates, newRates);
      if (socketRevision === socketRevisionRef.current) {
        appendRateHistory(newRates, Array.isArray(newHistory) ? newHistory : historyRef.current);
      }

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
    setNotificationBusy(true);
    setNotificationError('');
    try {
      await enablePush();
      setNotificationsEnabled(true);
    } catch (error: any) { setNotificationError(error.message || 'تعذر تفعيل الإشعارات.'); }
    finally { setNotificationBusy(false); }
  };

  const stopNotifications = async () => {
    setNotificationBusy(true);
    setNotificationError('');
    try { await disablePush(); setNotificationsEnabled(false); }
    catch (error: any) {
      if (safeStorage.getItem('pushEnabled') === 'false') setNotificationsEnabled(false);
      setNotificationError(error.message || 'تعذر إيقاف الإشعارات.');
    } finally { setNotificationBusy(false); }
  };

  // Socket.io Real-time connection
  useEffect(() => {
    let socket: any = null;
    let hasConnected = false;

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
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 15000
        });
        socket.on('connect', () => {
          if (hasConnected) fetchData().catch(() => {});
          hasConnected = true;
        });

        socket.on('online_count', (data: any) => {
          setOnlineCount(data.count);
        });

        socket.on('rates_update', (data: any) => {
          const decodedRates = decodeData<Rates>(data?.rates);
          if (!decodedRates) return;

          const currentRates = ratesRef.current;
          if (!applyRates(decodedRates)) return;
          queuePriceDigest(currentRates, decodedRates);
          socketRevisionRef.current++;
          appendRateHistory(decodedRates);
          setLoading(false);
        });
        socket.on('config_update', (data: any) => {
          if (Array.isArray(data?.config?.terms)) setConfigTerms(data.config.terms);
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
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
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
      if (savedRates) applyRates(JSON.parse(savedRates));
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) applyHistory(parsedHistory);
      }
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
    notificationBusy,
    notificationError,
    inAppNotifications,
    setInAppNotifications,
    stopNotifications,
    notificationThreshold,
    setNotificationThreshold,
    requestNotificationPermission,
    fetchData,
    fetchConfig,
  };
}
