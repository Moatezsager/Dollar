import { TelegramManager, getTelegramManager } from '../../telegramClient';
import { appConfig, telegramManager, setTelegramManager } from '../config';
import { rates } from '../state';
import { db, supabase, supabaseAnonKey } from '../db';
import { addBroadcastLog } from './broadcastLog.service';

interface FacebookApiResponse {
  error?: {
    message?: string;
    code?: number;
    [key: string]: any;
  };
  id?: string;
  [key: string]: any;
}

export let facebookBroadcastStatus = {
  status: 'ok',
  lastError: '',
  lastErrorTime: '',
  lastSuccessTime: ''
};

export let telegramBroadcastStatus = {
  status: 'ok',
  lastError: '',
  lastErrorTime: '',
  lastSuccessTime: ''
};

export let lastSocialBroadcastTime = 0;

// ─── Smart Broadcast Rate Limiter ──────────────────────────────────────────
/** حد أقصى لعدد المنشورات في الساعة الواحدة عبر كل المنصات */
const BROADCAST_HOURLY_LIMIT = 2;

/** مصفوفة تحتفظ بطوابع زمنية لآخر {BROADCAST_HOURLY_LIMIT} منشورات */
const recentBroadcastTimestamps: number[] = [];

/** حالة آخر بث منشور لكل عملة (السعر ووقت النشر) - محفوظة في SQLite و Supabase وتُحمّل عند الإقلاع */
export let lastBroadcastState: Record<string, { price: number; time: number }> = {};

/** الحد الأدنى للتغيير المطلق في السعر للعملات العادية (د.ل) */
const MIN_PRICE_CHANGE = 0.02;

/** الحد الأدنى للتغيير النسبي للمعادن الثمينة (ذهب / فضة) → 0.5% */
const MIN_PRICE_CHANGE_PCT_PRECIOUS = 0.005;
// ───────────────────────────────────────────────────────────────────────────

// ─── Pending Queue (تحديثات مُؤجَّلة بسبب حد الساعة) ──────────────────────
interface PendingBroadcast {
  updates: { id?: string; name: string; oldVal: number; newVal: number; flag: string }[];
  target: 'all' | 'telegram' | 'facebook';
  addedAt: number;
}
/** قائمة انتظار للتحديثات المرفوضة بسبب حد الساعة — تُعالَج بمجرد تحرر فتحة */
const pendingBroadcastQueue: PendingBroadcast[] = [];

/** أقصى عمر لتحديث في قائمة الانتظار = 3 ساعات، بعدها يُحذف */
const MAX_PENDING_AGE_MS = 3 * 60 * 60 * 1000;

/** watchdog timer للتحقق من قائمة الانتظار كل 5 دقائق */
let pendingWatchdogTimer: NodeJS.Timeout | null = null;
// ───────────────────────────────────────────────────────────────────────────

// ─── Retry Engine (إعادة المحاولة عند فشل الإرسال) ────────────────────────
interface RetryJob {
  message: string;
  target: 'all' | 'telegram' | 'facebook';
  updates: { id?: string; name: string; newVal?: number; oldVal?: number; [key: string]: any }[];
  attempts: number;
  nextRetryAt: number;
  startTime?: number;
  lastError?: string;
}
/** قائمة مهام إعادة المحاولة بعد فشل الإرسال */
const retryQueue: RetryJob[] = [];

export function getRetryQueueCount(): number {
  return retryQueue.length;
}

/** الحد الأقصى لمحاولات الإعادة = 3 */
const MAX_RETRY_ATTEMPTS = 3;

/** مضاعف التأخير بين المحاولات (Exponential Backoff) بالميللي ثانية */
const RETRY_BASE_DELAY_MS = 30 * 1000; // 30 ثانية، 60، 120

/** timer لمحرك إعادة المحاولة */
let retryEngineTimer: NodeJS.Timeout | null = null;
// ───────────────────────────────────────────────────────────────────────────



export function getOrInitTelegramManager(): TelegramManager | null {
  if (telegramManager) return telegramManager;
  
  const apiId = Number(process.env.TELEGRAM_API_ID || appConfig.telegramApiId);
  const apiHash = process.env.TELEGRAM_API_HASH || appConfig.telegramApiHash || "";
  const sessionString = process.env.TELEGRAM_SESSION || process.env.TG_SESSION_V2 || appConfig.telegramSessionString || "";
  
  if (apiId && apiHash && sessionString) {
    try {
      const manager = getTelegramManager(apiId, apiHash, sessionString);
      setTelegramManager(manager);
      return manager;
    } catch (e: any) {
      console.error("[TelegramManager] Initialization error:", e.message || e);
    }
  }
  return null;
}

// ─── Smart Broadcast Helpers ────────────────────────────────────────────────

/**
 * يحدد إذا كانت العملة تصنّف كمعدن ثمين (ذهب / فضة)
 * نستخدم نسبة مئوية بدلاً من قيمة ثابتة لأن أسعارها بالمئات
 */
function isPreciousMetal(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('GOLD') || id.startsWith('SILVER');
}

/**
 * تفلتر قائمة التحديثات بحيث تكون العملة مؤهلة للبث إذا تحقق أحد الشرطين:
 *   1. التغير في السعر كبير بما يكفي بمفرده (MIN_PRICE_CHANGE للعملات، MIN_PRICE_CHANGE_PCT_PRECIOUS للمعادن).
 *   أو
 *   2. السعر تغير فعلياً (newVal !== oldVal) ومضت 60 دقيقة على الأقل منذ آخر نشر مؤكد للعملة
 *      باستخدام lastBroadcastState (يعتبر عدم وجود إدخال سابق مؤهلاً فورياً للنشر الأول).
 *   - الأولوية تُعطى للأقدم نشراً أولاً.
 */
function filterEligibleUpdates(
  updates: { id?: string; name: string; oldVal: number; newVal: number; flag: string }[]
): { id?: string; name: string; oldVal: number; newVal: number; flag: string }[] {
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  return updates
    .filter(u => {
      const diff = Math.abs(u.newVal - u.oldVal);

      // ── شرط 1: حجم التغيير كبير بمفرده ──────────────────────────────────
      let isLargeChange = false;
      if (isPreciousMetal(u.id)) {
        // للمعادن: نسبة مئوية (0.5%) لأن سعرها في المئات أو الآلاف
        const pct = u.oldVal > 0 ? diff / u.oldVal : 0;
        isLargeChange = pct >= MIN_PRICE_CHANGE_PCT_PRECIOUS;
      } else {
        // للعملات العادية: فارق مطلق (0.02 د.ل)
        isLargeChange = diff >= MIN_PRICE_CHANGE;
      }

      if (isLargeChange) {
        return true;
      }

      // ── شرط 2: تغير السعر فعلياً ومضت 60 دقيقة على الأقل منذ آخر نشر مؤكد ──
      const lastEntry = (u.id && lastBroadcastState[u.id]) || (u.name && lastBroadcastState[u.name]);
      const lastTime = lastEntry?.time || 0;
      const hasChanged = u.newVal !== u.oldVal;

      if (hasChanged && (lastTime === 0 || (now - lastTime) >= ONE_HOUR_MS)) {
        return true;
      }

      const elapsedMin = lastTime > 0 ? Math.floor((now - lastTime) / 60000) : 0;
      console.log(
        `[SmartBroadcast] ⏳ Skipped "${u.name}": small change (${diff.toFixed(4)}) and only ${elapsedMin}m elapsed since last broadcast`
      );
      return false;
    })
    // ── ترتيب الأولوية: الأقدم نشراً يُنشر أولاً ──────────────────────────
    .sort((a, b) => {
      const tA = (a.id && lastBroadcastState[a.id]?.time) || (a.name && lastBroadcastState[a.name]?.time) || 0;
      const tB = (b.id && lastBroadcastState[b.id]?.time) || (b.name && lastBroadcastState[b.name]?.time) || 0;
      return tA - tB;
    });
}

/**
 * يتحقق إذا كان مسموحاً بإرسال منشور جديد وفق الحد الأقصى للساعة.
 * يُنظّف الطوابع الزمنية القديمة (> ساعة) تلقائياً قبل الفحص.
 */
function canBroadcastNow(): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // إزالة الطوابع الأقدم من ساعة
  while (recentBroadcastTimestamps.length > 0 && recentBroadcastTimestamps[0] < oneHourAgo) {
    recentBroadcastTimestamps.shift();
  }

  if (recentBroadcastTimestamps.length >= BROADCAST_HOURLY_LIMIT) {
    const oldestMs = recentBroadcastTimestamps[0];
    const resetInMin = Math.ceil((oldestMs + 60 * 60 * 1000 - now) / 60000);
    console.log(
      `[SmartBroadcast] 🚫 Hourly limit reached (${recentBroadcastTimestamps.length}/${BROADCAST_HOURLY_LIMIT}). Next slot in ~${resetInMin}m`
    );
    return false;
  }

  return true;
}

/**
 * يسجّل وقت وسعر النشر في lastBroadcastState وفي SQLite و Supabase بعد كل بث ناجح فقط.
 */
function recordBroadcast(updates: { id?: string; name: string; newVal?: number; oldVal?: number; [key: string]: any }[]): void {
  const now = Date.now();
  recentBroadcastTimestamps.push(now);
  lastSocialBroadcastTime = now;

  for (const u of updates) {
    const key = u.id || u.name;
    if (!key) continue;

    const price = typeof u.newVal === 'number'
      ? u.newVal
      : (u.id && rates.parallel[u.id])
        ? rates.parallel[u.id]
        : (lastBroadcastState[key]?.price ?? 0);

    lastBroadcastState[key] = { price, time: now };
    if (u.id && u.name && u.name !== u.id) {
      lastBroadcastState[u.name] = { price, time: now };
    }

    // حفظ في SQLite
    try {
      db.prepare(`
        INSERT INTO broadcast_state (term_id, last_price, last_broadcast_time) 
        VALUES (?, ?, ?)
        ON CONFLICT(term_id) DO UPDATE SET 
          last_price = excluded.last_price,
          last_broadcast_time = excluded.last_broadcast_time
      `).run(key, price, now);
    } catch (err) {
      console.error("[BroadcastState] Local DB save error:", err);
    }

    // مزامنة مع Supabase في الخلفية
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('broadcast_state').upsert({
        term_id: key,
        last_price: price,
        last_broadcast_time: now
      }).then(({ error }) => {
        if (error) console.error("[BroadcastState] Supabase sync error:", error);
      }, err => {
        console.error("[BroadcastState] Supabase sync error:", err);
      });
    }
  }

  console.log(
    `[SmartBroadcast] ✅ Recorded broadcast for: [${updates.map(u => u.id || u.name).join(', ')}] | Posts this hour: ${recentBroadcastTimestamps.length}/${BROADCAST_HOURLY_LIMIT}`
  );
}

// ─── Retry Engine ───────────────────────────────────────────────────────────
/**
 * يُضيف رسالة فاشلة إلى قائمة إعادة المحاولة مع Exponential Backoff.
 * المحاولة 1 → بعد 30 ثانية
 * المحاولة 2 → بعد 60 ثانية
 * المحاولة 3 → بعد 120 ثانية
 * بعد 3 فشل → يُحذف نهائياً مع تسجيل خطأ
 */
function scheduleRetry(
  message: string,
  target: 'all' | 'telegram' | 'facebook',
  updates: { id?: string; name: string; newVal?: number; oldVal?: number; [key: string]: any }[],
  attemptNumber: number,
  startTime: number = Date.now(),
  lastError: string = ''
): void {
  if (attemptNumber > MAX_RETRY_ATTEMPTS) {
    console.error(
      `[RetryEngine] ❌ Giving up after ${MAX_RETRY_ATTEMPTS} attempts for: [${updates.map(u => u.id || u.name).join(', ')}]`
    );
    try {
      const platform = target === 'all' ? 'both' : target;
      const currencyIds = updates.map(u => u.id || u.name).filter(Boolean) as string[];
      addBroadcastLog({
        platform,
        currency_ids: currencyIds,
        status: 'failed',
        attempts: 1 + MAX_RETRY_ATTEMPTS,
        duration_ms: Date.now() - startTime,
        error_message: lastError || `Exhausted ${MAX_RETRY_ATTEMPTS} retries`,
        is_test: 0
      });
    } catch (logErr) {
      console.error("[BroadcastLog] Failed to record give-up log:", logErr);
    }
    return;
  }
  const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attemptNumber - 1);
  const nextRetryAt = Date.now() + delayMs;
  retryQueue.push({ message, target, updates, attempts: attemptNumber, nextRetryAt, startTime, lastError });
  console.warn(
    `[RetryEngine] ⏳ Scheduled retry #${attemptNumber} in ${delayMs / 1000}s for: [${updates.map(u => u.id || u.name).join(', ')}]`
  );
  startRetryEngine();
}

/**
 * محرك إعادة المحاولة — يعمل بدورة متكررة حتى تفرغ القائمة تماماً.
 * يُشغَّل تلقائياً عند إضافة أي مهمة retry.
 */
function startRetryEngine(): void {
  if (retryEngineTimer !== null) return; // يعمل بالفعل
  retryEngineTimer = setTimeout(async () => {
    retryEngineTimer = null;
    const now = Date.now();
    const due = retryQueue.filter(j => j.nextRetryAt <= now);
    due.forEach(j => retryQueue.splice(retryQueue.indexOf(j), 1));

    for (const job of due) {
      console.log(`[RetryEngine] 🔁 Retrying attempt #${job.attempts} for: [${job.updates.map(u => u.id || u.name).join(', ')}]`);
      try {
        await broadcastToSocialMedia(job.message, false, job.target);
        // نجاح → سجّل وقت النشر
        recordBroadcast(job.updates);
        console.log(`[RetryEngine] ✅ Retry #${job.attempts} succeeded for: [${job.updates.map(u => u.id || u.name).join(', ')}]`);

        // تسجيل نجاح بعد إعادة المحاولة (Outcome 2)
        try {
          const platform = job.target === 'all' ? 'both' : job.target;
          const currencyIds = job.updates.map(u => u.id || u.name).filter(Boolean) as string[];
          addBroadcastLog({
            platform,
            currency_ids: currencyIds,
            status: 'success_after_retry',
            attempts: 1 + job.attempts,
            duration_ms: Date.now() - (job.startTime || Date.now()),
            error_message: null,
            is_test: 0
          });
        } catch (logErr) {
          console.error("[BroadcastLog] Failed to record retry success log:", logErr);
        }
      } catch (err: any) {
        console.error(`[RetryEngine] ❌ Retry #${job.attempts} failed: ${err.message || err}`);
        scheduleRetry(job.message, job.target, job.updates, job.attempts + 1, job.startTime || Date.now(), err.message || String(err));
      }
    }

    if (retryQueue.length > 0) {
      startRetryEngine(); // جدولة دورة قادمة إذا لا تزال هناك مهام
    }
  }, 5000); // فحص كل 5 ثوانٍ لمعرفة المهام المستحقة
}
// ─── Pending Queue Watchdog ─────────────────────────────────────────────────
/**
 * يُضيف تحديثات مرفوضة (بسبب حد الساعة) إلى قائمة الانتظار.
 * Watchdog يتحقق كل 5 دقائق وينشر فوراً عند تحرر فتحة.
 */
function addToPendingQueue(
  updates: { id?: string; name: string; oldVal: number; newVal: number; flag: string }[],
  target: 'all' | 'telegram' | 'facebook'
): void {
  // تجميع مع التحديثات الموجودة في القائمة (نفس العملة → نحتفظ بآخر قيمة)
  for (const u of updates) {
    const key = u.id || u.name;
    const existingIdx = pendingBroadcastQueue.findIndex(p =>
      p.updates.some(pu => (pu.id || pu.name) === key)
    );
    if (existingIdx >= 0) {
      const existing = pendingBroadcastQueue[existingIdx];
      const uIdx = existing.updates.findIndex(pu => (pu.id || pu.name) === key);
      if (uIdx >= 0) {
        existing.updates[uIdx] = { ...u, oldVal: existing.updates[uIdx].oldVal }; // احتفظ بالقيمة القديمة الأصلية
      }
    } else {
      pendingBroadcastQueue.push({ updates: [u], target, addedAt: Date.now() });
    }
  }
  console.log(`[PendingQueue] 📥 Added ${updates.map(u => u.id || u.name).join(', ')} to pending queue (size: ${pendingBroadcastQueue.length})`);
  startPendingWatchdog();
}

/**
 * يُشغّل الـ watchdog إذا لم يكن يعمل بالفعل.
 */
function startPendingWatchdog(): void {
  if (pendingWatchdogTimer !== null) return;
  pendingWatchdogTimer = setInterval(async () => {
    const now = Date.now();
    // حذف التحديثات المنتهية الصلاحية (أكثر من 3 ساعات)
    const expired = pendingBroadcastQueue.filter(p => now - p.addedAt > MAX_PENDING_AGE_MS);
    expired.forEach(p => {
      const idx = pendingBroadcastQueue.indexOf(p);
      if (idx >= 0) pendingBroadcastQueue.splice(idx, 1);
      console.warn(`[PendingQueue] 🗑 Expired pending update: [${p.updates.map(u => u.id || u.name).join(', ')}]`);
    });

    if (pendingBroadcastQueue.length === 0) {
      clearInterval(pendingWatchdogTimer!);
      pendingWatchdogTimer = null;
      return;
    }

    if (!canBroadcastNow()) return; // لا تزال الفتحة ممتلئة

    // خذ أول دفعة من القائمة وانشرها
    const batch = pendingBroadcastQueue.shift()!;
    console.log(`[PendingQueue] 🚀 Processing pending batch: [${batch.updates.map(u => u.id || u.name).join(', ')}]`);
    // إعادة تشغيل دورة executeBroadcast بدون فلاتر (لأنها اجتازتها مسبقاً)
    executeBroadcast(batch.updates, false, batch.target, true).catch(e =>
      console.error('[PendingQueue] ❌ Failed to process pending batch:', e)
    );
  }, 5 * 60 * 1000); // كل 5 دقائق
}
// ───────────────────────────────────────────────────────────────────────────

export async function broadcastToSocialMedia(message: string, isTest: boolean = false, target: 'all' | 'telegram' | 'facebook' = 'all', isManual: boolean = false) {

  const manager = getOrInitTelegramManager();

  // Helper for small pause between retries
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Telegram
  const shouldPostTg = (target === 'telegram' || target === 'all') && (isManual || (!isTest && appConfig.telegramAutoPost) || isTest);
  if (shouldPostTg) {
    let tgChannel = (appConfig.telegramPostChannel || "").trim();
    if (tgChannel.includes('t.me/')) {
      tgChannel = tgChannel.split('t.me/')[1].split('/')[0].split('?')[0];
    }
    tgChannel = tgChannel.replace('@', '').trim();

    if (!tgChannel) {
      console.warn("[Telegram Broadcast] Skipping: No channel configured (telegramPostChannel is empty)");
      telegramBroadcastStatus = {
        status: 'error',
        lastError: 'لم يتم تحديد القناة',
        lastErrorTime: new Date().toISOString(),
        lastSuccessTime: telegramBroadcastStatus.lastSuccessTime
      };
      if (isTest && target === 'telegram') throw new Error("لا توجد قناة تيليجرام محددة للنشر.");
    } else if (!manager) {
      console.error("[Telegram Broadcast] Failed: Telegram credentials not initialized or missing");
      telegramBroadcastStatus = {
        status: 'error',
        lastError: 'بيانات أو جلسة تيليجرام غير مفعلة',
        lastErrorTime: new Date().toISOString(),
        lastSuccessTime: telegramBroadcastStatus.lastSuccessTime
      };
      if (isTest && target === 'telegram') throw new Error("بيانات تيليجرام غير مكتملة أو الجلسة غير مفعلة.");
    } else {
      let success = false;
      let lastErrMessage = "";
      const maxRetries = isTest ? 1 : 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          success = await manager.sendMessage(tgChannel, message);
          if (success) {
            break;
          } else {
            lastErrMessage = (manager as any).lastError || "فشل غير معروف";
            if (attempt < maxRetries) {
              console.warn(`[Telegram Broadcast] Attempt ${attempt} failed: ${lastErrMessage}. Retrying in 2s...`);
              await delay(2000);
            }
          }
        } catch (e: any) {
          lastErrMessage = e.message || String(e);
          if (attempt < maxRetries) {
            console.warn(`[Telegram Broadcast] Exception in attempt ${attempt}: ${lastErrMessage}. Retrying in 2s...`);
            await delay(2000);
          }
        }
      }

      if (!success) {
        telegramBroadcastStatus = {
          status: 'error',
          lastError: lastErrMessage || "فشل إرسال الرسالة",
          lastErrorTime: new Date().toISOString(),
          lastSuccessTime: telegramBroadcastStatus.lastSuccessTime
        };
        console.error(`[Telegram Broadcast] Failed to send message to ${tgChannel}: ${lastErrMessage}`);
        if (isTest && target === 'telegram') {
          if (lastErrMessage.includes('CHAT_WRITE_FORBIDDEN') || lastErrMessage.includes('CHAT_ADMIN_REQUIRED')) {
            throw new Error(`حساب تيليجرام المربوط ليس مشرفاً في القناة @${tgChannel} أو لا يملك صلاحية نشر الرسائل.`);
          }
          throw new Error(`فشل إرسال الرسالة إلى القناة @${tgChannel}: ${lastErrMessage}`);
        }
      } else {
        telegramBroadcastStatus = {
          status: 'ok',
          lastError: '',
          lastErrorTime: telegramBroadcastStatus.lastErrorTime,
          lastSuccessTime: new Date().toISOString()
        };
        lastSocialBroadcastTime = Date.now();
        console.log(`[Telegram Broadcast] Successfully sent message to ${tgChannel}`);
      }
    }
  }

  // Facebook
  const shouldPostFb = (target === 'facebook' || target === 'all') && (isManual || (!isTest && appConfig.facebookAutoPost) || isTest);
  if (shouldPostFb) {
    if (!appConfig.facebookPageId || !appConfig.facebookAccessToken) {
      console.warn("[Facebook Broadcast] Skipping Facebook post: Page ID or Access Token missing");
      facebookBroadcastStatus = {
        status: 'error',
        lastError: 'معرف الصفحة أو رمز الوصول مفقود',
        lastErrorTime: new Date().toISOString(),
        lastSuccessTime: facebookBroadcastStatus.lastSuccessTime
      };
      if (isTest && target === 'facebook') throw new Error("بيانات فيسبوك غير مكتملة. يرجى إدخال معرف الصفحة ورمز وصول الصفحة أولاً.");
    } else {
      let fbMessage = message.replace(/[*_`]/g, '');
      
      // استبدال الرابط الأساسي برابط مختصر خاص بفيسبوك لتفادي مشكلة الكاش (الأسعار القديمة)
      fbMessage = fbMessage.replace(/https:\/\/dollar-price-qp14\.onrender\.com[^\s]*/g, 'https://tinyurl.com/2j7667u2');
      
      const maxRetries = isTest ? 1 : 2;
      let postedSuccessfully = false;
      let lastFbError = "";

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const targetId = appConfig.facebookPageId.trim() || 'me';
          let url = `https://graph.facebook.com/v20.0/${targetId}/feed`;
          
          let linkToAttach = null;
          const urlMatch = fbMessage.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            linkToAttach = urlMatch[0];
          }
          
          const payload: any = { message: fbMessage, access_token: appConfig.facebookAccessToken };
          if (linkToAttach) {
            payload.link = linkToAttach;
          }

          let fbRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let fbData = (await fbRes.json()) as FacebookApiResponse;

          // Fallback 1: If link parameter error, retry cleanly without link
          if (fbData.error && payload.link) {
            console.log("[Facebook Broadcast] Retrying without link parameter...");
            delete payload.link;
            const retryRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const retryData = (await retryRes.json()) as FacebookApiResponse;
            if (!retryData.error) {
              fbData = retryData;
            }
          }

          // Fallback 2: If global ID error or invalid ID, attempt posting to /me/feed directly
          if (fbData.error && (fbData.error.code === 100 || fbData.error.message?.includes('global id'))) {
            console.log("[Facebook Broadcast] Trying fallback to /me/feed...");
            const fallbackUrl = `https://graph.facebook.com/v20.0/me/feed`;
            const fallbackRes = await fetch(fallbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: fbMessage, access_token: appConfig.facebookAccessToken })
            });
            const fallbackData = (await fallbackRes.json()) as FacebookApiResponse;
            if (!fallbackData.error) {
              fbData = fallbackData;
            }
          }

          if (fbData.error) {
            lastFbError = fbData.error.message || "خطأ غير معروف في واجهة فيسبوك";
            if (attempt < maxRetries) {
              console.warn(`[Facebook Broadcast] Attempt ${attempt} failed: ${lastFbError}. Retrying in 2s...`);
              await delay(2000);
              continue;
            }
            facebookBroadcastStatus = { status: 'error', lastError: lastFbError, lastErrorTime: new Date().toISOString(), lastSuccessTime: facebookBroadcastStatus.lastSuccessTime };
            console.error("[Facebook Broadcast] Error:", lastFbError);
            if (isTest && target === 'facebook') {
              if (lastFbError.includes('global id') || fbData.error.code === 100) {
                throw new Error("المعرف المدخل هو معرف حساب شخصي وليس معرف صفحة عامة (Page). يجب استخدام معرف صفحة فيسبوك ورمز وصول الصفحة (Page Token).");
              }
              throw new Error(lastFbError);
            }
          } else {
            postedSuccessfully = true;
            console.log("[Facebook Broadcast] Successfully posted, ID:", fbData.id);
            facebookBroadcastStatus = { status: 'ok', lastError: '', lastErrorTime: facebookBroadcastStatus.lastErrorTime, lastSuccessTime: new Date().toISOString() };
            lastSocialBroadcastTime = Date.now();
            
            // Add comment safely without breaking the main post status
            try {
              const commentMessage = `📢 لمتابعة التحديثات لحظة بلحظة على تيليجرام:\n👉 https://t.me/libya_index_dollar\n\n🌐 والرسوم البيانية والتفاصيل الكاملة من هنا:\n👉 https://tinyurl.com/2j7667u2`;
              const commentUrl = `https://graph.facebook.com/v20.0/${fbData.id}/comments`;
              const commentRes = await fetch(commentUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: commentMessage, access_token: appConfig.facebookAccessToken })
              });
              const commentData = (await commentRes.json()) as FacebookApiResponse;
              if (commentData.error) {
                console.warn("[Facebook Broadcast] Note: Comment skipped or failed (non-fatal):", commentData.error.message);
              } else {
                console.log("[Facebook Broadcast] Successfully added comment, ID:", commentData.id);
              }
            } catch (commentErr: any) {
              console.warn("[Facebook Broadcast] Non-fatal comment error:", commentErr.message);
            }
            break; // Done successfully
          }
        } catch(e: any) {
          lastFbError = e.message || String(e);
          if (attempt < maxRetries) {
            console.warn(`[Facebook Broadcast] Exception on attempt ${attempt}: ${lastFbError}. Retrying in 2s...`);
            await delay(2000);
            continue;
          }
          facebookBroadcastStatus = { status: 'error', lastError: lastFbError, lastErrorTime: new Date().toISOString(), lastSuccessTime: facebookBroadcastStatus.lastSuccessTime };
          console.error("[Facebook Broadcast] Failed:", e);
          if (isTest && target === 'facebook') throw e;
        }
      }
    }
  }
}

import { sendPushNotificationToAll } from './push.service';

export let lastOfficialBroadcastDate = "";

// Smart Queue (Debounce Buffer) to aggregate rapid price updates safely
export let broadcastQueue: Map<string, { id?: string, name: string, oldVal: number, newVal: number, flag: string }> = new Map();
export let broadcastQueueTimer: NodeJS.Timeout | null = null;

export async function broadcastOfficialRates(isTest: boolean = false) {
  if (!appConfig.telegramPostChannel || !telegramManager) {
    console.log("[Telegram Broadcast] Aborting broadcast. channel or manager missing.");
    return;
  }

  if (!isTest && !appConfig.telegramAutoPost) {
    console.log("[Telegram Broadcast] Aborting official broadcast because telegramAutoPost is disabled.");
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' });
  const timeStr = now.toLocaleTimeString('ar-LY', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit' });
  
  if (!isTest && lastOfficialBroadcastDate === dateStr) {
    console.log("[Official Broadcast] Already broadcasted today. Skipping duplicate post.");
    return;
  }

  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  let dayName = "الخميس";
  try {
    const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tripoli' })).getDay();
    dayName = dayNames[dayIndex];
  } catch (e) {}

  let message = `🏦 *نشرة أسعار مصرف ليبيا المركزي* 🏦\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `🗓 ${dayName}، ${dateStr} | ⏰ ${timeStr}\n\n`;

  for (const t of appConfig.terms) {
    if (rates.official[t.id]) {
      const val = rates.official[t.id];
      const flag = t.flag === 'us' ? '🇺🇸' : t.flag === 'eu' ? '🇪🇺' : t.flag === 'gb' ? '🇬🇧' : t.flag === 'tn' ? '🇹🇳' : t.flag === 'eg' ? '🇪🇬' : t.flag === 'tr' ? '🇹🇷' : '💰';
      message += `${flag} *${t.name}*: ${val.toFixed(4)} د.ل\n`;
    }
  }

  message += `\n━━━━━━━━━━━━━━━━━━━\n`;
  message += `🔗 *لمزيد من التفاصيل والبيانات الحية:*\n🌐 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}\n`;
  message += `📱 *المصدر:* مصرف ليبيا المركزي`;

  try {
    // Send only to Telegram, disable Facebook for official rates to prevent spamming
    await broadcastToSocialMedia(message, typeof isTest !== "undefined" ? isTest : false, 'telegram');
    if (!isTest) {
      lastOfficialBroadcastDate = dateStr;
    }
  } catch(e) {
    console.error("[Official Broadcast] Failed to broadcast", e);
  }
}

/**
 * توحيد وفلترة تحديثات النشر:
 * - استبعاد صكوك المصارف (صكوك التجاري، صكوك الجمهورية، إلخ) من النشر نهائياً
 * - الاكتفاء بنشر "دولار أمريكي (صكوك)" (USD_CHECKS) فقط
 * - في حال وجود أي تحديث لصكوك تجاري أو جمهورية، يُحوّل إلى USD_CHECKS وتدمج التحديثات
 */
export function sanitizeBroadcastUpdates(
  updates: { id?: string; name: string; oldVal: number; newVal: number; flag: string }[]
): { id?: string; name: string; oldVal: number; newVal: number; flag: string }[] {
  const result: { id?: string; name: string; oldVal: number; newVal: number; flag: string }[] = [];
  let checkUpdate: { id: string; name: string; oldVal: number; newVal: number; flag: string } | null = null;

  for (const u of updates) {
    const id = (u.id || '').toUpperCase();
    const name = u.name || '';

    // التحقق إذا كان التحديث يخص الصكوك
    const isBankCheck = 
      id === 'USD_JBANK' || 
      id === 'USD_NCB' || 
      id === 'USD_BCD' || 
      id === 'USD_AB' || 
      id === 'USD_WB' ||
      name.includes('الجمهورية') || 
      name.includes('التجاري') ||
      name.includes('التجارة') ||
      name.includes('الأمان') ||
      name.includes('الامان') ||
      name.includes('الوحدة');

    const isGenericCheck = id === 'USD_CHECKS' || id === 'USD_SUKUK' || name.includes('صكوك') || name.includes('شيك');

    if (isBankCheck || isGenericCheck) {
      if (!checkUpdate) {
        checkUpdate = {
          id: 'USD_CHECKS',
          name: 'دولار أمريكي (صكوك)',
          oldVal: u.oldVal,
          newVal: u.newVal,
          flag: 'us'
        };
      } else {
        // نأخذ القيمة الأحدث إذا تكررت الصكوك
        checkUpdate.newVal = u.newVal;
      }
    } else {
      result.push(u);
    }
  }

  if (checkUpdate) {
    result.push(checkUpdate);
  }

  return result;
}

export async function broadcastRateChanges(
  updates: {id?: string, name: string, oldVal: number, newVal: number, flag: string}[], 
  isTest: boolean = false, 
  target: 'all' | 'telegram' | 'facebook' = 'all',
  isManual: boolean = false
) {
  updates = sanitizeBroadcastUpdates(updates);
  if (!isTest && !isManual && !appConfig.telegramAutoPost && !appConfig.facebookAutoPost) {
    return;
  }
  if (updates.length === 0) {
    return;
  }

  // إذا كان التحديث يدوياً من المشرف (لوحة التحكم / مستخرج النصوص) أو وضع اختبار:
  // يتم استثناء كل الشروط (بدون انتظار، بدون مؤقت تجميع 60 ثانية، وبدون فلاتر الفوارق أو حد الساعة)
  if (isTest || isManual) {
    console.log(`[SocialBroadcast] ⚡ Executing IMMEDIATE broadcast for ${updates.length} items (isManual=${isManual}, bypassing all restrictions)`);
    await executeBroadcast(updates, isTest, target, true, isManual);
    return;
  }

  // If live broadcast from scraper, use Smart Debounce Buffer (60s) to aggregate rapid updates and prevent spam/flooding
  for (const u of updates) {
    const key = u.id || u.name;
    const existing = broadcastQueue.get(key);
    if (existing) {
      // Keep initial oldVal to track cumulative shift
      broadcastQueue.set(key, { ...u, oldVal: existing.oldVal });
    } else {
      broadcastQueue.set(key, { ...u });
    }
  }

  if (broadcastQueueTimer) {
    clearTimeout(broadcastQueueTimer);
  }

  broadcastQueueTimer = setTimeout(() => {
    broadcastQueueTimer = null;
    const batchedUpdates = Array.from(broadcastQueue.values());
    broadcastQueue.clear();
    if (batchedUpdates.length > 0) {
      executeBroadcast(batchedUpdates, false, target).catch(e => console.error("[Smart Queue] Broadcast error:", e));
    }
  }, 60000); // 60-second aggregation buffer
}

// ─── ترتيب مخصص لعرض العملات في نص الرسالة المنشورة ───────────────────────
/**
 * الترتيب الثابت والمخصص لعرض العملات في نص الرسالة المنشورة:
 * 1. الدولار الأمريكي (كاش) - USD العادي
 * 2. الدولار الأمريكي (صكوك)
 * 3. اليورو
 * 4. الجنيه الإسترليني
 * 5. الدينار التونسي
 * 6. الجنيه المصري
 * 7. الدينار الأردني
 * 8. الحوالات مجمّعة مع بعض بالترتيب: حوالات تركيا، حوالات دبي، حوالات الصين
 * أي عملات أخرى تضاف في النهاية بترتيبها الأصلي دون حذف.
 */
const BROADCAST_DISPLAY_ORDER: string[] = [
  'USD',          // 1. الدولار الأمريكي (كاش)
  'USD_CHECKS',   // 2. الدولار الأمريكي (صكوك)
  'EUR',          // 3. اليورو
  'GBP',          // 4. الجنيه الإسترليني
  'TND',          // 5. الدينار التونسي
  'EGP',          // 6. الجنيه المصري
  'JOD',          // 7. الدينار الأردني
  'USD_TR',       // 8. حوالات تركيا
  'USD_AE',       // حوالات دبي
  'USD_CN',       // حوالات الصين
];

/**
 * تحديد رتبة العنصر لعرضه في الرسالة فقط دون المساس بقرارات النشر أو الفلترة
 */
function getBroadcastDisplayRank(u: { id?: string; name?: string }): number {
  const id = (u.id || '').toUpperCase();
  const name = u.name || '';

  // 1. الدولار الأمريكي (كاش)
  if (
    id === 'USD' || 
    (name.includes('دولار') && !name.includes('صك') && !name.includes('شيك') && !name.includes('رسمي') && !name.includes('حوال') && !id.includes('OFFICIAL') && !id.includes('TR') && !id.includes('AE') && !id.includes('CN'))
  ) {
    return 10;
  }

  // 2. الدولار الأمريكي (صكوك) - توحيد الصكوك على رتبة 20 فقط
  if (
    id === 'USD_CHECKS' ||
    id === 'USD_SUKUK' ||
    name.includes('صكوك') ||
    name.includes('صك') ||
    name.includes('شيك')
  ) {
    return 20;
  }

  // 3. اليورو
  if (id === 'EUR' || name.includes('يورو')) {
    return 30;
  }

  // 4. الجنيه الإسترليني
  if (id === 'GBP' || name.includes('إسترليني') || name.includes('استرليني') || name.includes('باوند')) {
    return 40;
  }

  // 5. الدينار التونسي
  if (id === 'TND' || name.includes('تونسي')) {
    return 50;
  }

  // 6. الجنيه المصري
  if (id === 'EGP' || name.includes('مصري')) {
    return 60;
  }

  // 7. الدينار الأردني
  if (id === 'JOD' || name.includes('أردني') || name.includes('اردني')) {
    return 70;
  }

  // 8. الحوالات مجمّعة مع بعض بالترتيب:
  // 8.1 حوالات تركيا
  if (id === 'USD_TR' || (name.includes('حوال') && (name.includes('تركيا') || name.includes('تركي')))) {
    return 81;
  }
  // 8.2 حوالات دبي
  if (id === 'USD_AE' || (name.includes('حوال') && (name.includes('دبي') || name.includes('امارات') || name.includes('إمارات')))) {
    return 82;
  }
  // 8.3 حوالات الصين
  if (id === 'USD_CN' || (name.includes('حوال') && (name.includes('صين') || name.includes('الصين')))) {
    return 83;
  }

  // 9. المعادن والذهب بالترتيب المطلوب بدقة:
  if (id === 'GOLD_CAST_18') return 901; // ذهب مسبوك 18
  if (id === 'GOLD_EXT_18') return 902;  // ذهب خارجي 18
  if (id === 'GOLD_EXT_21') return 903;  // ذهب خارجي 21
  if (id === 'GOLD_SCRAP_18') return 904; // ذهب كسر 18
  if (id === 'GOLD_SCRAP_21') return 905; // ذهب كسر 21
  if (id === 'GOLD_CAST_24') return 906;  // ذهب مسبوك 24
  if (id === 'GOLD_LIRA_8G') return 907;  // ليرة ذهب 8 جرام
  if (id === 'GOLD_LIRA_14G') return 908; // ليرة ذهب 14 جرام
  if (id === 'GOLD_MUJARA_14G') return 909; // مجارة ذهب 14
  if (id === 'SILVER_CAST_1000' || id.startsWith('SILVER')) return 910; // مسبوك فضة

  // أي عملة أخرى تأتي في النهاية
  return 9999;
}

export async function executeBroadcast(
  updates: {id?: string, name: string, oldVal: number, newVal: number, flag: string}[], 
  isTest: boolean = false, 
  target: 'all' | 'telegram' | 'facebook' = 'all',
  skipFilters: boolean = false,
  isManual: boolean = false
) {
  updates = sanitizeBroadcastUpdates(updates);
  if (updates.length === 0) return;

  // ─── Smart Broadcast Filters (للوضع الحي التلقائي فقط، يتم استثناؤها تماماً في التحديث اليدوي والاختبار) ─────
  if (!isTest && !skipFilters && !isManual) {
    // الشرط 1 + 2: فلترة العملات غير المؤهلة (تغيير صغير أو وقت مبكر)
    const eligible = filterEligibleUpdates(updates);
    if (eligible.length === 0) {
      console.log('[SmartBroadcast] ⏭ All updates filtered out. No broadcast needed.');
      return;
    }
    // الشرط 3: حد الساعة (2 منشورات/ساعة)
    if (!canBroadcastNow()) {
      addToPendingQueue(eligible, target);
      return;
    }
    // استبدال قائمة التحديثات بالمؤهلة فقط (مرتبة بالأولوية)
    updates = eligible;
  }
  // ───────────────────────────────────────────────────────────────────────────

  const now = new Date();

  const dateStr = now.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' });
  const timeStr = now.toLocaleTimeString('ar-LY', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit' });

  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  let dayName = "الخميس";
  try {
    const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tripoli' })).getDay();
    dayName = dayNames[dayIndex];
  } catch (e) {}

  const flagMap: Record<string, string> = {
    'us': '🇺🇸', 'eu': '🇪🇺', 'gb': '🇬🇧', 'tn': '🇹🇳', 'eg': '🇪🇬', 
    'tr': '🇹🇷', 'ly': '🇱🇾', 'jo': '🇯🇴', 'bh': '🇧🇭', 'kw': '🇰🇼',
    'ae': '🇦🇪', 'sa': '🇸🇦', 'qa': '🇶🇦', 'cn': '🇨🇳',
    'gold': '✨', 'silver': '🪙'
  };

  let message = `📊 *مؤشر الدينار | تحديث السوق الموازي*\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `📅 ${dayName}، ${dateStr} | ⏰ ${timeStr}\n\n`;

  // ترتيب مخصص لعرض العملات في نص الرسالة فقط دون التأثير على معالجة التحديثات الأخرى
  const displayUpdates = [...updates].sort((a, b) => getBroadcastDisplayRank(a) - getBroadcastDisplayRank(b));

  for (const u of displayUpdates) {
    const isUp = u.newVal > u.oldVal;
    const isDown = u.newVal < u.oldVal;
    const diff = Math.abs(u.newVal - u.oldVal);
    let fe = flagMap[u.flag] || '💰';
    if (u.id?.startsWith('GOLD')) fe = '✨';
    if (u.id?.startsWith('SILVER')) fe = '🪙';
    
    let changeText = '➖ استقرار';
    if (isUp) changeText = `🔺 ارتفاع بمقدار ${diff.toFixed(3)}`;
    if (isDown) changeText = `🔻 انخفاض بمقدار ${diff.toFixed(3)}`;

    message += `${fe} *${u.name}*\n`;
    message += `💵 السعر: *${u.newVal.toFixed(3)} د.ل*\n`;
    if (isUp || isDown) {
      message += `📊 التغير: ${changeText} (كان ${u.oldVal.toFixed(3)})\n\n`;
    } else {
      message += `📊 التغير: ${changeText}\n\n`;
    }
  }

  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `🔗 *المتابعة الحية والرسوم البيانية:*\n`;
  message += `🌐 https://dollar-price-qp14.onrender.com/?v=${Math.floor(Date.now() / 60000)}\n`;
  message += `📱 *المصدر:* شبكة مؤشر الدينار`;

  const startTime = Date.now();
  const platform = target === 'all' ? 'both' : target;
  const currencyIds = updates.map(u => u.id || u.name).filter(Boolean) as string[];

  if (isTest || isManual) {
    try {
      await broadcastToSocialMedia(message, isTest, target, isManual);
      recordBroadcast(updates);
      try {
        addBroadcastLog({
          platform,
          currency_ids: currencyIds,
          status: 'success',
          attempts: 1,
          duration_ms: Date.now() - startTime,
          error_message: null,
          is_test: isTest ? 1 : 2
        });
      } catch (logErr) {
        console.error("[BroadcastLog] Failed to log broadcast:", logErr);
      }
    } catch (err: any) {
      try {
        addBroadcastLog({
          platform,
          currency_ids: currencyIds,
          status: 'failed',
          attempts: 1,
          duration_ms: Date.now() - startTime,
          error_message: err.message || String(err),
          is_test: isTest ? 1 : 2
        });
      } catch (logErr) {
        console.error("[BroadcastLog] Failed to log failure:", logErr);
      }
      if (isTest) throw err;
      console.error("[Manual Broadcast Error]:", err);
    }
  } else {
    broadcastToSocialMedia(message, isTest, target, isManual)
      .then(() => {
        // تسجيل وقت النشر في متتبعات الحد الأقصى (بعد الإرسال الناجح)
        recordBroadcast(updates);
        // Outcome 1: succeeds on the first try
        try {
          addBroadcastLog({
            platform,
            currency_ids: currencyIds,
            status: 'success',
            attempts: 1,
            duration_ms: Date.now() - startTime,
            error_message: null,
            is_test: 0
          });
        } catch (logErr) {
          console.error("[BroadcastLog] Failed to record first-try success log:", logErr);
        }
      })
      .catch(e => {
        console.error("[Background Broadcast] Error:", e);
        // إضافة المهام لقائمة إعادة المحاولة
        scheduleRetry(message, target, updates, 1, startTime, e.message || String(e));
      });
  }


  // SEND PUSH NOTIFICATION
  if (!isTest) {
    const mainUpdates = updates.filter(u => u.id === 'USD' || u.id === 'EUR' || u.id === 'GOLD_CAST_24' || u.id === 'GOLD_CAST_18').slice(0, 2);
    if (mainUpdates.length > 0) {
      const pushTitle = 'تحديث جديد لأسعار السوق';
      const pushBody = mainUpdates.map(u => `${u.name}: ${u.newVal.toFixed(3)}`).join(' | ');
      sendPushNotificationToAll(pushTitle, pushBody);
    } else {
      sendPushNotificationToAll('تحديث جديد', 'تم تحديث أسعار السوق الموازي');
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// إرسال رسائل الزوار المباشرة إلى الرسائل المحفوظة في حساب تيليجرام
// ───────────────────────────────────────────────────────────────────────────

export interface VisitorMessagePayload {
  id?: number | bigint | string;
  name?: string;
  email: string;
  phone: string;
  message: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  createdAt?: string;
}

export async function forwardVisitorMessageToTelegram(data: VisitorMessagePayload): Promise<boolean> {
  const manager = getOrInitTelegramManager();
  if (!manager) {
    console.error("[Visitor Messages] TelegramManager not initialized. Please verify Telegram session credentials.");
    return false;
  }

  // تنظيف وتجهيز رقم الهاتف لرابط واتساب المباشر (دعم الأرقام الليبية 09X والأرقام الدولية)
  let cleanPhone = (data.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('00218')) {
    cleanPhone = cleanPhone.slice(2);
  } else if (cleanPhone.startsWith('0') && cleanPhone.length >= 10) {
    cleanPhone = '218' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('218') && cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
    cleanPhone = '218' + cleanPhone;
  }
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : '';

  // التوقيت المحلي الدقيق لدولة ليبيا (طرابلس)
  const timeStr = data.createdAt || new Date().toLocaleString('ar-LY', { 
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const escapeHtml = (text: string) => (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const safeName = escapeHtml(data.name?.trim() || 'غير محدد');
  const safeEmail = escapeHtml(data.email?.trim() || '');
  const safePhone = escapeHtml(data.phone?.trim() || '');
  const safeMessage = escapeHtml(data.message?.trim() || '');
  const safeIp = escapeHtml(data.ip?.trim() || 'غير متوفر');
  const rawUa = (data.userAgent || 'غير متوفر').slice(0, 150);
  const safeUserAgent = escapeHtml(rawUa);
  const safeReferrer = escapeHtml((data.referrer || '').slice(0, 100));

  const htmlMsg = [
    `📬 <b>رسالة جديدة من زائر الموقع</b>`,
    `━━━━━━━━━━━━━━━━━━━`,
    data.id ? `🆔 <b>رقم الرسالة:</b> <code>#${data.id}</code>` : '',
    `👤 <b>الاسم:</b> ${safeName}`,
    `📧 <b>البريد:</b> <code>${safeEmail}</code> (<a href="mailto:${safeEmail}">إرسال بريد</a>)`,
    `📱 <b>الهاتف:</b> <code>${safePhone}</code>${whatsappUrl ? ` (<a href="${whatsappUrl}">محادثة واتساب</a>)` : ''}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `📝 <b>نص الرسالة:</b>`,
    `<blockquote>${safeMessage}</blockquote>`,
    `━━━━━━━━━━━━━━━━━━━`,
    `🌐 <b>بيانات تقنية للزائر:</b>`,
    `📍 <b>عنوان الـ IP:</b> <code>${safeIp}</code>`,
    `💻 <b>المتصفح/الجهاز:</b> <code>${safeUserAgent}</code>`,
    safeReferrer ? `🔗 <b>المصدر:</b> <code>${safeReferrer}</code>` : '',
    `⏰ <b>التوقيت:</b> ${timeStr}`
  ].filter(Boolean).join('\n');

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const success = await manager.sendMessage('me', htmlMsg, { parseMode: 'html', linkPreview: false });
      if (success) {
        console.log(`[Visitor Messages] Message #${data.id || 'new'} delivered successfully to Telegram Saved Messages.`);
        return true;
      }
      console.warn(`[Visitor Messages] Delivery attempt ${attempt} failed: ${manager.lastError || 'Unknown error'}`);
    } catch (err: any) {
      console.warn(`[Visitor Messages] Delivery attempt ${attempt} threw exception: ${err.message || err}`);
    }

    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error(`[Visitor Messages] Failed to forward visitor message #${data.id || 'new'} to Telegram after ${maxAttempts} attempts.`);
  return false;
}

