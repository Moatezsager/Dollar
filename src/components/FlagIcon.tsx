import React, { useState } from 'react';
import { Coins, Building2, Send } from 'lucide-react';

interface FlagIconProps {
  flagCode?: string;
  name: string;
  className?: string;
  fallbackType?: 'coins' | 'building' | 'send';
  rounded?: 'xl' | '2xl' | 'full' | 'lg';
}

/**
 * Ultra-refined Flag & Metal Token Icon with luxury minted borders,
 * dimensional metallic bezel, and smart alignment.
 */
export function FlagIcon({ 
  flagCode, 
  name, 
  className = "w-5 h-5", 
  fallbackType = 'coins',
  rounded = 'xl'
}: FlagIconProps) {
  const [error, setError] = useState(false);
  const isValidFlag = flagCode && flagCode.trim() !== "" && flagCode !== "undefined" && flagCode !== "null";

  const isGold = flagCode?.toLowerCase() === 'gold' || name.includes('ذهب');
  const isSilver = flagCode?.toLowerCase() === 'silver' || name.includes('فضة');

  const isFull = className.includes('rounded-full') || rounded === 'full';
  const radiusClass = isFull ? 'rounded-full' : rounded === '2xl' ? 'rounded-2xl' : rounded === 'lg' ? 'rounded-lg' : 'rounded-xl';

  if (isGold) {
    return (
      <div 
        className={`${className} ${radiusClass} overflow-hidden flex items-center justify-center relative group/flag flex-shrink-0 bg-gradient-to-br from-amber-300/35 via-amber-500/20 to-amber-950/70 border border-amber-400/60 shadow-[0_2px_12px_rgba(245,158,11,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)] ring-1 ring-amber-300/30 transition-transform duration-200`}
      >
        {/* Minted Coin Gloss Arc */}
        <div className={`absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 opacity-80 pointer-events-none ${radiusClass}`} />
        <div className="absolute inset-0.5 rounded-[inherit] border border-amber-300/20 pointer-events-none" />
        <Coins className="w-[54%] h-[54%] text-amber-300 drop-shadow-[0_2px_6px_rgba(217,119,6,0.85)] relative z-10" />
      </div>
    );
  }

  if (isSilver) {
    return (
      <div 
        className={`${className} ${radiusClass} overflow-hidden flex items-center justify-center relative group/flag flex-shrink-0 bg-gradient-to-br from-slate-100/35 via-slate-300/20 to-slate-900/80 border border-slate-300/60 shadow-[0_2px_12px_rgba(203,213,225,0.25),inset_0_1px_2px_rgba(255,255,255,0.5)] ring-1 ring-white/30 transition-transform duration-200`}
      >
        {/* Silver Ingot Gloss Arc */}
        <div className={`absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/20 opacity-80 pointer-events-none ${radiusClass}`} />
        <div className="absolute inset-0.5 rounded-[inherit] border border-white/25 pointer-events-none" />
        <Coins className="w-[54%] h-[54%] text-slate-100 drop-shadow-[0_2px_6px_rgba(148,163,184,0.8)] relative z-10" />
      </div>
    );
  }

  if (!isValidFlag || error) {
    const FallbackIcon = fallbackType === 'building' ? Building2 : fallbackType === 'send' ? Send : Coins;
    const bgClass = fallbackType === 'building' 
      ? 'bg-gradient-to-br from-cyan-400/25 via-blue-600/15 to-slate-900/80 border border-cyan-400/40 text-cyan-300 shadow-[0_2px_12px_rgba(6,182,212,0.25),inset_0_1px_2px_rgba(255,255,255,0.3)] ring-1 ring-cyan-400/25' 
      : fallbackType === 'send' 
      ? 'bg-gradient-to-br from-purple-400/25 via-indigo-600/15 to-slate-900/80 border border-purple-400/40 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.25),inset_0_1px_2px_rgba(255,255,255,0.3)] ring-1 ring-purple-400/25' 
      : 'bg-gradient-to-br from-emerald-400/25 via-emerald-600/15 to-slate-900/80 border border-emerald-400/40 text-emerald-300 shadow-[0_2px_12px_rgba(16,185,129,0.25),inset_0_1px_2px_rgba(255,255,255,0.3)] ring-1 ring-emerald-400/25';
    
    return (
      <div className={`${className} ${radiusClass} ${bgClass} flex items-center justify-center overflow-hidden relative group/flag flex-shrink-0 transition-transform duration-200`}>
        <div className={`absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent opacity-70 pointer-events-none ${radiusClass}`} />
        <div className="absolute inset-0.5 rounded-[inherit] border border-white/15 pointer-events-none" />
        <FallbackIcon className="w-[52%] h-[52%] relative z-10 drop-shadow-sm" />
      </div>
    );
  }

  // Determine the best alignment based on the flag code
  const code = flagCode.trim().toLowerCase();
  let objectPosition = "center";
  if (["ae", "us", "jo", "ps", "dz", "kw", "om", "qa"].includes(code)) {
    objectPosition = "left center";
  } else if (["tr", "tn", "ly", "sa", "eg", "eu", "gb"].includes(code)) {
    objectPosition = "center";
  }

  return (
    <div className={`${className} ${radiusClass} overflow-hidden border border-white/25 shadow-[0_2px_10px_rgba(0,0,0,0.55),inset_0_1px_1.5px_rgba(255,255,255,0.35)] relative group/flag bg-slate-950 flex-shrink-0 ring-1 ring-white/15 transition-transform duration-200`}>
      <img 
        src={`https://flagcdn.com/w160/${code}.png`} 
        alt={name} 
        className="w-full h-full object-cover transition-all duration-300 group-hover/flag:scale-110"
        style={{ objectPosition }}
        onError={() => setError(true)}
      />
      
      {/* Precision Minted Glass Reflection & Depth */}
      <div className={`absolute inset-0 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),inset_0_-1.5px_3px_rgba(0,0,0,0.6)] pointer-events-none ${radiusClass}`} />
      <div className={`absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/20 opacity-50 pointer-events-none ${radiusClass}`} />
      <div className="absolute inset-0.5 rounded-[inherit] border border-white/10 pointer-events-none" />
    </div>
  );
}
