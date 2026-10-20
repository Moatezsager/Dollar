import { BlockList, isIP } from 'node:net';
import { UAParser } from 'ua-parser-js';

export function describeVisitor(ua: string) {
  const parsed = new UAParser(ua.slice(0, 500)).getResult();
  const bot = /bot|crawler|spider|headless/i.test(ua);
  const android = parsed.os.name === 'Android';
  const reduced = android && /Android 10; K\)/.test(ua);
  const model = reduced ? '' : parsed.device.model || '';
  const deviceType = bot ? 'Bot' : parsed.device.type === 'tablet' ? 'Tablet'
    : parsed.device.type === 'mobile' ? 'Mobile' : parsed.device.type ? 'Other'
    : /Windows|macOS|Linux|Chrome OS/.test(parsed.os.name || '') ? 'Desktop' : 'Unknown';
  return {
    deviceType,
    deviceName: bot ? 'روبوت / أداة آلية' : [parsed.device.vendor, model].filter(Boolean).join(' ') ||
      (android ? 'جهاز Android' : deviceType === 'Desktop' ? 'كمبيوتر' : 'جهاز غير محدد'),
    deviceModel: model,
    os: reduced ? 'Android (الإصدار غير متاح)' : parsed.os.name === 'Windows' && parsed.os.version === '10' ? 'Windows 10 / 11'
      : [parsed.os.name, parsed.os.version].filter(Boolean).join(' ') || 'غير محدد',
    browser: [parsed.browser.name, parsed.browser.major].filter(Boolean).join(' ') || 'غير محدد'
  };
}

// Match the Web app's single trusted reverse-proxy hop, skipping internal private proxy add-ons (Render/Cloudflare)
export function visitorIp(forwarded: unknown, remote: string = '', directHeader?: unknown): string {
  // 1. Direct trusted proxy header if supplied (e.g. CF-Connecting-IP, X-Real-IP)
  if (typeof directHeader === 'string' && directHeader.trim()) {
    const direct = directHeader.split(',')[0].trim().replace(/^::ffff:(?=\d+\.)/i, '');
    if (isIP(direct)) {
      const v = isIP(direct);
      const isPriv = v === 4 ? privateRanges.check(direct, 'ipv4') : (!globalV6.check(direct, 'ipv6') || privateRanges.check(direct, 'ipv6'));
      if (!isPriv) return direct;
    }
  }

  // 2. Comma-separated X-Forwarded-For chain:
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const list = forwarded.split(',').map(s => s.trim().replace(/^::ffff:(?=\d+\.)/i, '')).filter(s => isIP(s));
    if (list.length > 0) {
      // Find the rightmost public (non-private) IP in the chain to avoid internal load-balancer hops (Render/K8s/Docker)
      const publicIp = [...list].reverse().find(ip => {
        const v = isIP(ip);
        if (v === 4) return !privateRanges.check(ip, 'ipv4');
        return globalV6.check(ip, 'ipv6') && !privateRanges.check(ip, 'ipv6');
      });
      if (publicIp) return publicIp;
      // If all are private or local, return the rightmost valid IP
      return list.at(-1)!;
    }
  }

  // 3. Fallback to clean remoteAddress
  const cleanRemote = String(remote || '').trim().replace(/^::ffff:(?=\d+\.)/i, '');
  return isIP(cleanRemote) ? cleanRemote : '';
}

const privateRanges = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) privateRanges.addSubnet(address, prefix, 'ipv4');
privateRanges.addSubnet('2001:db8::', 32, 'ipv6');
privateRanges.addSubnet('2001::', 23, 'ipv6');
privateRanges.addSubnet('2002::', 16, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

const LOCATION_ARABIC: Record<string, string> = {
  'Libya': 'ليبيا', 'Tripoli': 'طرابلس', 'Benghazi': 'بنغازي', 'Misrata': 'مصراتة',
  'Zawiya': 'الزاوية', 'Al Bayda': 'البيضاء', 'Tobruk': 'طبرق', 'Sabha': 'سبها',
  'Sirte': 'سرت', 'Zliten': 'زليتن', 'Tunisia': 'تونس', 'Egypt': 'مصر',
  'Turkey': 'تركيا', 'United States': 'الولايات المتحدة', 'United Kingdom': 'المملكة المتحدة',
  'Germany': 'ألمانيا', 'Italy': 'إيطاليا', 'France': 'فرنسا', 'United Arab Emirates': 'الإمارات',
  'Saudi Arabia': 'السعودية', 'Jordan': 'الأردن'
};

export type VisitorLocation = { location: string; locationStatus: 'approximate' | 'local' | 'unavailable' | 'limited' };
const unavailable: VisitorLocation = { location: 'غير متاح', locationStatus: 'unavailable' };
const limited: VisitorLocation = { location: 'مؤجل بسبب حد الطلبات', locationStatus: 'limited' };
const cache = new Map<string, { value: VisitorLocation; expires: number }>();
const pending = new Map<string, Promise<VisitorLocation>>();
let minuteStart = 0, minuteCount = 0, dayStart = 0, dayCount = 0, blockedUntil = 0;
const DAY = 86400000;

export async function locateVisitor(ip: string): Promise<VisitorLocation> {
  const version = isIP(ip);
  if (!version) return unavailable;
  if (version === 4 ? privateRanges.check(ip, 'ipv4') : !globalV6.check(ip, 'ipv6') || privateRanges.check(ip, 'ipv6')) {
    return { location: 'شبكة محلية / عنوان غير عام', locationStatus: 'local' };
  }
  const now = Date.now(), saved = cache.get(ip);
  if (saved && saved.expires > now) return saved.value;
  if (pending.has(ip)) return pending.get(ip)!;
  if (now - minuteStart >= 60000) { minuteStart = now; minuteCount = 0; }
  if (now - dayStart >= DAY) { dayStart = now; dayCount = 0; }
  // Per-process budget; provider 429 backoff also protects quotas shared across restarts/instances.
  if (pending.size >= 2 || minuteCount >= 20 || dayCount >= 900 || now < blockedUntil) return limited;
  minuteCount++; dayCount++;
  const request = (async () => {
    let value = unavailable;
    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,city`, {
        signal: AbortSignal.timeout(4000), redirect: 'error', headers: { 'User-Agent': 'Dollar-Price-Web/1.0' }
      });
      if (response.status === 429) blockedUntil = Date.now() + DAY;
      if (response.ok) {
        const data = await response.json();
        const parts = [data.country, data.city]
          .filter(part => typeof part === 'string' && part.trim())
          .map(part => {
            const raw = part.trim().slice(0, 80);
            return LOCATION_ARABIC[raw] ? `${LOCATION_ARABIC[raw]} (${raw})` : raw;
          });
        if (data.success === true && parts.length) value = { location: [...new Set(parts)].join('، '), locationStatus: 'approximate' };
      }
    } catch { /* Location failure must not interrupt live prices or leave a pending label. */ }
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(ip, { value, expires: Date.now() + (value.locationStatus === 'approximate' ? DAY : 15 * 60000) });
    return value;
  })();
  pending.set(ip, request);
  try { return await request; } finally { pending.delete(ip); }
}
