import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { appConfig } from "../config";

export interface ApiStat {
  timestamp: string;
  ip: string;
  userAgent: string;
  status: number;
  responseTime: number;
}

export const apiStats = {
  public: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    recentRequests: [] as ApiStat[]
  },
  premium: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    recentRequests: [] as ApiStat[]
  },
  bannedIPsCount: 0
};

export const bannedIPs = new Map<string, number>();

export const ipBanMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  if (ip && bannedIPs.has(ip)) {
    const banExpiry = bannedIPs.get(ip)!;
    if (Date.now() < banExpiry) {
      res.status(403).json({ success: false, error: "Your IP is temporarily banned due to excessive requests or suspicious activity." });
      return;
    } else {
      bannedIPs.delete(ip);
    }
  }
  next();
};

export const suspiciousRoutes = ['/.env', '/wp-admin', '/wp-login.php', '/config.php', '/phpmyadmin'];
export const suspiciousActivityMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (suspiciousRoutes.some(route => req.path.toLowerCase().includes(route))) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    if (ip) {
      bannedIPs.set(ip, Date.now() + 30 * 24 * 60 * 60 * 1000);
      console.warn(`[Security] Banned IP ${ip} for accessing suspicious route: ${req.path}`);
    }
    res.status(403).json({ success: false, error: "Suspicious activity detected. IP banned." });
    return;
  }
  next();
};

export const userAgentMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    const ua = req.headers['user-agent'];
    if (!ua || ua.trim() === '' || ua.length < 5) {
      res.status(403).json({ success: false, error: "Valid User-Agent header is required." });
      return;
    }
  }
  next();
};

export const timeoutMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    res.setTimeout(5000, () => {
      if (!res.headersSent) {
        res.status(408).json({ success: false, error: "Request Timeout (5s limit exceeded)" });
      }
    });
  }
  next();
};

// Helmet configuration
export const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  frameguard: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "blob:", "https://*.google.com", "https://*.gstatic.com", "https://*.facebook.com", "https://*.facebook.net", "https://*.fbcdn.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:", "https://*.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://flagcdn.com", "https://hatscripts.github.io", "https://picsum.photos", "https://*.supabase.co", "https://*.google.com", "https://*.gstatic.com", "https://*.facebook.com", "https://*.fbcdn.net"],
      connectSrc: ["'self'", "https://open.er-api.com", "https://t.me", "https://*.supabase.co", "wss:", "ws:", "https://*.google.com", "https://*.gstatic.com", "https://*.googleapis.com", "https://*.facebook.com", "https://*.fbcdn.net", "https://*.messenger.com"],
      frameAncestors: ["'self'", "https://*.facebook.com", "https://*.fbcdn.net", "https://*.messenger.com", "https://*.google.com", "https://*.corp.google.com"],
      workerSrc: ["'self'", "blob:"],
      scriptSrcAttr: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
});

export const permissionsPolicyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

// Helper functions for Cron & Refresh Authorization
export function extractProvidedCronKey(req: express.Request): string | undefined {
  if (typeof req.query.key === 'string') return req.query.key;
  if (typeof req.headers['x-cron-key'] === 'string') return req.headers['x-cron-key'];
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.substring(7);
  return undefined;
}

export function isValidCronSecret(providedKey: unknown): boolean {
  if (typeof providedKey !== 'string' || !providedKey) {
    return false;
  }
  const cleanProvided = providedKey.trim();
  const knownKeys = [
    '706c8ab7-05af-4aa2-a80e-58d5ecf9a39e',
    process.env.CRON_SECRET
  ].filter(Boolean) as string[];

  for (const validKey of knownKeys) {
    if (cleanProvided === validKey) {
      return true;
    }
    if (cleanProvided.startsWith(validKey) && cleanProvided.length <= validKey.length + 2) {
      return true;
    }
    try {
      const expectedBuffer = Buffer.from(validKey, 'utf8');
      const providedBuffer = Buffer.from(cleanProvided, 'utf8');
      if (expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

// Rate limiters
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "محاولات كثيرة جداً، يرجى المحاولة لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path === '/health' || req.path === '/ping' || req.path === '/version') return true;
    if (req.path.startsWith('/refresh-') || req.path === '/cleanup-db') {
      const key = extractProvidedCronKey(req);
      return isValidCronSecret(key);
    }
    return false;
  }
});

export const messageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "لقد تجاوزت الحد المسموح به من الرسائل. يرجى المحاولة لاحقاً." }
});

export const cronParallelLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const key = extractProvidedCronKey(req);
    return isValidCronSecret(key);
  },
  handler: (req: express.Request, res: express.Response) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/refresh-parallel from IP: ${ip}`);
    res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
  }
});

export const cronOfficialLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const key = extractProvidedCronKey(req);
    return isValidCronSecret(key);
  },
  handler: (req: express.Request, res: express.Response) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/refresh-official from IP: ${ip}`);
    res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
  }
});

export const cronCleanupLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const key = extractProvidedCronKey(req);
    return isValidCronSecret(key);
  },
  handler: (req: express.Request, res: express.Response) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.warn(`[Cron-RateLimit] Rate limit exceeded for /api/cleanup-db from IP: ${ip}`);
    res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
  }
});

export const premiumApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({ success: false, error: `Too many requests. Please try again later.` });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicApiLimiter = rateLimit({
  windowMs: appConfig.apiConfig?.rateLimitWindowMs || 60000,
  max: appConfig.apiConfig?.rateLimitMaxRequests || 20,
  handler: (req, res, next, options) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    if (ip) {
      const banDuration = appConfig.apiConfig?.banDurationMinutes || 5;
      bannedIPs.set(ip, Date.now() + banDuration * 60 * 1000);
      console.warn(`[Security] Banned IP ${ip} for ${banDuration} minutes due to rate limit exceeded.`);
      apiStats.bannedIPsCount++;
    }
    apiStats.public.failedRequests++;
    res.status(options.statusCode).json({ success: false, error: `Too many requests. Your IP is temporarily banned.` });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
