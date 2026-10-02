import express from 'express';
import { requireAdmin } from '../../middleware/auth';
import { DeviceLogEntry, Rates } from '../../types';

// Admin Sub-routers
import authRouter from './auth.routes';
import messagesRouter from './messages.routes';
import { createAdminConfigRouter } from './config.routes';
import { createAdminRatesRouter } from './rates.routes';
import { createAdminDatabaseRouter } from './database.routes';
import telegramRouter from './telegram.routes';
import aiRouter from './ai.routes';
import whatsappRouter from './whatsapp.routes';
import { createAdminSystemRouter } from './system.routes';
import logsRouter from './logs.routes';

export interface AdminRouterDeps {
  io?: any;
  publicApiLimiter?: any;
  getPublicApiLimiter?: () => any;
  getUserLogs: () => DeviceLogEntry[];
  clearUserLogs: () => void;
  getOnlineUsers: () => number;
  apiStats: any;
  broadcastRatesUpdate: (rates: Rates) => void;
  broadcastConfigUpdate: () => void;
  broadcastUserLogs: () => void;
}

export function createAdminRouter(deps: AdminRouterDeps): express.Router {
  const router = express.Router();

  // 1. Auth routes (public within /api/admin context - handles /login)
  router.use('/', authRouter);

  // 2. Authentication Middleware - Protect all subsequent admin endpoints
  router.use(requireAdmin);

  // 3. Messages management
  router.use('/', messagesRouter);

  // 4. Configuration & API Settings
  router.use('/', createAdminConfigRouter({
    apiStats: deps.apiStats,
    publicApiLimiter: deps.publicApiLimiter,
    getPublicApiLimiter: deps.getPublicApiLimiter,
    getUserLogs: deps.getUserLogs,
    clearUserLogs: deps.clearUserLogs,
    broadcastRatesUpdate: deps.broadcastRatesUpdate,
    broadcastConfigUpdate: deps.broadcastConfigUpdate,
    broadcastUserLogs: deps.broadcastUserLogs,
  }));

  // 5. Rates & Scraper endpoints
  router.use('/', createAdminRatesRouter({
    broadcastRatesUpdate: deps.broadcastRatesUpdate,
  }));

  // 6. Database & Records management
  router.use('/', createAdminDatabaseRouter({
    broadcastRatesUpdate: deps.broadcastRatesUpdate,
    clearUserLogs: deps.clearUserLogs,
  }));

  // 7. Telegram & Social broadcast
  router.use('/', telegramRouter);

  // 8. AI Market Analysis
  router.use('/', aiRouter);

  // 9. WhatsApp management
  router.use('/', whatsappRouter);

  // 10. System, diagnostics, analytics & reports
  router.use('/', createAdminSystemRouter({
    io: deps.io,
    getOnlineUsers: deps.getOnlineUsers,
    apiStats: deps.apiStats,
    getUserLogs: deps.getUserLogs,
  }));

  // 11. Error logs & Broadcast logs
  router.use('/', logsRouter);

  return router;
}

export default createAdminRouter;
