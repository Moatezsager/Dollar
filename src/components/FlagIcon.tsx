import React, { useState } from 'react';
import { Coins, Building2, Send } from 'lucide-react';

interface FlagIconProps {
  flagCode?: string;
  name: string;
  className?: string;
  fallbackType?: 'coins' | 'building' | 'send';
  rounded?: 'xl' | '2xl' | 'full' | 'lg';
}

const flagAliases: Record<string, string> = {
  usd: 'us', eur: 'eu', gbp: 'gb', uk: 'gb', cad: 'ca', aud: 'au',
  jpy: 'jp', cny: 'cn', chf: 'ch', try: 'tr', tnd: 'tn', egp: 'eg',
  aed: 'ae', sar: 'sa', lyd: 'ly',
};

export function FlagIcon({
  flagCode, name, className = 'w-5 h-5', fallbackType = 'coins', rounded = 'lg',
}: FlagIconProps) {
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const normalized = (flagCode || '').trim().toLowerCase();
  const code = flagAliases[normalized] || normalized;
  const isGold = normalized === 'gold' || name.includes('ذهب');
  const isSilver = normalized === 'silver' || name.includes('فضة');
  const isFlag = /^[a-z]{2}$/.test(code) && code !== failedCode && !isGold && !isSilver;

  if (!isFlag) {
    const Icon = isGold || isSilver ? Coins : fallbackType === 'building' ? Building2 : fallbackType === 'send' ? Send : Coins;
    const tone = isGold ? 'text-amber-300 bg-amber-500/10' : isSilver ? 'text-slate-200 bg-slate-500/10' : 'text-emerald-400 bg-emerald-500/10';
    return (
      <div role="img" aria-label={name} title={name}
        className={`flag-fallback ${className} ${tone} ${rounded === 'full' ? 'rounded-full' : 'rounded-lg'} inline-flex shrink-0 items-center justify-center border border-white/10`}>
        <Icon className="h-[60%] w-[60%]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`currency-flag ${className} inline-flex shrink-0 items-center justify-center`} title={name}>
      <img src={`https://flagcdn.com/w160/${code}.png`} alt={name}
        className="currency-flag-image block h-auto w-full max-h-full max-w-full object-contain"
        decoding="async" onError={() => setFailedCode(code)} />
    </div>
  );
}
