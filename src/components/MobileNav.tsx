import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Home, Coins, Calculator, LineChart, LayoutGrid } from "lucide-react";

interface MobileNavProps {
  activeTab: 'main' | 'gold' | 'charts' | 'converter' | 'more';
  setActiveTab: (tab: 'main' | 'gold' | 'charts' | 'converter' | 'more') => void;
  triggerHaptic: (pattern?: number | number[]) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  triggerHaptic,
}) => {
  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-[90] pb-safe pointer-events-none flex justify-center">
      <nav
        id="mobile-bottom-nav"
        dir="rtl"
        className="pointer-events-auto w-full max-w-[380px] bg-[#060913]/95 backdrop-blur-3xl border border-slate-700/60 rounded-full p-2 flex items-center justify-between shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-black/50"
      >
        {[
          { id: 'main', icon: Home, label: 'الرئيسية', color: 'emerald' },
          { id: 'gold', icon: Coins, label: 'الذهب', color: 'amber' },
          { id: 'converter', icon: Calculator, label: 'المحول', color: 'blue' },
          { id: 'charts', icon: LineChart, label: 'التحليل', color: 'fuchsia' },
          { id: 'more', icon: LayoutGrid, label: 'المزيد', color: 'indigo' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          const colorMap = {
            emerald: 'text-emerald-400',
            amber: 'text-amber-400',
            blue: 'text-blue-400',
            fuchsia: 'text-fuchsia-400',
            indigo: 'text-indigo-400',
          };
          
          const bgMap = {
            emerald: 'bg-emerald-500/15',
            amber: 'bg-amber-500/15',
            blue: 'bg-blue-500/15',
            fuchsia: 'bg-fuchsia-500/15',
            indigo: 'bg-indigo-500/15',
          };
          
          return (
            <button
              key={tab.id}
              onClick={() => { triggerHaptic(8); setActiveTab(tab.id as any); }}
              className={`relative flex items-center justify-center h-12 rounded-full transition-all duration-300 outline-none select-none ${
                isActive 
                  ? `px-5 ${bgMap[tab.color as keyof typeof bgMap]} ${colorMap[tab.color as keyof typeof colorMap]} shadow-inner`
                  : 'w-12 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon strokeWidth={isActive ? 2.5 : 2} className={`${isActive ? 'w-5 h-5' : 'w-5 h-5'} transition-all duration-300`} />
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, width: 'auto', marginLeft: 4 }}
                      exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs font-bold tracking-wide overflow-hidden whitespace-nowrap"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {/* Active Indicator Glow */}
              {isActive && (
                <motion.div
                  layoutId="nav-glow"
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full ${bgMap[tab.color as keyof typeof bgMap].replace('/15', '/50')} blur-[2px]`}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
