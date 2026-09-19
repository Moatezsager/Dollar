import express from 'express';

export let adminToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

export function getAdminToken() {
  return adminToken;
}

export function setAdminToken(token: string) {
  adminToken = token;
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${adminToken}`) {
    next();
  } else {
    res.status(401).json({ success: false, message: "غير مصرح" });
  }
}
