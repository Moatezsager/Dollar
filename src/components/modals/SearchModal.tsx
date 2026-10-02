import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { SearchResult } from "../../utils/smartSearch";
import { RateCell } from "../RateCell";

interface SearchModalProps {
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  triggerHaptic: (pattern?: number | number[]) => void;
  setSelectedRate: (rate: { code: string; name: string; market: 'official' | 'parallel' } | null) => void;
  handleShareCardImage: (code: string, name: string, price: number, isGold?: boolean) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  showSearchModal,
  setShowSearchModal,
  searchQuery,
  setSearchQuery,
  searchResults,
  triggerHaptic,
  setSelectedRate,
  handleShareCardImage,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [showSearchModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSearchModal) {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchModal, setShowSearchModal]);

  return (
    <AnimatePresence>
      {showSearchModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSearchModal(false);
            }
          }}
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col items-center pt-3 sm:pt-12 px-3 sm:px-6 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, y: -20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-[#090e1a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3 mb-16 relative"
          >
            {/* Header with Title 'البحث' & Close Button */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  البحث
                </h3>
              </div>

              <button
                onClick={() => {
                  triggerHaptic(6);
                  setShowSearchModal(false);
                }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
                title="إغلاق (Esc)"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative rounded-2xl bg-white/[0.04] p-1.5 sm:p-2 border border-white/[0.1] focus-within:border-emerald-500/50 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.2)] transition-all">
              <div className="flex items-center gap-2.5 px-3 py-1">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن أي عملة أو ذهب أو صكوك..."
                  className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none font-medium text-right"
                  dir="rtl"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      triggerHaptic(6);
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all shrink-0"
                    title="مسح"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Cards Results */}
            {searchQuery.trim().length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>نتائج مطابقة: <strong className="text-emerald-400">{searchResults.length}</strong></span>
                  <span className="text-[11px] text-zinc-500">انقر على الكرت للتفاصيل</span>
                </div>

                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[60vh] overflow-y-auto pr-1">
                    {searchResults.map(({ item, matchedBy }) => {
                      const isOfficial = item.category === 'official';
                      const rate = item.rate || 0;
                      const prevRate = item.prevRate || rate;

                      return (
                        <div key={item.id} className="relative flex flex-col gap-1 group">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 px-1">
                            <span className={`px-2 py-0.5 rounded-md border ${
                              item.category === 'metals' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              item.category === 'checks' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' :
                              item.category === 'official' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                              item.category === 'transfers' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                              'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            }`}>
                              {item.categoryLabel}
                            </span>
                            {matchedBy && matchedBy !== item.name && (
                              <span className="text-zinc-500 truncate max-w-[100px]">
                                مطابق: {matchedBy}
                              </span>
                            )}
                          </div>

                          <RateCell
                            term={{ id: item.code, name: item.name, flag: item.flag }}
                            rate={rate}
                            prevRate={prevRate}
                            trend={item.trend}
                            lastChangedDate={item.lastChangedDate}
                            decimals={item.decimals}
                            fallbackType={item.category === 'metals' ? 'coins' : item.category === 'checks' ? 'building' : 'send'}
                            onClick={() => {
                              setSelectedRate({ 
                                code: item.code, 
                                name: item.name, 
                                market: isOfficial ? 'official' : 'parallel' 
                              });
                              setShowSearchModal(false);
                            }}
                            onShare={(e) => {
                              e.stopPropagation();
                              handleShareCardImage(item.code, item.name, rate, isOfficial);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-zinc-400 text-sm">لا توجد نتائج مطابقة لـ "{searchQuery}"</p>
                    <p className="text-xs text-zinc-500">جرب البحث بكلمات أخرى مثل: ذهب، دولار، صكوك، يورو، فضة</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
