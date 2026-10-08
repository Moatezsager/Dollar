import React from "react";
import { Home, Coins, Calculator, LineChart, LayoutGrid } from "lucide-react";

interface MobileNavProps {
  activeTab: 'main' | 'gold' | 'charts' | 'converter' | 'more';
  setActiveTab: (tab: 'main' | 'gold' | 'charts' | 'converter' | 'more') => void;
  triggerHaptic: (pattern?: number | number[]) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab, triggerHaptic }) => (
  <div className="mobile-nav-shell md:hidden fixed bottom-0 left-0 right-0 z-[90] pb-safe pointer-events-none flex justify-center">
    <nav id="mobile-bottom-nav" dir="rtl" aria-label="التنقل الرئيسي"
      className="pointer-events-auto w-full max-w-[640px] grid grid-cols-5 gap-1 px-2 py-1">
      {[
        { id: 'main', icon: Home, label: 'الرئيسية' },
        { id: 'gold', icon: Coins, label: 'الذهب' },
        { id: 'converter', icon: Calculator, label: 'المحول' },
        { id: 'charts', icon: LineChart, label: 'التحليل' },
        { id: 'more', icon: LayoutGrid, label: 'المزيد' },
      ].map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button key={tab.id} type="button" aria-label={tab.label} title={tab.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => { triggerHaptic(8); setActiveTab(tab.id as MobileNavProps['activeTab']); }}
            className={`mobile-nav-item flex min-w-0 h-16 flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-emerald-400' : 'text-slate-400'}`}>
            <div className="nav-icon-slot flex w-10 h-8 items-center justify-center">
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
            </div>
            <span className={`text-xs leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  </div>
);
