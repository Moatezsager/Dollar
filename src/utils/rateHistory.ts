import { HistoryPoint } from '../types/rates';

const libyaDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' });

export function formatLibyaDate(value: string | number) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? libyaDate.format(date) : 'غير متاح';
}

export function libyaDayKey(value: string | number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(libyaDate.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getRateHistory(history: HistoryPoint[], target: { code: string; market: 'official' | 'parallel' }) {
  const points = history.map(point => ({ time: point.time, value: Number(
    (target.market === 'official' ? point.ratesOfficial : point.ratesParallel)?.[target.code] ||
    (target.code === 'USD' ? target.market === 'official' ? point.usdOfficial : point.usdParallel : 0)
  ) })).filter(point => Number.isFinite(Date.parse(point.time)) && Date.parse(point.time) <= Date.now() && Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (target.market !== 'official') return points;
  // Merged history carries official quotes through intraday updates; retain the last available quote per Libya day.
  const days = new Map<string, typeof points[number]>();
  for (const point of points) days.set(libyaDayKey(point.time), point);
  return [...days.values()];
}
