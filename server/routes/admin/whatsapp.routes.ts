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
      },
      body: body ? JSON.stringify(body) : undefined,
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
  res.status(result.status).json(result.data);
});

// تهيئة — يُرسِل لـ Worker
router.post('/whatsapp/init', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('init');
  res.status(result.status).json(result.data);
});

// قطع الاتصال — يُرسِل لـ Worker
router.post('/whatsapp/disconnect', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('disconnect');
  res.status(result.status).json(result.data);
});

// QR code — يجلب من Worker
router.get('/whatsapp/qr', async (req: express.Request, res: express.Response) => {
  const result = await callWorkerWhatsApp('qr', 'GET');
  res.status(result.status).json(result.data);
});

export default router;
