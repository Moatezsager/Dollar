import { supabase } from '../db';
import { buildWeeklyHarvest, harvestWindow } from '../../shared/weeklyHarvest';

export async function readWeeklyHarvest(now = new Date(), mode: 'current' | 'completed' = 'current') {
  if (!supabase) throw new Error('قاعدة البيانات غير متاحة لإعداد الحصاد.');
  const { start, end } = harvestWindow(now, mode);
  const readStart = new Date(Date.parse(start) - 7 * 86400000).toISOString();
  const signal = AbortSignal.timeout(10000);
  const read = async (table: string) => {
    const rows: any[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data, error } = await supabase!.from(table).select(table === 'metal_rates' ? 'rates, recorded_at' : 'usd, rates, recorded_at')
        .gte('recorded_at', readStart).lt('recorded_at', end).order('recorded_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + 499).abortSignal(signal);
      if (error || !Array.isArray(data)) throw new Error('تعذر قراءة سجل الأسعار. أعد المحاولة قبل إعداد النشرة.');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
    throw new Error('سجل الفترة أكبر من حد التقرير؛ لا يمكن إصدار نشرة ببيانات ناقصة.');
  };
  const [parallelRows, metalRows] = await Promise.all(['parallel_rates', 'metal_rates'].map(read));
  const split = (rows: any[]) => ({ current: rows.filter(row => Date.parse(row.recorded_at) >= Date.parse(start)), previous: rows.filter(row => Date.parse(row.recorded_at) < Date.parse(start)) });
  const parallel = split(parallelRows), metals = split(metalRows);
  return buildWeeklyHarvest(parallel.current, [], metals.current, now, parallel.previous, metals.previous, mode);
}
