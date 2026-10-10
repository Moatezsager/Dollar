import { appConfig } from '../config';

export interface CriticalAlertOptions {
  title?: string;
  context: string;
  severity?: 'critical' | 'warning' | 'security';
  description: string;
  technicalDetails?: string;
  actionHint?: string;
  url?: string;
  ip?: string;
}

// In-memory cache to debounce identical alerts (prevents flooding)
const recentAlerts = new Map<string, number>();
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes per unique alert signature
let clientCrashWindow = 0;
let clientCrashCount = 0;

// Normal/benign patterns that MUST NEVER trigger alerts (pure noise)
const IGNORED_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /aborterror/i,
  /timeouterror/i,
  /signal timed out/i,
  /websocket closed/i,
  /vite/i,
  /favicon/i,
  /canceled/i,
  /cancelled/i,
  /load resource/i,
  /404/i,
  /not found/i,
  /script error/i,
  /user rejected/i,
  /permission denied/i
];

/**
 * Sends a professionally formatted critical system alert to the admin's Telegram account.
 */
export async function sendCriticalErrorAlert(options: CriticalAlertOptions): Promise<boolean> {
  const token = (appConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (appConfig.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!token || !chatId) {
    return false;
  }

  // Create signature for deduplication
  const signature = `${options.severity || 'critical'}_${options.context}_${options.description.slice(0, 80)}`;
  const now = Date.now();
  const lastSent = recentAlerts.get(signature) || 0;
  if (now - lastSent < ALERT_COOLDOWN_MS) {
    // Suppress duplicate alert within cooldown period
    return false;
  }
  recentAlerts.set(signature, now);

  // Clean old entries in cache if larger than 200
  if (recentAlerts.size > 200) {
    for (const [key, timestamp] of recentAlerts.entries()) {
      if (now - timestamp > ALERT_COOLDOWN_MS) {
        recentAlerts.delete(key);
      }
    }
    while (recentAlerts.size > 200) recentAlerts.delete(recentAlerts.keys().next().value!);
  }

  const timeStr = new Date().toLocaleString('ar-LY', { 
    timeZone: 'Africa/Tripoli',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  });

  const severityBadge = options.severity === 'security'
    ? '🛡️ <b>مستوى التنبيه:</b> <code>أمني (Security)</code>'
    : options.severity === 'warning'
    ? '⚠️ <b>مستوى التنبيه:</b> <code>تحذير هام (Warning)</code>'
    : '🔴 <b>مستوى الخطورة:</b> <code>حرج (Critical)</code>';

  const escapeHtml = (text: string, limit = 1500) => (text || '')
    .replaceAll(token, '[REDACTED]')
    .replace(/\b(?:bot)?\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .slice(0, limit)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const cleanTechDetails = options.technicalDetails
    ? escapeHtml(options.technicalDetails, 400)
    : '';

  const messageLines = [
    options.title ? `🚨 <b>${escapeHtml(options.title)}</b>` : '🚨 <b>تنبيه نظام حرج | مراقبة السيرفر</b>',
    '━━━━━━━━━━━━━━━━━━━',
    severityBadge,
    `⚙️ <b>المكون:</b> ${escapeHtml(options.context)}`,
    `📝 <b>وصف المشكلة:</b> ${escapeHtml(options.description)}`,
    options.ip ? `📍 <b>عنوان الـ IP:</b> <code>${escapeHtml(options.ip)}</code>` : '',
    options.url ? `🔗 <b>المسار:</b> <code>${escapeHtml(options.url.split('?')[0], 300)}</code>` : '',
    cleanTechDetails ? `━━━━━━━━━━━━━━━━━━━\n💻 <b>التفاصيل الفنية:</b>\n<blockquote>${cleanTechDetails}</blockquote>` : '',
    options.actionHint ? `💡 <b>الإجراء المقترح:</b> ${escapeHtml(options.actionHint)}` : '',
    '━━━━━━━━━━━━━━━━━━━',
    `⏰ <b>توقيت طرابلس:</b> ${timeStr}`
  ].filter(Boolean);

  const text = messageLines.join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data: any = await res.json();
    if (!res.ok || data.ok !== true) {
      recentAlerts.delete(signature);
      return false;
    }
    return true;
  } catch (err) {
    recentAlerts.delete(signature);
    console.error("[AlertService] Failed to dispatch Telegram alert.");
    return false;
  }
}

/**
 * Evaluates an error and dispatches an alert ONLY if it represents a critical or serious issue.
 */
export async function checkAndAlertIfCritical(error: any, context = "النظام", details?: any) {
  const errMsg = typeof error === 'string' ? error : (error?.message || String(error));
  const stack = error?.stack || details?.stack || '';

  // Client-reported context cannot establish a server/security incident.
  const fromClient = details?.source === 'client';
  const isFatalCrash = !fromClient && (/uncaughtexception|unhandledrejection|fatal|crash/i.test(context) || /fatal/i.test(errMsg));
  const isDbFailure = !fromClient && /supabase|database|قاعدة البيانات|relation.*does not exist/i.test(errMsg)
    && /fail|error|timeout|timed out|enotfound|permission|does not exist|فشل|تعذر|خطأ/i.test(errMsg)
    && !errMsg.includes('dummy');
  const isReactCrash = context.includes('ErrorBoundary');
  const isSecurity = !fromClient && (context.includes('Security') || context.includes('Rate Limit'));
  const isMemory = !fromClient && /out of memory|enospc/i.test(errMsg);

  if (fromClient) {
    if (!isReactCrash) return;
    const now = Date.now();
    if (now - clientCrashWindow > 5 * 60 * 1000) {
      clientCrashWindow = now;
      clientCrashCount = 0;
    }
    if (++clientCrashCount < 3) return;
  } else if (!isFatalCrash && !isDbFailure && !isMemory
    && IGNORED_PATTERNS.some(pattern => pattern.test(errMsg) || pattern.test(context))) {
    return;
  }

  if (isFatalCrash || isDbFailure || isReactCrash || isSecurity || isMemory) {
    let actionHint = "فحص سجلات السيرفر أو استقرار الخدمات السحابية.";
    let description = errMsg;

    if (isDbFailure) {
      actionHint = "تحقق من اتصال قاعدة البيانات Supabase ومفاتيح الوصول في Render.";
      description = "تعذر الاتصال بقاعدة البيانات أو تنفيذ استعلامات النظام الرئيسية.";
    } else if (isReactCrash) {
      actionHint = "حدث خطأ غير متوقع في واجهة المستخدم لدى أحد الزوار (React ErrorBoundary).";
      description = "انهيار في عرض الصفحة للزائر.";
    } else if (isSecurity) {
      actionHint = "مراقبة عناوين IP والتحقق من عدم وجود محاولات تخمين كلمات المرور.";
    }

    await sendCriticalErrorAlert({
      title: isSecurity ? "درع الأمان | تنبيه أمني" : "تنبيه نظام حرج",
      context,
      severity: isSecurity ? 'security' : isFatalCrash || isDbFailure || isMemory ? 'critical' : 'warning',
      description,
      technicalDetails: stack || errMsg,
      actionHint,
      url: details?.url,
      ip: details?.ip
    });
  }
}
