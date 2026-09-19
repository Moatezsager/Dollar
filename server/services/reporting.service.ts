import { CurrencyStat } from '../types';
import { rates } from '../state';
import { appConfig } from '../config';
import { supabase, supabaseAnonKey } from '../db';
import { broadcastToSocialMedia, getOrInitTelegramManager } from './social.service';

export const dailyStats: Record<string, CurrencyStat> = {};
export const weeklyStats: Record<string, CurrencyStat> = {};

export function initStatsIfEmpty(termId: string, val: number) {
  if (!dailyStats[termId]) {
    dailyStats[termId] = { high: val, low: val, sum: 0, count: 0, startPrice: val };
  }
  if (!weeklyStats[termId]) {
    weeklyStats[termId] = { high: val, low: val, sum: 0, count: 0, startPrice: val };
  }
}

export function updateStats(termId: string, val: number) {
  if (val <= 0) return;
  initStatsIfEmpty(termId, val);
  
  if (val > dailyStats[termId].high) dailyStats[termId].high = val;
  if (val < dailyStats[termId].low) dailyStats[termId].low = val;
  dailyStats[termId].sum += val;
  dailyStats[termId].count++;

  if (val > weeklyStats[termId].high) weeklyStats[termId].high = val;
  if (val < weeklyStats[termId].low) weeklyStats[termId].low = val;
  weeklyStats[termId].sum += val;
  weeklyStats[termId].count++;
}

export async function broadcastSuddenChangeAlert(_u: {id?: string, name: string, oldVal: number, newVal: number, flag: string}) {
  // تم إزالة رسائل التنبيه العاجل والتغيير المفاجئ نهائياً بناءً على طلب المستخدم
  return;
}

export async function broadcastDailyReport() {
  const mgr = getOrInitTelegramManager();
  if (!appConfig.telegramPostChannel || !mgr || !appConfig.telegramAutoPost) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' });
  
  let message = `📊 *المؤشر | تقرير نهاية اليوم*\n📅 ${dateStr}\n━━━━━━━━━━━━━━━━━\n\n`;
  
  const mainCurrencies = ['USD', 'USD_CHECKS', 'EUR', 'GBP'];
  const goldCurrencies = ['GOLD_CAST_24', 'GOLD_CAST_18', 'GOLD_EXT_21', 'GOLD_EXT_18'];
  
  for (const cid of mainCurrencies) {
    const stat = dailyStats[cid];
    const term = appConfig.terms.find(t => t.id === cid);
    if (term) {
      let high = stat?.count > 0 ? stat.high : (rates.parallel[cid] || 0);
      let low = stat?.count > 0 ? stat.low : (rates.parallel[cid] || 0);
      let avg = stat?.count > 0 ? (stat.sum / stat.count) : (rates.parallel[cid] || 0);
      let trend = '➖';
      if (stat?.count > 0) {
        trend = stat.high > stat.startPrice ? '📈' : (stat.low < stat.startPrice ? '📉' : '➖');
      }
      if (avg > 0) {
        message += `💵 *${term.name}*\n`;
        message += `└ أعلى: ${high.toFixed(3)} | أدنى: ${low.toFixed(3)} | متوسط: ${avg.toFixed(3)} ${trend}\n\n`;
      }
    }
  }
  
  message += `━━━━━━━━━━━━━━━━━\n`;
  for (const cid of goldCurrencies) {
    const stat = dailyStats[cid];
    const term = appConfig.terms.find(t => t.id === cid);
    if (term) {
      let high = stat?.count > 0 ? stat.high : (rates.parallel[cid] || 0);
      let low = stat?.count > 0 ? stat.low : (rates.parallel[cid] || 0);
      if (high > 0) {
        message += `🥇 ${term.name} | أعلى: ${high.toFixed(2)} | أدنى: ${low.toFixed(2)}\n`;
      }
    }
  }
  
  message += `━━━━━━━━━━━━━━━━━\n📡 *مؤشر الدينار | الدقة والسرعة*\n🔗 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}`;
  
  try {
    await broadcastToSocialMedia(message, false);
  } catch(e) {}
  
  // Reset daily stats
  for (const key in dailyStats) {
    dailyStats[key].high = rates.parallel[key] || 0;
    dailyStats[key].low = rates.parallel[key] || 0;
    dailyStats[key].sum = 0;
    dailyStats[key].count = 0;
    dailyStats[key].startPrice = rates.parallel[key] || 0;
  }
}

export async function broadcastWeeklyReport(isTest: boolean = false) {
  if (!isTest && !appConfig.telegramAutoPost && !appConfig.facebookAutoPost) return;
  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
    console.warn("Supabase not configured, cannot generate accurate weekly report.");
    if (isTest) throw new Error("Supabase is required for accurate weekly report.");
    return;
  }

  const now = new Date();
  const pastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const dateStr = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' });
  const pastWeek = pastWeekDate.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' });
  
  const { data, error } = await supabase
    .from('parallel_rates')
    .select('rates, recorded_at')
    .gte('recorded_at', pastWeekDate.toISOString())
    .lte('recorded_at', now.toISOString())
    .order('recorded_at', { ascending: true });
    
  if (error || !data || data.length === 0) {
    console.error("[Weekly Report] Error fetching weekly data from Supabase:", error);
    if (isTest) throw new Error("No data found in Supabase for the past week.");
    return;
  }

  const stats: Record<string, { high: number, low: number, start: number, end: number, sum: number, count: number }> = {};
  
  for (const row of data) {
    const rowRates = row.rates || {};
    for (const cid in rowRates) {
       const val = rowRates[cid];
       if (!val) continue;
       
       if (!stats[cid]) {
         stats[cid] = { high: val, low: val, start: val, end: val, sum: 0, count: 0 };
       }
       
       if (val > stats[cid].high) stats[cid].high = val;
       if (val < stats[cid].low) stats[cid].low = val;
       stats[cid].end = val;
       stats[cid].sum += val;
       stats[cid].count++;
    }
  }

  let message = `📊 *مؤشر الدينار | الحصاد الأسبوعي*\n`;
  message += `🗓 ${pastWeek} — ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n\n`;
  
  const mainCurrencies = ['USD', 'EUR', 'GBP', 'USD_CHECKS'];
  const goldCurrencies = ['GOLD_CAST_24', 'GOLD_CAST_18', 'GOLD_EXT_21', 'GOLD_EXT_18'];
  
  for (const cid of mainCurrencies) {
    const stat = stats[cid];
    const term = appConfig.terms.find(t => t.id === cid);
    if (stat && term) {
       const avg = stat.sum / stat.count;
       const diff = stat.end - stat.start;
       let trendStr = "➖ استقرار";
       let trendIcon = "🔄";
       if (diff > 0.01) { trendStr = `صعود بمقدار ${Math.abs(diff).toFixed(3)}`; trendIcon = "📈"; }
       else if (diff < -0.01) { trendStr = `هبوط بمقدار ${Math.abs(diff).toFixed(3)}`; trendIcon = "📉"; }
       
       message += `💵 *${term.name}*\n`;
       message += `🔸 أعلى سعر: ${stat.high.toFixed(3)}\n`;
       message += `🔹 أدنى سعر: ${stat.low.toFixed(3)}\n`;
       message += `📊 المتوسط: ${avg.toFixed(3)}\n`;
       message += `${trendIcon} الإغلاق مقارنة بالافتتاح: ${trendStr}\n\n`;
    }
  }
  
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `🥇 *المعادن والذهب*\n\n`;
  
  for (const cid of goldCurrencies) {
    const stat = stats[cid];
    const term = appConfig.terms.find(t => t.id === cid);
    if (stat && term) {
       const diff = stat.end - stat.start;
       let trendStr = "استقرار ➖";
       if (diff > 0.1) trendStr = `صعود 📈`;
       else if (diff < -0.1) trendStr = `هبوط 📉`;
       
       message += `▪️ ${term.name}:\n`;
       message += `أعلى: ${stat.high.toFixed(2)} | أدنى: ${stat.low.toFixed(2)} | الاغلاق: ${trendStr}\n\n`;
    }
  }
  
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 التقرير مبني على سجلات قاعدة البيانات طوال الأسبوع الماضي.\n\n`;
  message += `🌐 للمزيد من التفاصيل والرسوم البيانية:\n`;
  message += `👉 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}`;
  
  if (isTest) {
    await broadcastToSocialMedia(message, true, 'all');
  } else {
    broadcastToSocialMedia(message, false, 'all').catch(e => console.error("[Background Weekly Broadcast] Error:", e));
  }
}
