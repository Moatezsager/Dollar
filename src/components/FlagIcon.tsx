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
      <div className={`${className} rounded-full flex items-center justify-center overflow-hidden border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)] relative group/flag bg-gradient-to-br from-yellow-100 via-yellow-500 to-yellow-700 flex-shrink-0`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.6)_0%,_transparent_60%)]"></div>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-2/3 h-2/3 relative z-10 text-white drop-shadow-md">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="url(#goldGradient)" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15.5 9.5C15.5 9.5 14 7 12 7C10 7 8.5 9.5 8.5 9.5M8.5 14.5C8.5 14.5 10 17 12 17C14 17 15.5 14.5 15.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="goldGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDE047" />
              <stop offset="1" stopColor="#A16207" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (isSilver) {
    return (
      <div className={`${className} rounded-full flex items-center justify-center overflow-hidden border border-slate-300/30 shadow-[0_0_15px_rgba(148,163,184,0.2)] relative group/flag bg-gradient-to-br from-slate-100 via-slate-400 to-slate-600 flex-shrink-0`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.7)_0%,_transparent_60%)]"></div>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-2/3 h-2/3 relative z-10 text-white drop-shadow-md">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="url(#silverGradient)" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7L15 12L12 17L9 12L12 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <defs>
            <linearGradient id="silverGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F8FAFC" />
              <stop offset="1" stopColor="#475569" />
            </linearGradient>
          </defs>
        </svg>
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
