import { supabase } from '../db';
import { buildWeeklyHarvest, harvestWindow } from '../../shared/weeklyHarvest';

export async function readWeeklyHarvest() {
  if (!supabase) throw new Error('قاعدة البيانات غير متاحة لإعداد الحصاد.');
  const now = new Date(), { start, end } = harvestWindow(now);
  const signal = AbortSignal.timeout(10000);
  const read = async (table: string) => {
    const rows: any[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data, error } = await supabase!.from(table).select(table === 'metal_rates' ? 'rates, recorded_at' : 'usd, rates, recorded_at')
        .gte('recorded_at', start).lt('recorded_at', end).order('recorded_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + 499).abortSignal(signal);
      if (error || !Array.isArray(data)) throw new Error('تعذر قراءة سجل الأسعار. أعد المحاولة قبل إعداد النشرة.');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
    throw new Error('سجل الفترة أكبر من حد التقرير؛ لا يمكن إصدار نشرة ببيانات ناقصة.');
  };
  const [parallel, official, metals] = await Promise.all(['parallel_rates', 'official_rates', 'metal_rates'].map(read));
  return buildWeeklyHarvest(parallel, official, metals, now);
}
