import { useState, useRef, useEffect } from "react";
import { safeStorage } from "../utils/storage";

export function useAppSettings() {
  const [hapticEnabled, setHapticEnabled] = useState(() => {
    const saved = safeStorage.getItem('hapticEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = safeStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = safeStorage.getItem('animationsEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = safeStorage.getItem('autoRefreshEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [showChart, setShowChart] = useState(() => {
    const saved = safeStorage.getItem('showChart');
    return saved !== null ? saved === 'true' : true;
  });

  const [compactMode, setCompactMode] = useState(() => {
    const saved = safeStorage.getItem('compactMode');
    return saved !== null ? saved === 'true' : false;
  });

  const [dataSaver, setDataSaver] = useState(() => {
    const saved = safeStorage.getItem('dataSaver');
    return saved !== null ? saved === 'true' : false;
  });

  const [defaultMarket, setDefaultMarket] = useState<'parallel' | 'official'>(() => {
    const saved = safeStorage.getItem('defaultMarket');
    return (saved as 'parallel' | 'official') || 'parallel';
  });

  const [majorChangesOnly, setMajorChangesOnly] = useState(() => {
    const saved = safeStorage.getItem('majorChangesOnly');
    return saved !== null ? saved === 'true' : false;
  });

  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(() => {
    const saved = safeStorage.getItem('dailySummaryEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [goldNotificationsEnabled, setGoldNotificationsEnabled] = useState(() => {
    const saved = safeStorage.getItem('goldNotificationsEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [fontSizePreference, setFontSizePreference] = useState<'small' | 'medium' | 'large'>(() => {
    return (safeStorage.getItem('fontSizePreference') as 'small' | 'medium' | 'large') || 'medium';
  });

  const [chartResolution, setChartResolution] = useState<'low' | 'medium' | 'high'>(() => {
    return (safeStorage.getItem('chartResolution') as 'low' | 'medium' | 'high') || 'medium';
  });

  const [spreadAlertEnabled, setSpreadAlertEnabled] = useState(() => {
    const saved = safeStorage.getItem('spreadAlertEnabled');
    return saved !== null ? saved === 'true' : false;
  });

  const [spreadAlertValue, setSpreadAlertValue] = useState(() => {
    const saved = safeStorage.getItem('spreadAlertValue');
    return saved !== null ? parseFloat(saved) : 1.5;
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    foreign: false,
    checks: false,
    metals: false,
    transfers: false,
    official: false
  });

  // Haptic feedback trigger
  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (hapticEnabled && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
    triggerHaptic(10);
  };

  // Sound feedback
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playNotificationSound = (type: 'up' | 'down') => {
    if (!soundEnabledRef.current) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'up') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.15); // A3
      }
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  };

  return {
    hapticEnabled,
    setHapticEnabled,
    soundEnabled,
    setSoundEnabled,
    animationsEnabled,
    setAnimationsEnabled,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    showChart,
    setShowChart,
    compactMode,
    setCompactMode,
    dataSaver,
    setDataSaver,
    defaultMarket,
    setDefaultMarket,
    majorChangesOnly,
    setMajorChangesOnly,
    dailySummaryEnabled,
    setDailySummaryEnabled,
    goldNotificationsEnabled,
    setGoldNotificationsEnabled,
    fontSizePreference,
    setFontSizePreference,
    chartResolution,
    setChartResolution,
    spreadAlertEnabled,
    setSpreadAlertEnabled,
    spreadAlertValue,
    setSpreadAlertValue,
    expandedSections,
    setExpandedSections,
    toggleSection,
    triggerHaptic,
    playNotificationSound,
  };
}
