import express from 'express';
import crypto from 'crypto';

export let adminToken = crypto.randomBytes(32).toString('hex');
export let tokenCreatedAt = Date.now();

export function getAdminToken(): string {
  return adminToken;
}

export function setAdminToken(token: string): void {
  adminToken = token;
  tokenCreatedAt = Date.now();
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function safeCompare(a?: string | null, b?: string | null): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (safeCompare(token, adminToken)) {
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      if (Date.now() - tokenCreatedAt > TWENTY_FOUR_HOURS_MS) {
        res.status(401).json({ success: false, message: "انتهت صلاحية الجلسة" });
        return;
      }
      return next();
    }
  }
  res.status(401).json({ success: false, message: "غير مصرح" });
}


