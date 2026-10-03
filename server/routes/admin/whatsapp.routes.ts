import express from 'express';
import { whatsappManager } from '../../services/whatsapp.service';

const router = express.Router();

// WhatsApp Management Routes
router.get('/whatsapp/status', (req: express.Request, res: express.Response) => {
  try {
    const status = whatsappManager.getStatus();
    res.json({ success: true, data: status });
  } catch (err: any) {
    console.error('[Admin] Error getting WhatsApp status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/whatsapp/init', async (req: express.Request, res: express.Response) => {
  try {
    whatsappManager.initClient().catch(console.error);
    res.json({ success: true, message: 'جاري تهيئة عميل واتساب وتوليد الرمز...' });
  } catch (err: any) {
    console.error('[Admin] Error initializing WhatsApp client:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/whatsapp/disconnect', async (req: express.Request, res: express.Response) => {
  try {
    await whatsappManager.disconnect();
    res.json({ success: true, message: 'تم قطع الاتصال وحذف الجلسة بنجاح' });
  } catch (err: any) {
    console.error('[Admin] Error disconnecting WhatsApp:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/whatsapp/toggle-auto', (req: express.Request, res: express.Response) => {
  try {
    const { enabled } = req.body;
    whatsappManager.setAutoProcess(!!enabled);
    res.json({ success: true, enabled: !!enabled });
  } catch (err: any) {
    console.error('[Admin] Error toggling WhatsApp auto-processing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
