export interface WeeklyItem {
  id: string; name: string; code: string; category: string; unit: string;
  open: number; high: number; low: number; close: number;
  change: number | null; changePct: number | null; days: number; observations: number; previousClose?: number;
  firstAt: string; lastAt: string;
}
export interface WeeklyHarvestData {
  title: string; dateRange: string; start: string; end: string;
  generatedAt: string; notes: string[]; items: WeeklyItem[];
  observationCount: number; daysObserved: number; overallDirection: 'up' | 'down' | 'stable'; biggestMover: WeeklyItem | null;
}
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' });
export function harvestNumber(value: number, code = '') {
  const precise = code.startsWith('OFFICIAL_') || code === 'EGP' || (value !== 0 && Math.abs(value) < 0.01);
  return value.toLocaleString('en-US', { minimumFractionDigits: precise ? 4 : 2, maximumFractionDigits: precise ? 4 : 3 });
}
export function harvestDirection(items: WeeklyItem[]): WeeklyHarvestData['overallDirection'] {
  const up = items.filter(item => item.changePct !== null && item.changePct > 0).length;
  const down = items.filter(item => item.changePct !== null && item.changePct < 0).length;
  const stable = items.filter(item => item.changePct === 0).length;
  return up > Math.max(down, stable) ? 'up' : down > Math.max(up, stable) ? 'down' : 'stable';
}
export function harvestNotes(items: WeeklyItem[]): string[] {
  const cash = items.find(item => item.id === 'USD'), checks = items.find(item => item.id === 'USD_CHECKS');
  const movement = (item: WeeklyItem) => item.change === null ? `${item.name}: لا يكفي الرصد لحساب التغير` :
    item.change === 0 ? `${item.name} دون تغير بين أول وآخر رصد` : `${item.name} ${item.change > 0 ? 'ارتفع' : 'تراجع'} ${Math.abs(item.changePct!).toFixed(2)}%`;
  const notes: string[] = [];
  if (cash) notes.push(`${movement(cash)}؛ نطاق الفترة ${harvestNumber(cash.low, cash.id)} إلى ${harvestNumber(cash.high, cash.id)} د.ل.`);
  if (checks && cash && Date.parse(checks.lastAt) === Date.parse(cash.lastAt)) {
    const startGap = checks.open - cash.open, endGap = checks.close - cash.close;
    const diff = Number((Math.abs(endGap) - Math.abs(startGap)).toFixed(6));
    notes.push(checks.change === null || cash.change === null || Date.parse(checks.firstAt) !== Date.parse(cash.firstAt)
      ? `فارق الصكوك عن الكاش عند آخر رصد ${harvestNumber(Math.abs(endGap), 'USD_CHECKS')} د.ل؛ تعذرت مقارنة اتجاهه دون رصد متزامن.`
      : startGap * endGap < 0
        ? `الصكوك انتقلت من ${startGap > 0 ? 'أعلى' : 'أقل'} من الكاش بـ ${harvestNumber(Math.abs(startGap))} إلى ${endGap > 0 ? 'أعلى' : 'أقل'} بـ ${harvestNumber(Math.abs(endGap))} د.ل.`
        : `فارق الصكوك عن الكاش ${diff === 0 ? 'بقي دون تغير' : diff < 0 ? 'تقلّص' : 'اتسع'} من ${harvestNumber(Math.abs(startGap), 'USD_CHECKS')} إلى ${harvestNumber(Math.abs(endGap), 'USD_CHECKS')} د.ل${endGap < 0 ? '؛ الصكوك أقل من الكاش' : ''}.`);
  } else if (checks) notes.push(`${movement(checks)}.`);
  const metals = ['GOLD_SCRAP_18', 'GOLD_SCRAP_21', 'GOLD_CAST_24', 'SILVER_CAST_1000']
    .map(id => items.find(item => item.id === id)).filter((item): item is WeeklyItem => !!item);
  if (metals.length) {
    const labels: Record<string, string> = { GOLD_SCRAP_18: 'ذهب 18', GOLD_SCRAP_21: 'ذهب 21', GOLD_CAST_24: 'ذهب 24', SILVER_CAST_1000: 'الفضة' };
    notes.push(`المعادن: ${metals.map(item => `${labels[item.id]} ${item.changePct === null ? 'رصد محدود' : item.changePct === 0 ? 'ثابت' : `${item.changePct > 0 ? '↑ +' : '↓ −'}${Math.abs(item.changePct).toFixed(2)}%`}`).join('، ')}.`);
  }
  return notes.slice(0, 3);
}
export function harvestSocialCaption(data: WeeklyHarvestData): string {
  const main = data.items.filter(item => ['USD', 'USD_CHECKS', 'EUR'].includes(item.id));
  const prices = main.map(item => `${item.name}: ${harvestNumber(item.close, item.id)} د.ل${item.changePct === null ? '' : ` (${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%)`}`);
  const mover = data.biggestMover;
  const week = dayFormat.format(new Date(Date.parse(data.end) - 86400000));
  return [`📊 مؤشر الدينار | حصاد الأسبوع`, `🗓 ${data.dateRange} · طرابلس`, ...prices,
    `أكبر متحرك: ${mover ? `${mover.name} ${mover.changePct! > 0 ? '+' : ''}${mover.changePct!.toFixed(2)}%` : 'لا تتوفر مقارنة كافية'}`,
    '', `تيليجرام: https://t.me/libya_index_dollar`, `فيسبوك: https://www.facebook.com/profile.php?id=61593953519936`, `https://dollar-price-qp14.onrender.com/weekly-report/${week}`].join('\n');
}
export function harvestWindow(now = new Date()) {
  const day = dayFormat.format(now);
  const friday = new Date(`${day}T12:00:00+02:00`).getUTCDay();
  const end = new Date(Date.parse(`${day}T00:00:00+02:00`) - ((friday - 5 + 7) % 7) * 86400000 + 86400000);
  return { start: new Date(end.getTime() - 7 * 86400000).toISOString(), end: end.toISOString() };
}
const definitions = [
  ['USD', 'دولار كاش', 'USD', 'السوق الموازي', 'لكل دولار'],
  ['USD_CHECKS', 'دولار صكوك', 'USD', 'السوق الموازي', 'لكل دولار'],
  ['EUR', 'يورو', 'EUR', 'السوق الموازي', 'لكل يورو'],
  ['GBP', 'جنيه إسترليني', 'GBP', 'السوق الموازي', 'لكل جنيه'],
  ['TND', 'دينار تونسي', 'TND', 'السوق الموازي', 'لكل دينار'],
  ['EGP', 'جنيه مصري', 'EGP', 'السوق الموازي', 'لكل جنيه'],
  ['USD_TR', 'حوالات تركيا', 'USD', 'الحوالات', 'لكل دولار'],
  ['USD_AE', 'حوالات دبي', 'USD', 'الحوالات', 'لكل دولار'],
  ['USD_CN', 'حوالات الصين', 'USD', 'الحوالات', 'لكل دولار'],
  ['GOLD_SCRAP_18', 'ذهب كسر 18', '18K', 'المعادن', 'للجرام'],
  ['GOLD_SCRAP_21', 'ذهب كسر 21', '21K', 'المعادن', 'للجرام'],
  ['GOLD_CAST_24', 'ذهب مسبوك 24', '24K', 'المعادن', 'للجرام'],
  ['GOLD_LIRA_8G', 'ليرة ذهب', '8G', 'المعادن', 'للقطعة · 8 جرام'],
  ['SILVER_CAST_1000', 'مسبوك فضة', '1000', 'المعادن', 'للجرام'],
];
type Observation = { recorded_at: string; rates: Record<string, number>; usd?: number };
export function buildWeeklyHarvest(parallel: Observation[], _official: Observation[], metals: Observation[], now = new Date(), previous: Observation[] = [], previousMetals: Observation[] = []): WeeklyHarvestData {
  const { start, end } = harvestWindow(now);
  const inWindow = (rows: Observation[]) => rows.filter(row => row.recorded_at && Date.parse(row.recorded_at) >= Date.parse(start) && Date.parse(row.recorded_at) < Date.parse(end) &&
    definitions.some(([id]) => { const value = row.rates?.[id] ?? (id === 'USD' ? row.usd : undefined); return typeof value === 'number' && Number.isFinite(value) && value > 0; }))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  const p = inWindow(parallel), m = inWindow(metals);
  const items: WeeklyItem[] = [];
  for (const [id, name, code, category, unit] of definitions) {
    const key = id;
    // Each category has one authoritative source table. Never substitute a legacy value from another market.
    const rows = category === 'المعادن' ? m : p;
    const readings = rows.map(row => ({ time: row.recorded_at, value: row.rates?.[key] ?? (key === 'USD' ? row.usd : undefined) }))
      .filter((entry): entry is { time: string; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0);
    // A corrected row can share the same observation time. The later database row is authoritative.
    const values = [...new Map(readings.map(entry => [entry.time, entry])).values()];
    if (!values.length) continue;
    const priorRows = [...(category === 'المعادن' ? previousMetals : previous)]
      .filter(row => Date.parse(row.recorded_at) < Date.parse(start) && Date.parse(row.recorded_at) >= Date.parse(start) - 7 * 86400000)
      .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at))
      .map(row => ({ row, value: row.rates?.[key] ?? (key === 'USD' ? row.usd : undefined) }))
      .filter((entry): entry is { row: Observation; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0);
    const previousValues = priorRows.map(entry => entry.value), priorRow = priorRows.at(-1)?.row;
    const days = new Set(values.map(entry => dayFormat.format(new Date(entry.time)))).size;
    const open = previousValues.at(-1) ?? values[0].value, close = values[values.length - 1].value;
    const change = values.length > 1 || previousValues.length > 0 ? close - open : null;
    items.push({ id, name, code, category, unit, open, close, high: Math.max(open, ...values.map(v => v.value)), low: Math.min(open, ...values.map(v => v.value)),
      change, changePct: change === null ? null : change / open * 100, days, observations: values.length,
      ...(previousValues.length ? { previousClose: previousValues[previousValues.length - 1] } : {}),
      firstAt: priorRow?.recorded_at || values[0].time, lastAt: values[values.length - 1].time });
  }
  const movers = items.filter(item => item.changePct !== null);
  const biggestMover = movers.reduce<WeeklyItem | null>((best, item) => !best || Math.abs(item.changePct!) > Math.abs(best.changePct!) ? item : best, null);
  const date = (value: string | number) => new Date(value).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'long', year: 'numeric' });
  return { title: 'حصاد الأسبوع', dateRange: `${date(start)} إلى ${date(Date.parse(end) - 1)}`, start, end,
    generatedAt: now.toISOString(), items, notes: harvestNotes(items), observationCount: p.length + m.length,
    daysObserved: new Set([...p, ...m].map(row => dayFormat.format(new Date(row.recorded_at))).filter(Boolean)).size,
    overallDirection: harvestDirection(items), biggestMover };
}
