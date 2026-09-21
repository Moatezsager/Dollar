import express from 'express';
import crypto from 'crypto';

export let adminToken = crypto.randomBytes(32).toString('hex');

export function getAdminToken(): string {
  return adminToken;
}

export function setAdminToken(token: string): void {
  adminToken = token;
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (
      token.length === adminToken.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminToken))
    ) {
      return next();
    }
  }
  res.status(401).json({ success: false, message: "غير مصرح" });
}

