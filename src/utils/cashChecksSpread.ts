import { HistoryPoint, Rates } from '../types/rates';
import { libyaDayKey } from './rateHistory';

export type SpreadRange = 1 | 7 | 30;
export type SpreadMetric = 'gap' | 'premium' | 'prices';
export const SPREAD_STALE_MS = 12 * 3600000;
export const SPREAD_REFERENCE_DAYS = 7;
export const SPREAD_MAX_AMOUNT = 1_000_000_000;
const DAY = 86400000;
const EPSILON = 0.00000001;

export interface SpreadPoint {
  time: number;
  cash: number;
  checks: number;
  gap: number;
  premium: number;
}

export interface SpreadBin {
  time: number;
  cash: number | null;
  checks: number | null;
  gap: number | null;
  premium: number | null;
  count: number;
}

export function spreadNumber(value: number, signed = false) {
  const cleaned = Math.abs(value) < EPSILON ? 0 : value;
  return `${signed && cleaned > 0 ? '+' : ''}${new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(cleaned)}`;
}

export function getSpreadHistory(history: HistoryPoint[], now = Date.now()): SpreadPoint[] {
  const byTime = new Map<number, HistoryPoint>();
  for (const point of history) {
    const time = Date.parse(point?.time);
    if (Number.isFinite(time) && time <= now) byTime.set(time, point);
  }
  const points: SpreadPoint[] = [];
  for (const [time, point] of byTime) {
    const observed = point.observed?.parallel;
    // Carried values and bank-specific check aliases cannot establish a shared cash/check quote.
    if (!Array.isArray(observed) || !observed.includes('USD') || !observed.includes('USD_CHECKS')) continue;
    const cash = point.ratesParallel?.USD, checks = point.ratesParallel?.USD_CHECKS;
    if (typeof cash !== 'number' || typeof checks !== 'number' || !Number.isFinite(cash) || !Number.isFinite(checks) || cash <= 0 || checks <= 0) continue;
    const gap = checks - cash, premium = gap / cash * 100;
    if (Number.isFinite(gap) && Number.isFinite(premium)) points.push({ time, cash, checks, gap, premium });
  }
  return points.sort((a, b) => a.time - b.time);
}

export function compareSpreadAmount(point: SpreadPoint | null, input: string) {
  const amount = Number(input);
  if (!point || !input.trim() || !Number.isFinite(amount) || amount < 0 || amount > SPREAD_MAX_AMOUNT
    || !Number.isFinite(point.cash) || !Number.isFinite(point.checks) || point.cash <= 0 || point.checks <= 0) return null;
  const cash = amount * point.cash, checks = amount * point.checks, gap = amount * (point.checks - point.cash);
  if (![cash, checks, gap].every(value => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 10000)) return null;
  return { amount, cash, checks, gap };
}

function meanBin(time: number, points: SpreadPoint[]): SpreadBin {
  const result: SpreadBin = { time, cash: null, checks: null, gap: null, premium: null, count: points.length };
  if (!points.length) return result;
  for (const key of ['cash', 'checks', 'gap', 'premium'] as const) {
    let mean = 0;
    points.forEach((point, index) => { mean += (point[key] - mean) / (index + 1); });
    result[key] = Math.abs(mean) < EPSILON ? 0 : mean;
  }
  return result;
}

function percentile(values: number[], fraction: number) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * fraction, lower = Math.floor(index), weight = index - lower;
  return ordered[lower] * (1 - weight) + ordered[Math.ceil(index)] * weight;
}

export function buildSpreadModel(history: HistoryPoint[], rates: Rates | null, range: SpreadRange, now = Date.now()) {
  const points = getSpreadHistory(history, now), latest = points.at(-1) || null;
  const todayStart = Date.parse(`${libyaDayKey(now)}T00:00:00+02:00`);
  const start = todayStart - (range - 1) * DAY;
  const selected = points.filter(point => point.time >= start);
  const days = new Map<number, SpreadPoint[]>();
  for (const point of selected) {
    const day = Date.parse(`${libyaDayKey(point.time)}T00:00:00+02:00`);
    const values = days.get(day) || [];
    values.push(point); days.set(day, values);
  }
  const daily = [...days].map(([day, values]) => meanBin(day, values));
  const step = range === 1 ? 3600000 : DAY;
  const groups = range === 1 ? new Map<number, SpreadPoint[]>() : days;
  if (range === 1) for (const point of selected) {
    const hour = todayStart + Math.floor((point.time - todayStart) / step) * step;
    const values = groups.get(hour) || []; values.push(point); groups.set(hour, values);
  }
  const bins = Array.from({ length: range === 1 ? Math.floor((now - todayStart) / step) + 1 : range },
    (_, index) => meanBin(start + index * step, groups.get(start + index * step) || []));
  const previousDays = daily.filter(day => latest && libyaDayKey(day.time) < libyaDayKey(latest.time));
  const reference = previousDays.length >= SPREAD_REFERENCE_DAYS ? {
    days: previousDays.length,
    gap: percentile(previousDays.map(day => day.gap!), 0.5),
    premium: percentile(previousDays.map(day => day.premium!), 0.5),
    lower: percentile(previousDays.map(day => day.premium!), 0.25),
    upper: percentile(previousDays.map(day => day.premium!), 0.75),
  } : null;
  const position = !reference || !latest ? 'insufficient' : latest.premium > reference.upper + EPSILON ? 'above'
    : latest.premium < reference.lower - EPSILON ? 'below' : 'within';
  const currentCash = rates?.parallel?.USD, currentChecks = rates?.parallel?.USD_CHECKS;
  const pending = !!latest && typeof currentCash === 'number' && typeof currentChecks === 'number'
    && currentCash > 0 && currentChecks > 0 && Number.isFinite(currentCash) && Number.isFinite(currentChecks)
    && (Math.abs(latest.cash - currentCash) > EPSILON || Math.abs(latest.checks - currentChecks) > EPSILON);
  const first = selected[0] || null, last = selected.at(-1) || null;
  let meanGap = 0;
  daily.forEach((day, index) => { meanGap += (day.gap! - meanGap) / (index + 1); });
  return {
    latest, first, last, selected, bins, reference, position, pending, start,
    stale: !!latest && now - latest.time > SPREAD_STALE_MS,
    observedDays: days.size, meanGap: daily.length ? meanGap : null,
    min: selected.length ? Math.min(...selected.map(point => point.gap)) : null,
    max: selected.length ? Math.max(...selected.map(point => point.gap)) : null,
    change: first && last && first.time !== last.time ? last.gap - first.gap : null,
  };
}

export function spreadReading(model: ReturnType<typeof buildSpreadModel>) {
  const { latest, first, last, reference, position } = model;
  if (!latest) return { headline: 'بانتظار لقطة مشتركة للسعرين', detail: 'ما عندناش رصد محفوظ يجمع الكاش والصكوك مع بعض. ما نحسبوش فرق من سعرين مسجّلين في أوقات مختلفة.', movement: '', priceMovement: '', comparison: '' };
  const gap = Math.abs(latest.gap) < EPSILON ? 0 : latest.gap;
  const headline = gap === 0 ? 'الكاش والصكوك بنفس السعر في آخر رصد'
    : `الصكوك ${gap > 0 ? 'أعلى' : 'أقل'} من الكاش بـ ${spreadNumber(Math.abs(gap))} د.ل للدولار`;
  const amountGap = Math.abs(gap) * 1000;
  const detail = !Number.isFinite(amountGap) ? 'المقارنة تخص دولارًا واحدًا؛ لا يتوفر حساب صالح لمثال بمبلغ أكبر.'
    : gap === 0 ? 'على مبلغ 1,000 دولار، ما فيش فرق في المقابل بين الكاش والصكوك، قبل الرسوم.'
    : `يعني على 1,000 دولار، المقابل بالصكوك ${gap > 0 ? 'يزيد' : 'يقل'} ${spreadNumber(amountGap)} د.ل عن الكاش، قبل الرسوم.`;
  let movement = 'نحتاج رصدين داخل الفترة لنعرف كيف تغيّرت الفجوة.';
  let priceMovement = '';
  if (first && last && first.time !== last.time) {
    priceMovement = [{ name: 'الكاش', change: last.cash - first.cash }, { name: 'الصكوك', change: last.checks - first.checks }]
      .map(item => `سعر ${item.name} ${Math.abs(item.change) < EPSILON ? 'لم يتغيّر' : `${item.change > 0 ? 'زاد' : 'نقص'} ${spreadNumber(Math.abs(item.change))} د.ل`}`)
      .join('، و') + ' بين أول وآخر رصد.';
    const firstGap = Math.abs(first.gap) < EPSILON ? 0 : first.gap;
    const lastGap = Math.abs(last.gap) < EPSILON ? 0 : last.gap;
    const sizeChange = Math.abs(lastGap) - Math.abs(firstGap);
    if (firstGap * lastGap < 0) {
      movement = `ترتيب السعرين تبدّل: ${firstGap > 0 ? 'الصك' : 'الكاش'} كان أعلى بـ ${spreadNumber(Math.abs(firstGap))} د.ل، وفي آخر رصد ${lastGap > 0 ? 'الصك' : 'الكاش'} أعلى بـ ${spreadNumber(Math.abs(lastGap))} د.ل للدولار.`;
    } else if (Math.abs(sizeChange) < EPSILON) {
      const varied = model.min !== null && model.max !== null && model.max - model.min > EPSILON;
      movement = varied
        ? `الفرق رجع لقيمة البداية (${spreadNumber(Math.abs(lastGap))} د.ل)، لكنه تحرّك بين ${spreadNumber(model.min!, true)} و${spreadNumber(model.max!, true)} د.ل خلال الرصد.`
        : `ما رصدناش تغيّر في الفجوة بين أول وآخر رصد (${spreadNumber(Math.abs(lastGap))} د.ل للدولار).`;
    } else {
      movement = `الفجوة ${sizeChange > 0 ? 'كبرت' : 'ضاقت'} بـ ${spreadNumber(Math.abs(sizeChange))} د.ل؛ من ${spreadNumber(Math.abs(firstGap))} إلى ${spreadNumber(Math.abs(lastGap))} د.ل للدولار، بين أول وآخر رصد.`;
    }
  }
  const comparison = reference
    ? `نسبة الفجوة ${position === 'above' ? 'أعلى من' : position === 'below' ? 'أقل من' : 'داخل'} النطاق الأوسط للأيام السابقة (${spreadNumber(reference.lower, true)}% إلى ${spreadNumber(reference.upper, true)}%)، حسب متوسطات ${reference.days} يوم رصد، دون يوم آخر رصد.`
    : `المقارنة تحتاج ${SPREAD_REFERENCE_DAYS} أيام رصد سابقة ضمن الفترة، دون يوم آخر رصد. السجل المتاح غير كافٍ للحكم.`;
  return { headline, detail, movement, priceMovement, comparison };
}
