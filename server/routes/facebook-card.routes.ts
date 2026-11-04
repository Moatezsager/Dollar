import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFacebookMarketCard } from '../services/facebook-market-card.service';

const router = Router();
router.get('/internal/facebook-market-card', async (req, res) => {
  const expected = (process.env.WORKER_INTERNAL_SECRET || '').trim();
  const given = String(req.headers['x-worker-secret'] || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  if (!expected || !given) return res.status(401).json({ success: false });
  if (!timingSafeEqual(createHash('sha256').update(expected).digest(), createHash('sha256').update(given).digest())) return res.status(403).json({ success: false });
  try {
    const card = await readFacebookMarketCard();
    if (!res.headersSent && !res.destroyed) res.json(card);
  } catch {
    if (!res.headersSent && !res.destroyed) res.status(503).json({ success: false, error: 'تعذر تجهيز صورة أسعار اليوم؛ لن تُنشر بيانات غير مكتملة.' });
  }
});
export default router;
