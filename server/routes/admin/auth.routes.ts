import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminToken, safeCompare } from '../../middleware/auth';

const router = express.Router();

// Rate limiter for admin login (5 attempts max per 15 minutes per IP)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: express.Request, res: express.Response) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    console.warn(`[Admin Login Rate Limit] Limit exceeded for IP: ${ip}`);
    res.status(429).json({ success: false, message: "محاولات كثيرة، حاول بعد قليل" });
  }
});

// Login endpoint - public within admin context
router.post('/login', adminLoginLimiter, async (req: express.Request, res: express.Response) => {
  const { password } = req.body;
  const effectiveAdminPassword = process.env.ADMIN_PASSWORD;
  if (effectiveAdminPassword && safeCompare(password, effectiveAdminPassword)) {
    res.json({ success: true, token: adminToken });
  } else {
    // Add random delay (50-200ms) on auth failure to prevent timing and enumeration attacks
    const delay = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
    await new Promise(resolve => setTimeout(resolve, delay));
    res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
  }
});

export default router;
