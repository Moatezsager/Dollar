import express from 'express';
import { appConfig } from '../../config';
import { rates } from '../../state';
import {
  broadcastOfficialRates,
  broadcastRateChanges,
  forwardVisitorMessageToTelegram,
  getOrInitTelegramManager
} from '../../services/social.service';
import { sendCriticalErrorAlert } from '../../services/alert.service';

const router = express.Router();
// Account authentication is owned by Worker; bot endpoints below remain available in Web.
router.post(['/telegram/send-code', '/telegram/verify-code'], (_req, res) => {
  res.status(409).json({ success: false, message: 'اربط حساب تيليجرام الشخصي من لوحة Worker فقط. إعدادات البوت تبقى متاحة هنا.' });
});

// Telegram official broadcast
router.post('/telegram/official-broadcast', async (req: express.Request, res: express.Response) => {
  try {
    const manager = getOrInitTelegramManager();
    if (!manager) {
      return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
    }
    
    const { channel } = req.body;
    const targetChannel = channel || appConfig.telegramPostChannel;
    
    if (!targetChannel) {
       return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
    }
    
    const originalChannel = appConfig.telegramPostChannel;
    appConfig.telegramPostChannel = targetChannel;

    try {
      await broadcastOfficialRates(true);
    } finally {
      appConfig.telegramPostChannel = originalChannel;
    }
    
    res.json({ success: true, message: "تم إرسال أسعار المصرف المركزي بنجاح" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to broadcast official rates" });
  }
});

// Telegram test broadcast
router.post('/telegram/test-broadcast', async (req: express.Request, res: express.Response) => {
  try {
    const manager = getOrInitTelegramManager();
    if (!manager) {
      return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
    }
    
    const { channel } = req.body;
    const targetChannel = channel || appConfig.telegramPostChannel;
    
    if (!targetChannel) {
       return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
    }
    
    const originalChannel = appConfig.telegramPostChannel;
    appConfig.telegramPostChannel = targetChannel;

    try {
      const sampleUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
      for (const t of appConfig.terms) {
        const currentR = rates.parallel[t.id];
        const prevR = rates.previousParallel[t.id];
        if (currentR) {
          sampleUpdates.push({
            id: t.id,
            name: t.name,
            oldVal: prevR || currentR,
            newVal: currentR,
            flag: t.flag || 'us'
          });
        }
      }

      if (sampleUpdates.length === 0) {
        return res.status(400).json({ success: false, error: "لا توجد أسعار متاحة لإرسالها." });
      }

      await broadcastRateChanges(sampleUpdates, true, 'telegram');
    } finally {
      appConfig.telegramPostChannel = originalChannel;
    }
    
    res.json({ success: true, message: "تم إرسال رسالة تجريبية" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to broadcast" });
  }
});

// Facebook test broadcast
router.post('/facebook/test-broadcast', async (req: express.Request, res: express.Response) => {
  try {
    if (!appConfig.facebookPageId || !appConfig.facebookAccessToken) {
       return res.status(400).json({ success: false, error: "بيانات فيسبوك غير مكتملة. يرجى حفظ الإعدادات أولاً." });
    }
    
    const sampleUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
    for (const t of appConfig.terms) {
      const currentR = rates.parallel[t.id];
      const prevR = rates.previousParallel[t.id];
      if (currentR) {
        sampleUpdates.push({ 
          id: t.id,
          name: t.name, 
          oldVal: prevR || currentR, 
          newVal: currentR, 
          flag: t.flag || 'us' 
        });
      }
    }
    
    if (sampleUpdates.length === 0) {
      return res.status(400).json({ success: false, error: "لا توجد أسعار متاحة لإرسالها." });
    }
    
    await broadcastRateChanges(sampleUpdates, true, 'facebook');
    
    res.json({ success: true, message: "تم إرسال رسالة تجريبية إلى فيسبوك بنجاح" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to broadcast to Facebook" });
  }
});

// Weekly Harvest Image Dispatch to Telegram
router.post('/weekly-harvest/send-telegram', async (req: express.Request, res: express.Response) => {
  try {
    const { imageBase64, caption, destination } = req.body || {};
    if (!['me', 'channel'].includes(destination) || typeof caption !== 'string' || caption.length > 1024 ||
        typeof imageBase64 !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      return res.status(400).json({ success: false, error: 'تحقق من صورة PNG ووجهة الإرسال وطول النص (1024 حرفًا كحد أقصى).' });
    }
    const imageBuffer = Buffer.from(imageBase64.slice('data:image/png;base64,'.length), 'base64');
    if (imageBuffer.length < 24 || imageBuffer.length > 5 * 1024 * 1024 ||
        !imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return res.status(400).json({ success: false, error: 'الصورة غير صالحة أو تتجاوز 5 ميجابايت.' });
    }
    const channel = (appConfig.telegramPostChannel || '').trim();
    if (destination === 'channel' && (!channel || channel === 'me')) {
      return res.status(400).json({ success: false, error: 'حدد قناة النشر في إعدادات تيليجرام أولًا.' });
    }

    const manager = getOrInitTelegramManager();
    if (!manager) {
      return res.status(503).json({ success: false, error: 'إعدادات بوت تيليجرام غير متاحة.' });
    }

    const target = destination === 'channel' ? channel : 'me';

    const sent = await manager.sendFile(target, imageBuffer, {
      caption: caption || 'حصاد الأسبوع | مؤشر الدينار',
      filename: `weekly-harvest-${Date.now()}.png`,
    });

    if (sent) {
      res.json({
        success: true,
        message: target === 'me'
          ? "تم إرسال بطاقة حصاد الأسبوع عبر البوت إلى محادثة الإدارة بنجاح"
          : `تم إرسال بطاقة حصاد الأسبوع ونشرها بنجاح في القناة @${target} 🚀`
      });
    } else {
      res.status(500).json({
        success: false,
        error: manager.lastError || "فشل إرسال الصورة عبر تيليجرام"
      });
    }
  } catch (err: any) {
    console.error("[WeeklyHarvest] Send Telegram exception:", err);
    res.status(500).json({ success: false, error: err.message || "حدث خطأ أثناء إرسال الصورة" });
  }
});

// Telegram test contact message
router.post('/telegram/test-contact', async (req: express.Request, res: express.Response) => {
  try {
    const success = await forwardVisitorMessageToTelegram({
      id: 0,
      name: 'رسالة فحص تجريبية',
      email: 'test@example.com',
      phone: '0910000000',
      message: 'هذه رسالة تجريبية للتأكد من وصول رسائل اتصل بنا إلى حسابك في تيليجرام بنجاح ✅',
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1',
      userAgent: (req.headers['user-agent'] as string) || 'Admin Console',
    });

    if (success) {
      res.json({ success: true, message: "تم إرسال رسالة اختبار عبر مسار اتصل بنا الحالي إلى محادثة الإدارة." });
    } else {
      const manager = getOrInitTelegramManager();
      res.status(500).json({ success: false, error: manager.lastError || "تعذر إرسال الرسالة إلى تيليجرام" });
    }
  } catch (err: any) {
    console.error("Telegram test contact error:", err);
    res.status(500).json({ success: false, error: err.message || "فشل إرسال رسالة الاختبار" });
  }
});

// Telegram bot status and auto-detection of admin chat ID
router.get('/telegram/bot-status', async (req: express.Request, res: express.Response) => {
  try {
    const token = (appConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) {
      return res.json({ connected: false, message: "لم يتم تعيين توكن البوت" });
    }

    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
    const meData: any = await meRes.json();
    if (!meData.ok) {
      return res.json({ connected: false, error: meData.description || "توكن البوت غير صالح" });
    }

    let detectedChatId: string | null = null;
    let detectedChatUser: string | null = null;

    if (req.query.detectChatId === 'true') try {
      const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`, { signal: AbortSignal.timeout(10000) });
      const updData: any = await updRes.json();
      if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
        const lastMsg = [...updData.result].reverse().find((u: any) => u.message?.chat?.type === 'private' && u.message?.chat?.id);
        if (lastMsg) {
          detectedChatId = String(lastMsg.message.chat.id);
          detectedChatUser = lastMsg.message.from?.username
            ? `@${lastMsg.message.from.username}`
            : [lastMsg.message.from?.first_name, lastMsg.message.from?.last_name].filter(Boolean).join(' ');
        }
      }
    } catch (e) {}

    res.json({
      connected: true,
      bot: meData.result,
      configuredAdminChatId: appConfig.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || null,
      detectedChatId,
      detectedChatUser
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: "فشل الاتصال بخوادم تيليجرام. أعد المحاولة لاحقاً." });
  }
});

// Test critical error alert
router.post('/telegram/test-error-alert', async (req: express.Request, res: express.Response) => {
  try {
    const success = await sendCriticalErrorAlert({
      title: "تنبيه تجريبي | فحص نظام الإنذار الحرج",
      context: "سيرفر التطبيق (System Diagnostics)",
      severity: "critical",
      description: "هذا فحص تجريبي للتأكد من وصول التنبيهات الحرجة والمهمة فقط إلى حسابك بشكل منسق واحترافي.",
      technicalDetails: "Simulated Error: ECONNRESET on worker ping check (HTTP 500)",
      actionHint: "لا يلزم أي إجراء، السيرفر يعمل بكفاءة تامة وهذا مجرد فحص للتنسيق الذكي."
    });

    if (success) {
      res.json({ success: true, message: "تم إرسال تنبيه تجريبي للأخطاء الحرجة إلى حسابك في تيليجرام بنجاح 🚨" });
    } else {
      res.status(500).json({ success: false, error: "تعذر إرسال التنبيه، تأكد من توكن البوت وحسابك" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "فشل إرسال التنبيه" });
  }
});

export default router;
