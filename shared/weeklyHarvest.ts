export interface WeeklyItem {
  id: string; name: string; code: string; category: string; unit: string;
  open: number; high: number; low: number; close: number;
  change: number | null; changePct: number | null; days: number;
  firstAt: string; lastAt: string;
}
export interface WeeklyHarvestData {
  title: string; dateRange: string; start: string; end: string;
  generatedAt: string; notes: string[]; items: WeeklyItem[];
}
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' });
export function harvestNumber(value: number, code = '') {
  const precise = code.startsWith('OFFICIAL_') || code === 'EGP' || (value !== 0 && Math.abs(value) < 0.01);
  return value.toLocaleString('en-US', { minimumFractionDigits: precise ? 4 : 2, maximumFractionDigits: precise ? 4 : 3 });
}
export function harvestNotes(items: WeeklyItem[]): string[] {
  const cash = items.find(item => item.id === 'USD'), checks = items.find(item => item.id === 'USD_CHECKS');
  const euro = items.find(item => item.id === 'EUR'), gold = items.find(item => item.id === 'GOLD_SCRAP_18');
  const movement = (item: WeeklyItem) => item.change === null ? `${item.name}: لا يكفي الرصد لحساب التغير` :
    item.change === 0 ? `${item.name} دون تغير بين أول وآخر رصد` : `${item.name} ${item.change > 0 ? 'ارتفع' : 'تراجع'} ${Math.abs(item.changePct!).toFixed(2)}%`;
  const notes: string[] = [];
  if (cash) notes.push(`${movement(cash)}؛ نطاق الرصد ${harvestNumber(cash.low, cash.id)} إلى ${harvestNumber(cash.high, cash.id)} د.ل.`);
  if (checks && cash && Date.parse(checks.lastAt) === Date.parse(cash.lastAt)) {
    const gap = Number((checks.close - cash.close).toFixed(6));
    let note = gap === 0 ? 'تعادل سعر الصكوك والكاش عند آخر رصد' : `الصكوك ${gap > 0 ? 'أعلى من' : 'أقل من'} الكاش بـ ${harvestNumber(Math.abs(gap), 'USD_CHECKS')} د.ل عند آخر رصد`;
    if (checks.change !== null && cash.change !== null && Date.parse(checks.firstAt) === Date.parse(cash.firstAt)) {
      const firstGap = Number((checks.open - cash.open).toFixed(6));
      note += gap === firstGap ? '؛ الفارق نفسه عند أول رصد' : `؛ فارق أول الرصد ${firstGap > 0 ? '+' : ''}${harvestNumber(firstGap, 'USD_CHECKS')} د.ل`;
    }
    notes.push(`${note}.`);
  } else if (checks) notes.push(`${movement(checks)}.`);
  const other = [euro, gold].filter((item): item is WeeklyItem => !!item);
  if (other.length) notes.push(`${other.map(movement).join('؛ ')}.`);
  const partial = [cash, checks, ...other].filter((item): item is WeeklyItem => !!item && item.days < 7);
  if (partial.length) notes.push(`رصد جزئي: ${partial.map(item => `${item.name} ${item.days}/7 أيام`).join('، ')}.`);
  return notes;
}
export function harvestWindow(now = new Date()) {
  const day = dayFormat.format(now);
  const end = new Date(`${day}T00:00:00+02:00`);
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
  ['OFFICIAL_EUR', 'اليورو الرسمي', 'EUR', 'المصرف المركزي', 'لكل يورو'],
  ['GOLD_SCRAP_18', 'ذهب كسر 18', '18K', 'المعادن', 'للجرام'],
  ['GOLD_SCRAP_21', 'ذهب كسر 21', '21K', 'المعادن', 'للجرام'],
  ['GOLD_CAST_24', 'ذهب مسبوك 24', '24K', 'المعادن', 'للجرام'],
  ['GOLD_LIRA_8G', 'ليرة ذهب', '8G', 'المعادن', 'للقطعة · 8 جرام'],
  ['SILVER_CAST_1000', 'مسبوك فضة', '1000', 'المعادن', 'للجرام'],
];
type Observation = { recorded_at: string; rates: Record<string, number>; usd?: number };
export function buildWeeklyHarvest(parallel: Observation[], official: Observation[], metals: Observation[], now = new Date()): WeeklyHarvestData {
  const { start, end } = harvestWindow(now);
  const inWindow = (rows: Observation[]) => rows.filter(row => row.recorded_at && Date.parse(row.recorded_at) >= Date.parse(start) && Date.parse(row.recorded_at) < Date.parse(end))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  const p = inWindow(parallel), o = inWindow(official), m = inWindow(metals);
  const items: WeeklyItem[] = [];
  for (const [id, name, code, category, unit] of definitions) {
    const isOfficial = id.startsWith('OFFICIAL_');
    const key = isOfficial ? code : id;
    const metalRows = m.filter(row => Number.isFinite(row.rates?.[key]) && row.rates[key] > 0);
    const rows = isOfficial ? o : category === 'المعادن' && metalRows.length ? metalRows : p;
    const values = rows.map(row => ({ time: row.recorded_at, value: row.rates?.[key] ?? (key === 'USD' ? row.usd : undefined) }))
      .filter((entry): entry is { time: string; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0);
    if (!values.length) continue;
    const days = new Set(values.map(entry => dayFormat.format(new Date(entry.time)))).size;
    const open = values[0].value, close = values[values.length - 1].value;
    const change = days > 1 ? Number((close - open).toFixed(6)) : null;
    items.push({ id, name, code, category, unit, open, close, high: Math.max(...values.map(v => v.value)), low: Math.min(...values.map(v => v.value)),
      change, changePct: change === null ? null : change / open * 100, days, firstAt: values[0].time, lastAt: values[values.length - 1].time });
  }
  const date = (value: string | number) => new Date(value).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'long', year: 'numeric' });
  return { title: 'حصاد الأسبوع', dateRange: `${date(start)} إلى ${date(Date.parse(end) - 1)}`, start, end,
    generatedAt: now.toISOString(), items, notes: harvestNotes(items) };
}
