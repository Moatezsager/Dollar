import express from 'express';
import crypto from 'crypto';

const router = express.Router();

async function callWorkerWhatsApp(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: object
): Promise<{ status: number; data: any }> {
  const workerUrl = (process.env.WORKER_SERVER_URL || '').trim();
  const secret   = (process.env.WORKER_INTERNAL_SECRET || '').trim();

  if (!workerUrl || !secret) {
    return { status: 503, data: { success: false, error: 'Worker URL غير مضبوط' } };
  }

  try {
    const res = await fetch(`${workerUrl}/api/whatsapp/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': secret,
        'User-Agent': 'Dollar-Price-Web/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return { status: res.status, data };
  } catch (err: any) {
    return { status: 500, data: { success: false, error: err?.message } };
  }
}

// الحالة — يجلب من Worker
router.get('/whatsapp/status', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('status', 'GET');
  if (res.headersSent || res.destroyed) return;
  res.status(result.status).json(result.data);
});

// تهيئة — يُرسِل لـ Worker
router.post('/whatsapp/init', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('init');
  if (res.headersSent || res.destroyed) return;
  res.status(result.status).json(result.data);
});

// قطع الاتصال — يُرسِل لـ Worker
router.post('/whatsapp/disconnect', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('disconnect');
  if (res.headersSent || res.destroyed) return;
  res.status(result.status).json(result.data);
});

// QR code — يجلب من Worker
router.get('/whatsapp/qr', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('qr', 'GET');
  if (res.headersSent || res.destroyed) return;
  res.status(result.status).json(result.data);
});

router.post('/whatsapp/toggle-auto', async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'enabled must be boolean' });
    return;
  }
  const result = await callWorkerWhatsApp('toggle-auto', 'POST', { enabled: req.body.enabled });
  if (res.headersSent || res.destroyed) return;
  res.status(result.status).json(result.data);
});

export default router;
