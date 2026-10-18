import express from "express";
import crypto from "crypto";
import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import { PUBLIC_API_DEFAULTS, PUBLIC_API_BOUNDS, PUBLIC_API_CAPACITY } from '../../shared/developerApi';
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
const MAX_BANNED_IPS = 10000;

function pruneBannedIPs(now = Date.now()) {
  for (const [ip, expiry] of bannedIPs) {
    if (expiry <= now) bannedIPs.delete(ip);
  }
  apiStats.bannedIPsCount = bannedIPs.size;
}

export const developerApiHeaders: express.RequestHandler = (_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Accept',
    'Access-Control-Expose-Headers': 'Retry-After, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset' });
  next();
};

export const ipBanMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  pruneBannedIPs();
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ip && bannedIPs.has(ip)) {
    const banExpiry = bannedIPs.get(ip)!;
    if (Date.now() < banExpiry) {
      res.status(403).json({ success: false, error: "Your IP is temporarily banned due to excessive requests or suspicious activity." });
      return;
    } else {
      bannedIPs.delete(ip);
      apiStats.bannedIPsCount = bannedIPs.size;
    }
  }
  next();
};

export const suspiciousRoutes = ['/.env', '/wp-admin', '/wp-login.php', '/config.php', '/phpmyadmin'];
export const suspiciousActivityMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (suspiciousRoutes.some(route => req.path.toLowerCase().includes(route))) {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip) {
      pruneBannedIPs();
      while (bannedIPs.size >= MAX_BANNED_IPS) {
        const oldest = bannedIPs.keys().next().value;
        if (oldest === undefined) break;
        bannedIPs.delete(oldest);
      }
      bannedIPs.set(ip, Date.now() + 30 * 24 * 60 * 60 * 1000);
      apiStats.bannedIPsCount = bannedIPs.size;
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
    const limit = req.path === '/api/internal/notify-rates-updated' && req.query.wait === 'true' ? 20000
      : /^\/api\/(?:admin\/)?push\//.test(req.path) ? 15000 : 5000;
    res.setTimeout(limit, () => {
      if (!res.headersSent) {
        res.status(408).json({ success: false, error: `Request Timeout (${limit / 1000}s limit exceeded)` });
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
  const knownKeys = [process.env.CRON_SECRET].filter(Boolean) as string[];

  for (const validKey of knownKeys) {
    try {
      const expectedBuffer = Buffer.from(validKey.trim(), 'utf8');
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
    if (/^\/public\/rates\/?$/i.test(req.path)) return true;
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
    const ip = req.ip || req.socket.remoteAddress;
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
    const ip = req.ip || req.socket.remoteAddress;
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
    const ip = req.ip || req.socket.remoteAddress;
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

export function getPublicApiConfig() {
  const config = appConfig.apiConfig;
  const bounded = (value: unknown, min: number, max: number, fallback: number) =>
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
  return {
    enabled: config?.enabled !== false,
    rateLimitWindowMs: bounded(config?.rateLimitWindowMs, PUBLIC_API_BOUNDS.minWindow, PUBLIC_API_BOUNDS.maxWindow, PUBLIC_API_DEFAULTS.rateLimitWindowMs),
    rateLimitMaxRequests: bounded(config?.rateLimitMaxRequests, PUBLIC_API_BOUNDS.minRequests, PUBLIC_API_BOUNDS.maxRequests, PUBLIC_API_DEFAULTS.rateLimitMaxRequests),
  };
}

let publicWindow = 0;
let publicStore: MemoryStore;
let publicLimiter: ReturnType<typeof rateLimit>;
const publicCapacityLimiter = rateLimit({
  windowMs: 60000, limit: PUBLIC_API_CAPACITY, keyGenerator: () => 'public-api',
  standardHeaders: false, legacyHeaders: false,
  handler: (_req, res) => {
    res.set('Retry-After', '60').status(429).json({ success: false, error: 'API_BUSY', message: 'Service capacity reached. Retry later.' });
  },
});

// Separate quotas protect the API without banning visitors from the rest of the site.
export const publicApiLimiter: express.RequestHandler = (req, res, next) => {
  publicCapacityLimiter(req, res, () => {
    const config = getPublicApiConfig();
    if (publicWindow !== config.rateLimitWindowMs) {
      publicStore?.shutdown();
      publicWindow = config.rateLimitWindowMs;
      publicStore = new MemoryStore();
      publicLimiter = rateLimit({ windowMs: publicWindow, store: publicStore,
        // Runtime settings rebuild this one limiter and shut down its previous store.
        validate: { creationStack: false },
        limit: () => getPublicApiConfig().rateLimitMaxRequests,
        standardHeaders: true, legacyHeaders: false,
        message: { success: false, error: 'RATE_LIMITED', message: 'Request quota exceeded. Respect Retry-After.' },
      });
    }
    const key = ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
    if (publicStore.current.size + publicStore.previous.size >= 10000 &&
        !publicStore.current.has(key) && !publicStore.previous.has(key)) {
      res.set('Retry-After', '60').status(503).json({ success: false, error: 'API_BUSY' });
      return;
    }
    publicLimiter(req, res, next);
  });
};
