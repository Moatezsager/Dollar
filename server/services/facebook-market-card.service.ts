import sharp, { type OverlayOptions } from 'sharp';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { supabase } from '../db';
import { getLibyaDateString } from '../utils/helpers';

const names = [ ['USD', 'دولار كاش'], ['USD_CHECKS', 'دولار صكوك'], ['EUR', 'يورو'],
  ['GBP', 'جنيه إسترليني'], ['TND', 'دينار تونسي'], ['EGP', 'جنيه مصري'],
  ['GOLD_SCRAP_18', 'ذهب كسر 18'], ['GOLD_SCRAP_21', 'ذهب كسر 21'], ['GOLD_CAST_24', 'ذهب مسبوك 24'], ['SILVER_CAST_1000', 'مسبوك فضة'] ];
const CHART_WINDOW_MS = 48 * 3600000;
type Row = { usd?: number; rates?: Record<string, number>; recorded_at: string; last_changed?: Record<string, string> };
const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit' });
const number = (n: number, id: string) => n.toFixed(id === 'EGP' ? 4 : 3);
const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));

export function buildFacebookMarketCard(rows: Row[], now = new Date(), boundary?: Row) {
  const date = getLibyaDateString(now), today = Date.parse(`${date}T00:00:00+02:00`), end = now.getTime();
  const start = end - CHART_WINDOW_MS;
  const ordered = rows.filter(r => Date.parse(r.recorded_at) >= start && Date.parse(r.recorded_at) <= end)
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  const latest = ordered.at(-1);
  const price = (r: Row, id: string) => id === 'USD' ? r.usd ?? r.rates?.USD : r.rates?.[id];
  const items = names.flatMap(([id, name]) => {
    if (!latest) return [];
    const value = price(latest, id), changedAt = Date.parse(latest.last_changed?.[id] || '');
    // A new full-map row is not evidence that each carried currency was updated today.
    if (!Number.isFinite(value) || value! <= 0 || !Number.isFinite(changedAt) || changedAt < today || changedAt > Date.parse(latest.recorded_at)) return [];
    const samples = new Map<number, number>();
    for (const row of boundary ? [boundary, ...ordered] : ordered) {
      const at = Date.parse(row.last_changed?.[id] || ''), v = price(row, id);
      if (Number.isFinite(at) && at <= changedAt && at <= Date.parse(row.recorded_at) && Number.isFinite(v) && v! > 0) samples.set(at, v!);
    }
    const observations = [...samples].sort((a, b) => a[0] - b[0]).map(([at, value]) => ({ at, value }));
    const points = observations.filter(point => point.at >= start);
    const previous = observations.at(-2)?.value ?? null;
    const change = previous === null ? null : Number(number(value!, id)) - Number(number(previous, id));
    return [{ id, name, value: value!, changedAt, points, previous, change }];
  });
  const arrow = (v: number | null) => v === null ? '' : v > 0 ? ' ↑' : v < 0 ? ' ↓' : ' ↔';
  const dateLabel = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'long', year: 'numeric' });
  const caption = `تحديث ${time(end)} | سوق المشير\nمؤشر الدينار · ${dateLabel}\n\n${items.map(item => `${item.name}: ${number(item.value, item.id)} د.ل${arrow(item.change)}`).join('\n')}\n\nالأسهم مقارنة بآخر رصد سابق.\nالعملات لكل وحدة، والمعادن للجرام. الأسعار للاسترشاد وليست عروض تنفيذ ملزمة.`;
  return { date, generatedAt: now.toISOString(), start, end, items, caption,
    revision: createHash('sha256').update(JSON.stringify([date, items.map(i => [i.id, i.value])])).digest('hex') };
}
type Card = ReturnType<typeof buildFacebookMarketCard>;

export async function renderFacebookMarketCard(card: Card): Promise<Buffer> {
  if (!card.items.length) throw new Error('لا تحديثات مؤكدة اليوم.');
  const charts = card.items.filter(i => ['USD', 'USD_CHECKS', 'EUR'].includes(i.id));
  const others = card.items.filter(i => !charts.includes(i));
  const detailsY = charts.length ? 714 : 200;
  const height = Math.max(charts.length ? 850 : 520, detailsY + Math.ceil(others.length / 2) * 54 + 90);
  const shapes: string[] = [], overlays: OverlayOptions[] = [];
  const fontfile = resolve(process.env.NODE_ENV === 'production' ? 'dist/fonts/Cairo.ttf' : 'public/fonts/Cairo.ttf');
  const text = async (s: string, x: number, y: number, width: number, size = 15, color = '#52685f', bold = false, align: 'left' | 'right' = 'right') => {
    const ordered = s.replace(/(?:[↑↓]\s*)?[+−-]?\d[\d,.]*%/g, match => `\u2066${match}\u2069`);
    const result = await sharp({ text: { text: `<span foreground="${color}" weight="${bold ? 'bold' : 'normal'}">${xml(ordered)}</span>`, font: `Cairo ${size * 2}`, fontfile, rgba: true, width: Math.round(width * 2), align } }).png().toBuffer({ resolveWithObject: true });
    if (result.info.height > 82) throw new Error('نص الصورة تجاوز المساحة المحددة.');
    overlays.push({ input: result.data, left: Math.round(x * 2 + (align === 'right' ? width * 2 - result.info.width : 0)), top: Math.round(y * 2) });
  };
  const styles: Record<string, { color: string; dash: string }> = {
    USD: { color: '#087c59', dash: '' }, USD_CHECKS: { color: '#315fb4', dash: '12 7' }, EUR: { color: '#ae6516', dash: '3 7' }
  };
  await text('مؤشر الدينار', 430, 30, 330, 24, '#184c38', true);
  await text(card.date, 40, 35, 240, 16, '#52685f', false, 'left');
  await text(charts.length ? 'حركة العملات خلال 48 ساعة' : 'أسعار السوق اليوم', 40, 79, 720, 29, '#152f24', true);
  await text(`السوق الموازي · ${time(card.end)} بتوقيت طرابلس`, 40, 132, 720, 16);
  for (const [index, item] of charts.entries()) {
    const { color, dash } = styles[item.id], width = (720 - (charts.length - 1) * 16) / charts.length;
    const left = 760 - width - index * (width + 16);
    shapes.push(`<rect x="${left}" y="180" width="${width}" height="151" rx="12" fill="#f7faf8" stroke="#dbe5df"/>`);
    shapes.push(`<path d="M${left + 18} 203h36" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}" stroke-linecap="round"/>`);
    await text(item.name, left + 62, 188, width - 78, 17, '#243d31', true);
    await text(`${number(item.value, item.id)} د.ل`, left + 18, 224, width - 36, 28, color, true);
    const direction = item.change === null ? '' : item.change > 0 ? '↑ ارتفاع' : item.change < 0 ? '↓ انخفاض' : '↔ استقرار';
    const priorLabel = item.previous === null ? 'لا يتوفر رصد سابق' : `السابق ${number(item.previous, item.id)}  ·  ${direction}`;
    await text(priorLabel, left + 10, 270, width - 20, 14, '#243d31', true);
    await text(`تحديث ${time(item.changedAt)}`, left + 18, 303, width - 36, 13);
  }
  if (charts.length) {
    await text('العلامة عند آخر رصد', 40, 339, 240, 14, '#52685f', false, 'left');
    await text('د.ل لكل وحدة عملة', 40, 339, 720, 14);
    const points = charts.flatMap(item => item.points), values = points.map(p => p.value);
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max((high - low) * .12, low * .001);
    const min = low - pad, max = high + pad, first = card.start;
    const x = (at: number) => 65 + (at - first) / Math.max(1, card.end - first) * 600;
    const py = (value: number) => 626 - (value - min) / (max - min) * 244;
    shapes.push('<rect x="55" y="378" width="622" height="256" rx="8" fill="#f6f9f8"/>');
    for (let i = 0; i <= 4; i++) {
      const gridX = x(first + CHART_WINDOW_MS * i / 4);
      shapes.push(`<path d="M${gridX} 382V626" stroke="#dce5e0" stroke-dasharray="3 7"/>`);
      const value = min + (max - min) * i / 4;
      shapes.push(`<path d="M65 ${py(value)}H665" stroke="#dce5e0" stroke-dasharray="3 7"/>`);
      await text(value.toFixed(3), 678, py(value) - 10, 90, 14);
    }
    for (const item of charts) {
      const { color, dash } = styles[item.id];
      let path = '';
      item.points.forEach((point, index) => {
        const px = x(point.at).toFixed(2), yy = py(point.value).toFixed(2);
        if (!index) path = `M${px} ${yy}`;
        else if (point.at - item.points[index - 1].at > 3 * 3600000) path += ` H${px} V${yy}`;
        else path += ` L${px} ${yy}`;
      });
      // Extend the drawing only; the marker and update time belong to the actual observation.
      path += ` H${x(card.end)}`;
      const px = x(item.changedAt), yy = py(item.value);
      shapes.push(item.id === 'USD' ? `<circle cx="${px}" cy="${yy}" r="4.5" fill="${color}"/>` :
        item.id === 'USD_CHECKS' ? `<rect x="${px - 4}" y="${yy - 4}" width="8" height="8" fill="${color}"/>` :
        `<path d="M${px} ${yy - 5}l5 5 -5 5 -5 -5Z" fill="${color}"/>`);
      shapes.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    for (let i = 0; i <= 4; i++) {
      const at = first + CHART_WINDOW_MS * i / 4, left = x(at) - 24;
      const day = new Date(at).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'short' });
      await text(time(at), left, 641, 90, 15, '#243d31', true, 'left');
      await text(day, left, 667, 120, 13, '#52685f', false, 'left');
    }
  }
  for (let i = 0; i < others.length; i++) {
    const item = others[i], x = i % 2 ? 40 : 410, rowY = detailsY + Math.floor(i / 2) * 54;
    await text(`${item.name}  ${number(item.value, item.id)}`, x, rowY, 350, 16, '#243d31', true);
    await text(`د.ل · تحديث ${time(item.changedAt)}`, x, rowY + 27, 350, 12);
  }
  const footer = height - 58;
  shapes.push(`<path d="M40 ${footer}H760" stroke="#dbe5df"/>`);
  await text('الأسعار للاسترشاد · العملات للوحدة والمعادن للجرام', 40, footer + 18, 720, 13);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height * 2}" viewBox="0 0 800 ${height}"><rect width="800" height="${height}" fill="#ffffff"/>${shapes.join('')}</svg>`;
  return sharp(Buffer.from(svg)).composite(overlays).png().toBuffer();
}

let pending: Promise<any> | undefined;
let cached: { until: number; date: string; value: any } | undefined;
export async function readFacebookMarketCard() {
  const now = new Date();
  if (cached && cached.until > now.getTime() && cached.date === getLibyaDateString(now)) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    if (!supabase) throw new Error('قاعدة البيانات غير متاحة.');
    const start = new Date(now.getTime() - CHART_WINDOW_MS).toISOString(), rows: Row[] = [];
    const signal = AbortSignal.timeout(10000);
    for (let offset = 0; ; offset += 500) {
      if (offset >= 5000) throw new Error('سجل اليوم يتجاوز حد الصورة؛ لن تُنشر بيانات مبتورة.');
      const result = await supabase.from('parallel_rates').select('usd,rates,last_changed,recorded_at')
        .gte('recorded_at', start).lte('recorded_at', now.toISOString()).order('recorded_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + 499).abortSignal(signal);
      if (result.error || !Array.isArray(result.data)) throw new Error('تعذر قراءة سجل اليوم بالكامل.');
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    let card = buildFacebookMarketCard(rows, now);
    if (card.items.some(item => item.previous === null)) {
      // Full-map boundary snapshot supplies a previous quote even after a quiet weekend.
      const prior = await supabase.from('parallel_rates').select('usd,rates,last_changed,recorded_at')
        .lt('recorded_at', start).order('recorded_at', { ascending: false }).order('id', { ascending: false })
        .limit(1).abortSignal(signal);
      if (prior.error) throw new Error('تعذر التحقق من الرصد السابق.');
      if (prior.data?.[0]) card = buildFacebookMarketCard(rows, now, prior.data[0]);
    }
    const value = { success: true, date: card.date, generatedAt: card.generatedAt, revision: card.revision, empty: !card.items.length,
      caption: card.caption, imageBase64: card.items.length ? `data:image/png;base64,${(await renderFacebookMarketCard(card)).toString('base64')}` : null };
    cached = { until: Date.now() + 30000, date: card.date, value };
    return value;
  })().finally(() => { pending = undefined; });
  return pending;
}
