import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export function ThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  useEffect(() => {
    const observer = new MutationObserver(() => setLight(document.documentElement.dataset.theme === 'light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const toggle = () => {
    const next = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    safeStorage.setItem('colorTheme', next ? 'light' : 'dark');
    setLight(next);
  };

  return (
    <button type="button" onClick={toggle} aria-label="الوضع الفاتح" aria-pressed={light}
      title={light ? 'الوضع الداكن' : 'الوضع الفاتح'}
      className="theme-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors">
      {light ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
    </button>
  );
}
