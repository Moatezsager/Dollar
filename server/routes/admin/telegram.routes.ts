import express from 'express';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { appConfig } from '../../config';
import { rates } from '../../state';
import {
  broadcastOfficialRates,
  broadcastRateChanges,
  forwardVisitorMessageToTelegram,
  getOrInitTelegramManager
} from '../../services/social.service';

const router = express.Router();
const tempClients: Record<string, { client: TelegramClient, apiId: number, apiHash: string }> = {};

// Telegram MTProto Auth
router.post('/telegram/send-code', async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber, apiId, apiHash } = req.body;
    if (!phoneNumber || !apiId || !apiHash) {
      return res.status(400).json({ success: false, message: "بيانات غير مكتملة" });
    }

    const stringSession = new StringSession("");
    const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: false,
      deviceModel: "PriceScraperServer",
      systemVersion: "1.0.0",
      appVersion: "1.0",
    });

    await client.connect();
    
    const sendCodeResult = await client.sendCode(
      {
        apiId: Number(apiId),
        apiHash: apiHash,
      },
      phoneNumber
    );

    const authId = Math.random().toString(36).substring(7);
    tempClients[authId] = { client, apiId: Number(apiId), apiHash };

    res.json({ 
      success: true, 
      phoneCodeHash: sendCodeResult.phoneCodeHash,
      authId: authId
    });
  } catch (err: any) {
    console.error("Telegram send code error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || "فشل إرسال الكود" });
    }
  }
});

router.post('/telegram/verify-code', async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber, phoneCodeHash, code, password, authId } = req.body;
    
    const sessionData = tempClients[authId];
    if (!sessionData) {
      return res.status(400).json({ success: false, message: "جلسة التحقق غير صالحة أو منتهية" });
    }

    const { client, apiId, apiHash } = sessionData;
    await client.invoke(new Api.auth.SignIn({
      phoneNumber,
      phoneCodeHash,
      phoneCode: code
    })).catch(async (err: any) => {
      if (err.message.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) {
           throw new Error("كلمة مرور التحقق بخطوتين (2FA) مطلوبة");
        }
        await client.signInWithPassword(
          { apiId, apiHash }, 
          { 
            password: async () => password, 
            onError: (e) => { throw e; } 
          }
        );
      } else {
        throw err;
      }
    });

    const sessionString = (client.session as StringSession).save();
    
    try {
      await client.disconnect();
    } catch (e) {
      console.error("Error disconnecting temp client:", e);
    }
    
    delete tempClients[authId];

    res.json({ 
      success: true, 
      sessionString: sessionString 
    });
  } catch (err: any) {
    console.error("Telegram verify code error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || "فشل التحقق من الكود" });
    }
  }
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
    
    await broadcastOfficialRates(true);
    
    appConfig.telegramPostChannel = originalChannel;
    
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
    
    appConfig.telegramPostChannel = originalChannel;
    
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
    const { imageBase64, caption, destination } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "بيانات الصورة مطلوبة" });
    }

    const manager = getOrInitTelegramManager();
    if (!manager) {
      return res.status(503).json({ success: false, error: "بيانات أو جلسة تيليجرام غير مفعلة في السيرفر." });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const target = destination === 'channel' ? (appConfig.telegramPostChannel || 'me') : 'me';

    const sent = await manager.sendFile(target, imageBuffer, {
      caption: caption || '📊 حصاد الأسبوع | التقرير المالي المعتمد لأسعار الصرف والذهب',
      filename: `weekly-harvest-${Date.now()}.png`,
      parseMode: 'md'
    });

    if (sent) {
      res.json({
        success: true,
        message: target === 'me'
          ? "تم إرسال بطاقة حصاد الأسبوع بنجاح كرسالة تجريبية إلى حسابك في تيليجرام (الرسائل المحفوظة - Saved Messages) 📩"
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
      res.json({ success: true, message: "تم إرسال رسالة تجريبية بنجاح إلى حسابك في تيليجرام (الرسائل المحفوظة - Saved Messages) 📬" });
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

    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData: any = await meRes.json();
    if (!meData.ok) {
      return res.json({ connected: false, error: meData.description || "توكن البوت غير صالح" });
    }

    let detectedChatId: string | null = null;
    let detectedChatUser: string | null = null;

    try {
      const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
      const updData: any = await updRes.json();
      if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
        const lastMsg = [...updData.result].reverse().find((u: any) => u.message?.chat?.id);
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
      configuredAdminChatId: appConfig.telegramAdminChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || null,
      detectedChatId,
      detectedChatUser
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message || "فشل الاتصال بخوادم تيليجرام" });
  }
});

export default router;
