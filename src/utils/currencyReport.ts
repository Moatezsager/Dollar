import { METAL_IDS } from '../types/rates';
import { libyaDayKey } from './rateHistory';

export interface CurrencyReportInput {
  code: string;
  name: string;
  market: 'official' | 'parallel';
  price: number;
  lastUpdated?: string;
  lastChanged?: string;
  range: '24h' | '7d' | 'all';
  points: { time: string; value: number }[];
  amount: number | null;
  advanced: { ma30: number; support: number; resistance: number };
}

export function buildCurrencyReport(input: CurrencyReportInput, now = Date.now()) {
  if (!Number.isFinite(input.price) || input.price <= 0) throw new Error('لا يتوفر سعر صالح لإعداد التقرير.');
  const validTime = (value?: string) => {
    const time = Date.parse(value || '');
    return Number.isFinite(time) && time > 0 && time <= now ? new Date(time).toISOString() : null;
  };
  const byTime = new Map<string, { time: string; value: number }>();
  for (const point of input.points) {
    const time = validTime(point.time);
    if (time && Number.isFinite(point.value) && point.value > 0) byTime.set(time, { time, value: point.value });
  }
  let points = [...byTime.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (input.market === 'official') {
    const byDay = new Map<string, typeof points[number]>();
    for (const point of points) byDay.set(libyaDayKey(point.time), point);
    points = [...byDay.values()];
  }
  const daily = new Map<string, { day: string; first: number; last: number; low: number; high: number; avg: number; count: number }>();
  let low = Infinity, high = -Infinity, avg = 0;
  points.forEach((point, index) => {
    low = Math.min(low, point.value); high = Math.max(high, point.value);
    avg += (point.value - avg) / (index + 1);
    const day = libyaDayKey(point.time), row = daily.get(day);
    if (row) {
      row.last = point.value; row.low = Math.min(row.low, point.value); row.high = Math.max(row.high, point.value);
      row.count++; row.avg += (point.value - row.avg) / row.count;
    } else daily.set(day, { day, first: point.value, last: point.value, low: point.value, high: point.value, avg: point.value, count: 1 });
  });
  const first = points[0], last = points[points.length - 1];
  const change = points.length < 2 ? null : input.market === 'official'
    ? (Math.round(last.value * 10000) - Math.round(first.value * 10000)) / 10000
    : last.value - first.value;
  const isMetal = METAL_IDS.includes(input.code);
  const unit = !isMetal ? 'لكل وحدة من العملة' : /LIRA|MUJARA/.test(input.code) ? 'للقطعة' : 'لكل غرام';
  const conversion = input.amount !== null && Number.isFinite(input.amount) && input.amount >= 0 && Number.isFinite(input.amount * input.price)
    ? { amount: input.amount, total: input.amount * input.price } : null;
  const advanced = Object.values(input.advanced).every(value => Number.isFinite(value) && value > 0) &&
    input.advanced.support <= input.advanced.ma30 && input.advanced.ma30 <= input.advanced.resistance ? { ...input.advanced } : null;
  return {
    code: input.code, name: input.name, market: input.market, price: input.price, unit, isMetal,
    marketName: input.market === 'official' ? 'السوق الرسمي · المصرف المركزي' : 'السوق الموازي',
    decimals: input.market === 'official' ? 4 : ['EGP', 'TRY'].includes(input.code) ? 3 : 2,
    rangeLabel: input.range === 'all' ? 'كامل السجل المتاح' : input.market === 'official' ? 'آخر 7 أيام تقويمية' : input.range === '24h' ? 'آخر 24 ساعة' : 'آخر 7 أيام',
    generatedAt: new Date(now).toISOString(), lastUpdated: validTime(input.lastUpdated), lastChanged: validTime(input.lastChanged),
    points, days: [...daily.values()], first, last, low: points.length ? low : null, high: points.length ? high : null,
    avg: points.length ? avg : null, change, changePercent: change === null ? null : change / first.value * 100,
    conversion, advanced,
  };
}

export type CurrencyReport = ReturnType<typeof buildCurrencyReport>;
