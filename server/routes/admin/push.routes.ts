import express from 'express';
import rateLimit from 'express-rate-limit';
import { pushOverview, startPushCampaign, sendPushTest, validPushSubscription } from '../../services/push.service';

const router = express.Router();
const limiter = rateLimit({windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: {success: false, error: 'طلبات إرسال كثيرة. أعد المحاولة لاحقًا.'}});
const destinations = ['/', '/#rates-section', '/#charts-section', '/#currency-converter-section', '/#metals-grid'];

router.get('/push/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await pushOverview()); }
  catch { res.status(503).json({error: 'تعذر قراءة خدمة الإشعارات.'}); }
});

router.post('/push/:action(send|test)', limiter, async (req, res) => {
  const {title, body, url = '/'} = req.body || {};
  if (typeof title !== 'string' || typeof body !== 'string' || !title.trim() || !body.trim() || title.trim().length > 60 || body.trim().length > 240 || !destinations.includes(url)) {
    return res.status(400).json({success: false, error: 'أدخل عنوانًا حتى 60 حرفًا ونصًا حتى 240 حرفًا ووجهة صحيحة داخل الموقع.'});
  }
  try {
    if (req.params.action === 'test') {
      if (!validPushSubscription(req.body.subscription)) return res.status(400).json({success: false, error: 'فعّل اشتراك هذا الجهاز أولًا.'});
      await sendPushTest(req.body.subscription, title.trim(), body.trim(), url);
      return res.json({success: true, message: 'قبلت خدمة Push رسالة الاختبار لهذا الجهاز فقط.'});
    }
    const campaign = await startPushCampaign(title.trim(), body.trim(), url);
    res.status(202).json({success: true, campaign});
  } catch (error: any) {
    res.status(error.status || 503).json({success: false, error: error.status ? error.message : 'تعذر إرسال الإشعار. راجع حالة الخدمة.'});
  }
});

export default router;
