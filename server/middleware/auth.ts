import express from 'express';
import crypto from 'crypto';

const AUTH_SALT = process.env.API_HMAC_SECRET || 'lyd-admin-secure-persistent-key-2026';

export function computeStableAdminToken(password = process.env.ADMIN_PASSWORD || 'admin123456'): string {
  return crypto.createHmac('sha256', AUTH_SALT).update(password.trim()).digest('hex');
}

export let adminToken = computeStableAdminToken();
export let sessionToken = crypto.randomBytes(32).toString('hex');
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
    const token = authHeader.slice(7).trim();
    if (safeCompare(token, adminToken) || safeCompare(token, sessionToken)) {
      return next();
    }
  }
  res.status(401).json({ success: false, message: "غير مصرح" });
}


