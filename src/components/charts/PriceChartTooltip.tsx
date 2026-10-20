import React from 'react';
import { formatLibyaDate } from '../../utils/rateHistory';

interface Props {
  active?: boolean;
  payload?: readonly { value?: unknown; payload?: { time?: unknown } }[];
  caption: string;
  unit: string;
  color: string;
  decimals?: number;
  daily?: boolean;
}
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function PriceChartTooltip({ active, payload, caption, unit, color, decimals = 2, daily = false }: Props) {
  const value = payload?.[0]?.value, rawTime = payload?.[0]?.payload?.time;
  const time = typeof rawTime === 'number' ? rawTime : typeof rawTime === 'string' ? Date.parse(rawTime) : NaN;
  const date = new Date(time);
  if (!active || typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(date.getTime())) return null;
  return <div className="price-chart-tooltip" dir="rtl">
    <time dateTime={date.toISOString()} dir="ltr">{formatLibyaDate(time)}{!daily && ` · ${clock.format(date)}`}</time>
    <span><i style={{ background: color }} aria-hidden="true" />{caption}</span>
    <div><strong dir="ltr">{value.toFixed(decimals)}</strong><span>{unit}</span></div>
  </div>;
}
