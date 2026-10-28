import sharp, { type OverlayOptions } from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Facebook, Send } from 'lucide-react';
import { WeeklyHarvestData, harvestDirection, harvestNotes, harvestNumber } from '../../shared/weeklyHarvest';

const xml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const WIDTH = 1800;

export async function renderWeeklyHarvestImage(data: WeeklyHarvestData): Promise<Buffer> {
  const items = data.items.filter(item => !item.id.startsWith('OFFICIAL_'));
  const groups = [...new Set(items.map(item => item.category))];
  const notes = harvestNotes(items);
  const height = 700 + groups.length * 30 + items.length * 48 + notes.length * 58;
  const fontfile = resolve(process.env.NODE_ENV === 'production' ? 'dist/fonts/Cairo.ttf' : 'public/fonts/Cairo.ttf');
  const overlays: OverlayOptions[] = [];
  const shapes: string[] = [];
  const line = (y: number, color = '#ccd7cf') => shapes.push(`<path d="M32 ${y}H868" stroke="${color}"/>`);
  const box = (x: number, y: number, width: number, h: number, color: string, border = 'none') =>
    shapes.push(`<rect x="${x}" y="${y}" width="${width}" height="${h}" rx="4" fill="${color}" stroke="${border}"/>`);
  // Pango shapes Arabic with the bundled font; host fonts and remote requests cannot change the exported image.
  const text = async (value: string, x: number, y: number, width: number, size = 13, color = '#233b2d', bold = false, align: 'left' | 'right' | 'centre' = 'right', maxHeight = 60) => {
    const ordered = value.replace(/(?:[↑↓]\s*)?[+−-]?\d[\d,.]*%|@[A-Za-z0-9_]+/g, match => `\u2066${match}\u2069`);
    const rendered = await sharp({ text: { text: `<span foreground="${color}" weight="${bold ? 'bold' : 'normal'}">${xml(ordered)}</span>`,
      font: `Cairo ${size * 2}`, fontfile, rgba: true, width: Math.round(width * 2), align, wrap: 'word', spacing: 4 } }).png().toBuffer({ resolveWithObject: true });
    if (rendered.info.height > maxHeight * 2) throw new Error('نص الحصاد أطول من مساحة الصورة؛ يلزم اختصاره قبل النشر.');
    const remaining = width * 2 - rendered.info.width;
    overlays.push({ input: rendered.data, left: Math.round(x * 2 + (align === 'right' ? remaining : align === 'centre' ? remaining / 2 : 0)), top: Math.round(y * 2) });
  };
  const changeText = (pct: number | null) => pct === null ? 'رصد محدود' : `${pct > 0 ? '↑ +' : pct < 0 ? '↓ −' : '— '}${Math.abs(pct).toFixed(2)}%`;
  const changeColor = (pct: number | null) => pct === null || pct === 0 ? '#53665b' : pct > 0 ? '#11724d' : '#ac304a';

  line(99, '#194c36');
  await text('مؤشر الدينار', 540, 30, 255, 25, '#124c38', true);
  await text('أسعار العملات في ليبيا', 540, 69, 255, 12, '#4a5f50');
  await text('تقرير الأسواق', 32, 35, 220, 14, '#124c38', true, 'left');
  await text('عملات · حوالات · معادن', 32, 65, 220, 12, '#4a5f50', false, 'left');
  const logo = await readFile(resolve(process.env.NODE_ENV === 'production' ? 'dist/logo.png' : 'public/logo.png'));
  overlays.push({ input: await sharp(logo).resize(108, 108).png().toBuffer(), left: 1628, top: 54 });
  await text('حصاد الأسبوع', 475, 114, 393, 33, '#153b29', true);
  await text(data.dateRange, 32, 121, 410, 14, '#253e30', true, 'left');
  await text(`الرصد في ${data.daysObserved} من 7 أيام · توقيت طرابلس`, 32, 152, 410, 12, '#4a5f50', false, 'left');
  await text('آخر الأسعار المسجلة · دينار ليبي', 32, 185, 836, 12, '#4a5f50');

  const highlight = ['USD', 'USD_CHECKS', 'EUR'].flatMap(id => items.filter(item => item.id === id));
  for (let index = 0; index < highlight.length; index++) {
    const item = highlight[index], x = 598 - index * 283;
    box(x, 214, 270, 137, item.id === 'USD' ? '#f1faf5' : '#ffffff', item.id === 'USD' ? '#55a980' : '#cbd8cf');
    await text(item.name, x + 15, 224, 240, 17, '#124c38', true);
    await text(`${harvestNumber(item.close, item.id)} د.ل`, x + 15, 253, 240, item.id === 'USD' ? 32 : 29, '#1e3328', true);
    await text(changeText(item.changePct), x + 15, 304, 240, 13, changeColor(item.changePct), true);
    if (item.previousClose !== undefined) await text(`الأسبوع الماضي: ${harvestNumber(item.previousClose, item.id)}`, x + 15, 327, 240, 12, '#4a5f50');
  }
  const movers = items.filter(item => item.changePct !== null);
  const mover = movers.reduce<typeof items[number] | null>((best, item) => !best || Math.abs(item.changePct!) > Math.abs(best.changePct!) ? item : best, null);
  const direction = harvestDirection(items);
  box(32, 357, 836, 56, '#edf4ef');
  await text(`أكبر متحرك: ${mover ? `${mover.name} ${changeText(mover.changePct)}` : 'لا تتوفر مقارنة كافية'}`, 345, 365, 508, 14, '#214a32', true);
  await text(direction === 'up' ? '↑ الاتجاه العام يميل للارتفاع' : direction === 'down' ? '↓ الاتجاه العام يميل للتراجع' : '↔ الحركة متوازنة أو مستقرة', 47, 372, 285, 12, '#415b49', false, 'left');

  const headers = ['الصنف / الوحدة', 'مرجع البداية', 'آخر رصد', 'الأدنى / الأعلى', 'التغير · د.ل / %'];
  for (let i = 0; i < headers.length; i++) await text(headers[i], 32 + (4 - i) * 167.2, 423, 167.2, 12, '#415b49', true, i === 0 ? 'right' : 'centre');
  let y = 454;
  for (const category of groups) {
    box(32, y, 836, 28, '#e6eee8');
    await text(category, 45, y + 3, 810, 13, '#214a32', true);
    y += 30;
    for (const item of items.filter(entry => entry.category === category)) {
      line(y + 45);
      await text(item.name, 708, y + 2, 152, 14, '#253e30', true);
      await text(item.unit, 708, y + 25, 152, 12, '#4a5f50');
      await text(harvestNumber(item.open, item.id), 533.6, y + 13, 167.2, 14, '#415b49', false, 'centre');
      await text(harvestNumber(item.close, item.id), 366.4, y + 12, 167.2, 15, '#1e3328', true, 'centre');
      await text(`${harvestNumber(item.low, item.id)} / ${harvestNumber(item.high, item.id)}`, 199.2, y + 14, 167.2, 12, '#415b49', false, 'centre');
      const delta = item.change === null ? 'رصد محدود' : `${item.change > 0 ? '↑ +' : item.change < 0 ? '↓ −' : '— '}${harvestNumber(Math.abs(item.change), item.id)}`;
      await text(delta, 32, y + 2, 167.2, 13, changeColor(item.changePct), true, 'centre');
      if (item.changePct !== null) await text(`${Math.abs(item.changePct).toFixed(2)}%`, 32, y + 25, 167.2, 12, changeColor(item.changePct), false, 'centre');
      y += 48;
    }
  }
  y += 12;
  line(y, '#194c36');
  await text('قراءة الأسبوع', 32, y + 12, 836, 17, '#124c38', true);
  y += 48;
  for (const note of notes) {
    box(32, y, 836, 52, '#f0f5f1');
    await text(note, 46, y + 6, 807, 13, '#253e30', false, 'right', 48);
    y += 58;
  }
  await text(`${data.observationCount} عملية رصد · ${data.daysObserved} من 7 أيام مرصودة`, 32, y + 8, 836, 12, '#415b49');
  await text('مرجع البداية: آخر رصد من الأسبوع السابق عند توفره، وإلا أول رصد داخل الفترة.', 32, y + 34, 836, 12, '#415b49');
  await text('الأرقام للاسترشاد ولا تمثل عروض تنفيذ ملزمة.', 32, y + 61, 836, 12, '#415b49');
  y += 99;
  line(y);
  await text('تابع مؤشر الدينار', 580, y + 15, 288, 14, '#124c38', true);
  await text('تيليجرام · @libya_index_dollar', 255, y + 15, 294, 12, '#234b3d');
  await text('فيسبوك · مؤشر الدينار', 32, y + 15, 206, 12, '#234b3d');
  shapes.push(`<g transform="translate(552 ${y + 16})">${renderToStaticMarkup(createElement(Send, { size: 20, color: '#087eaa' }))}</g>`);
  shapes.push(`<g transform="translate(241 ${y + 16})">${renderToStaticMarkup(createElement(Facebook, { size: 20, color: '#1877f2' }))}</g>`);
  await text('dollar-price-qp14.onrender.com', 32, y + 57, 836, 12, '#415b49', false, 'left');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height * 2}" viewBox="0 0 900 ${height}"><rect width="900" height="${height}" fill="#ffffff"/><rect width="900" height="5" fill="#124c38"/>${shapes.join('')}</svg>`;
  return sharp(Buffer.from(svg)).composite(overlays).png({ compressionLevel: 9, effort: 5 }).toBuffer();
}

export async function renderWeeklyHarvestPreview(image: Buffer): Promise<Buffer> {
  return sharp(image).extract({ left: 0, top: 0, width: WIDTH, height: 830 })
    .resize(1200, 630, { fit: 'contain', background: '#ffffff' }).png({ compressionLevel: 9 }).toBuffer();
}
