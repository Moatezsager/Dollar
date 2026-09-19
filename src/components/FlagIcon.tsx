import React, { useState } from 'react';
import { Coins, Building2, Send } from 'lucide-react';

interface FlagIconProps {
  flagCode?: string;
  name: string;
  className?: string;
  fallbackType?: 'coins' | 'building' | 'send';
}

/**
 * Modern FlagIcon with intelligent alignment to ensure the "hoist" (left) side 
 * is visible for flags like UAE, USA, etc., while staying perfectly circular.
 */
export function FlagIcon({ flagCode, name, className = "w-5 h-5", fallbackType = 'coins' }: FlagIconProps) {
  const [error, setError] = useState(false);
  const isValidFlag = flagCode && flagCode.trim() !== "" && flagCode !== "undefined" && flagCode !== "null";

  const isGold = flagCode?.toLowerCase() === 'gold' || name.includes('ذهب');
  const isSilver = flagCode?.toLowerCase() === 'silver' || name.includes('فضة');

  if (isGold) {
    return (
      <div className={`${className} rounded-full flex items-center justify-center overflow-hidden border border-yellow-500/30 shadow-xl relative group/flag bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 flex-shrink-0 ring-1 ring-yellow-400/20`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/40 via-transparent to-black/40"></div>
        <span className="text-white drop-shadow-md text-xs sm:text-sm relative z-10 font-bold">✨</span>
      </div>
    );
  }

  if (isSilver) {
    return (
      <div className={`${className} rounded-full flex items-center justify-center overflow-hidden border border-slate-300/30 shadow-xl relative group/flag bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 flex-shrink-0 ring-1 ring-slate-300/20`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/50 via-transparent to-black/40"></div>
        <span className="text-white drop-shadow-md text-xs sm:text-sm relative z-10 font-bold">✨</span>
      </div>
    );
  }

  if (!isValidFlag || error) {
    const FallbackIcon = fallbackType === 'building' ? Building2 : fallbackType === 'send' ? Send : Coins;
    const bgClass = fallbackType === 'building' ? 'bg-blue-500/10 text-blue-400' : fallbackType === 'send' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400';
    
    return (
      <div className={`${className} rounded-full ${bgClass} flex items-center justify-center overflow-hidden`}>
        <FallbackIcon className="w-2/3 h-2/3 opacity-80" />
      </div>
    );
  }

  // Determine the best alignment based on the flag code
  // Flags with important content on the left (hoist side) like AE, US, JO, PS
  const code = flagCode.trim().toLowerCase();
  let objectPosition = "center";
  if (["ae", "us", "jo", "ps", "dz", "kw", "om", "qa"].includes(code)) {
    objectPosition = "left center";
  } else if (["tr", "tn", "ly", "sa", "eg", "eu", "gb"].includes(code)) {
    objectPosition = "center";
  }

  return (
    <div className={`${className} rounded-full overflow-hidden border border-white/20 shadow-xl relative group/flag bg-zinc-950 flex-shrink-0 ring-1 ring-white/10`}>
      {/* 
        PREMIUM CIRCULAR LOGIC:
        1. object-cover fills the circle.
        2. scale-105 provides a very "low zoom" to avoid excessive cropping.
        3. Smart object-position ensures significant parts (like UAE red bar) are visible.
      */}
      <img 
        src={`https://flagcdn.com/w160/${code}.png`} 
        alt={name} 
        className="w-full h-full object-cover transition-all duration-500 group-hover/flag:scale-115"
        style={{ objectPosition }}
        onError={() => setError(true)}
      />
      
      {/* 
        3D Premium Overlay:
        - Inner shadow for depth.
        - Subtle shine for high-end look.
        - Outer subtle ring.
      */}
      <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_6px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 opacity-30 pointer-events-none rounded-full"></div>
    </div>
  );
}
