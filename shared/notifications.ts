export const NOTIFICATION_ICON = '/icon-192.png';
export const NOTIFICATION_BADGE = '/icons/badge-72.png';
export const RATE_PUSH_INTERVAL = 30 * 60 * 1000;
export const RATE_PUSH_BATCH_DELAY = 60 * 1000;
export const DEFAULT_PRICE_THRESHOLD = 0.05;
export const IMPORTANT_CURRENCIES = ['USD', 'EUR', 'USD_CHECKS', 'USD_JBANK', 'GOLD_CAST_24', 'GOLD_CAST_18'];

export interface PriceSnapshot {
  parallel: Record<string, number>;
  official: Record<string, number>;
  lastUpdated: string;
}
export interface PriceChange {
  code: string; market: 'parallel' | 'official'; name: string; oldPrice: number; newPrice: number;
}

export function priceChanges(previous: PriceSnapshot, next: PriceSnapshot, threshold = DEFAULT_PRICE_THRESHOLD, terms: {id: string; name: string}[] = []): PriceChange[] {
  const changes: PriceChange[] = [];
  for (const market of ['parallel', 'official'] as const) {
    const codes = market === 'official' ? ['USD', 'EUR'] : IMPORTANT_CURRENCIES;
    for (const code of codes) {
      const oldPrice = previous[market]?.[code], newPrice = next[market]?.[code];
      const minimum = code.startsWith('GOLD') ? Math.max(threshold, oldPrice * 0.005) : threshold;
      if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= 0 || newPrice <= 0 || Math.abs(newPrice - oldPrice) + 1e-9 < minimum) continue;
      const fallback = ({USD: 'الدولار', EUR: 'اليورو', USD_CHECKS: 'الدولار بالصك', USD_JBANK: 'صكوك الجمهورية', GOLD_CAST_24: 'ذهب مسبوك 24', GOLD_CAST_18: 'ذهب مسبوك 18'} as Record<string, string>)[code] || code;
      changes.push({code, market, name: terms.find(term => term.id === code)?.name || fallback, oldPrice, newPrice});
    }
  }
  return changes;
}

export function priceDigest(changes: PriceChange[]) {
  return {
    title: 'ملخص تغيّرات الأسعار المهمة',
    body: changes.slice(0, 3).map(change => `${change.name} ${change.market === 'official' ? 'رسمي' : 'موازي'}: ${change.newPrice.toFixed(2)} د.ل`).join(' · ')
      + (changes.length > 3 ? ` · و${changes.length - 3} تغيّرات أخرى` : ''),
  };
}

export function tripoliTime(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'}).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return {hour: Number(part('hour')), day: `${part('year')}-${part('month')}-${part('day')}`};
}
export function isQuietTime(now = Date.now()) {
  const {hour} = tripoliTime(now);
  return hour < 8 || hour >= 22;
}

export function safeNotificationUrl(value: unknown, origin: string) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/', origin);
    return url.origin === origin && !url.username && !url.password ? url.href : origin + '/';
  } catch { return origin + '/'; }
}
