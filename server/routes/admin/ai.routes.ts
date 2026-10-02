import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../../config';
import { rates } from '../../state';
import { broadcastToSocialMedia, getOrInitTelegramManager } from '../../services/social.service';

const router = express.Router();

// AI Market Analysis
router.post('/telegram/generate-analysis', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: "Gemini API Key is not configured." });
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const updates = [];
    const termsToInclude = ["USD", "EUR", "GBP", "TND", "EGP"];
    for (const t of appConfig.terms) {
      if (termsToInclude.includes(t.id)) {
         const currentR = rates.parallel[t.id];
         const prevR = rates.previousParallel[t.id];
         if (currentR) {
            updates.push(`- ${t.name}: السعر الحالي ${currentR.toFixed(3)} ${prevR && currentR !== prevR ? '(كان '+prevR.toFixed(3)+')' : ''}`);
         }
      }
    }

    const prompt = `أنت خبير اقتصادي ومحلل مالي ليبي متخصص في سوق العملات ومؤشر الدينار الليبي. بناءً على التغيرات التالية في أسعار الصرف في السوق الموازي:
${updates.join('\n')}
قم بكتابة نبذة أو تعليق مختصر (بحد أقصى 3-4 أسطر) يصف حالة السوق (استقرار، صعود، أو هبوط) بلهجة ليبية عامية محترفة ولبقة.
يجب أن تكون جذابة وصالحة للنشر بقناة تيليجرام.
لا تستخدم أي مقدمات أو خاتمات زائدة من قبيل "حسنا سأقوم بذلك"، فقط الجملة التحليلية المطلوبة. ولا تذكر الأسعار مرة أخرى بالتفصيل بل تحدث عن الاتجاه العام (مثلا السوق راكد، الدولار طاير، اليورو طايح، وهكذا).`;

    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
    });
    
    const text = response.text;
    
    let finalMessage = `📊 *رؤية السوق* 📊\n`;
    finalMessage += `━━━━━━━━━━━━━━━━━\n`;
    finalMessage += `${text?.trim()}\n`;
    finalMessage += `━━━━━━━━━━━━━━━━━\n`;
    const analysisRandomCode1 = Math.floor(100000 + Math.random() * 900000);
    finalMessage += `🔗 تابع التحديثات الحية على منصتنا:\n🌐 https://dollar-price-qp14.onrender.com/?r=${analysisRandomCode1}\n\n`;
    finalMessage += `📱 المصدر: شبكة مراسلي مؤشر الدينار | الدقة والسرعة`;

    res.json({ success: true, message: finalMessage });
  } catch (err: any) {
    console.error('Error generating analysis:', err);
    res.status(500).json({ success: false, error: err.message || "Failed to generate analysis" });
  }
});

router.post('/telegram/publish-analysis', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: "Gemini API Key is not configured." });
    }
    
    const { channel } = req.body;
    const targetChannel = channel || appConfig.telegramPostChannel;
    
    if (!targetChannel) {
       return res.status(400).json({ success: false, error: "لا يوجد قناة محددة للنشر." });
    }
    
    const tgMgr = getOrInitTelegramManager();
    if (!tgMgr) {
      return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
    }

    const updates = [];
    const termsToInclude = ["USD", "EUR", "GBP", "TND", "EGP"];
    for (const t of appConfig.terms) {
      if (termsToInclude.includes(t.id)) {
         const currentR = rates.parallel[t.id];
         const prevR = rates.previousParallel[t.id];
         if (currentR) {
            updates.push(`- ${t.name}: السعر الحالي ${currentR.toFixed(3)} ${prevR && currentR !== prevR ? '(كان '+prevR.toFixed(3)+')' : ''}`);
         }
      }
    }

    const prompt = `أنت خبير اقتصادي ومحلل مالي ليبي متخصص في سوق العملات ومؤشر الدينار الليبي. بناءً على التغيرات التالية في أسعار الصرف في السوق الموازي:
${updates.join('\n')}
قم بكتابة نبذة أو تعليق مختصر (بحد أقصى 3-4 أسطر) يصف حالة السوق (استقرار، صعود، أو هبوط) بلهجة ليبية عامية محترفة ولبقة.
يجب أن تكون جذابة وصالحة للنشر بقناة تيليجرام.
لا تستخدم أي مقدمات أو خاتمات زائدة من قبيل "حسنا سأقوم بذلك"، فقط الجملة التحليلية المطلوبة. ولا تذكر الأسعار مرة أخرى بالتفصيل بل تحدث عن الاتجاه العام (مثلا السوق راكد، الدولار طاير، اليورو طايح، وهكذا).`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
    });
    
    const text = response.text;
    
    let finalMessage = `📊 *رؤية السوق* 📊\n`;
    finalMessage += `━━━━━━━━━━━━━━━━━\n`;
    finalMessage += `${text?.trim()}\n`;
    finalMessage += `━━━━━━━━━━━━━━━━━\n`;
    const analysisRandomCode2 = Math.floor(100000 + Math.random() * 900000);
    finalMessage += `🔗 تابع التحديثات الحية على منصتنا:\n🌐 https://dollar-price-qp14.onrender.com/?r=${analysisRandomCode2}\n\n`;
    finalMessage += `📱 المصدر: شبكة مراسلي مؤشر الدينار | الدقة والسرعة`;

    await broadcastToSocialMedia(finalMessage, true, 'telegram');

    res.json({ success: true, message: "تم نشر التحليل الاقتصادي بنجاح" });
  } catch (err: any) {
    console.error('Error publishing analysis:', err);
    res.status(500).json({ success: false, error: err.message || "Failed to publish analysis" });
  }
});

export default router;
