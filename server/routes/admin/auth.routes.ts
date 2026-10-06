import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminToken, sessionToken, safeCompare, computeStableAdminToken } from '../../middleware/auth';
import { bannedIPs } from '../../middleware/security';

const router = express.Router();

// Rate limiter for admin login (30 attempts max per 15 minutes, skipping successful logins)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: express.Request, res: express.Response) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    console.warn(`[Admin Login Rate Limit] Limit exceeded for IP: ${ip}`);
    res.status(429).json({ success: false, message: "محاولات كثيرة جداً، يرجى الانتظار بضع دقائق ثم إعادة المحاولة" });
  }
});

// Login endpoint - public within admin context
router.post('/login', adminLoginLimiter, async (req: express.Request, res: express.Response) => {
  const { password } = req.body || {};
  const enteredPassword = typeof password === 'string' ? password.trim() : '';
  const effectiveAdminPassword = (process.env.ADMIN_PASSWORD || 'admin123456').trim();

  if (enteredPassword && safeCompare(enteredPassword, effectiveAdminPassword)) {
    // Clear any accidental IP ban
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    if (clientIp && bannedIPs.has(clientIp)) {
      bannedIPs.delete(clientIp);
    }
    const token = computeStableAdminToken(effectiveAdminPassword);
    res.json({ success: true, token });
  } else {
    // Add small random delay (30-100ms) on auth failure to prevent timing attacks
    const delay = Math.floor(Math.random() * (100 - 30 + 1)) + 30;
    await new Promise(resolve => setTimeout(resolve, delay));
    res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
  }
});

export default router;
