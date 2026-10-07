import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";
import crypto from 'crypto';
import { rates } from './state';
import { broadcastRatesUpdate } from './socket/socket.service';
import { syncLatestRatesFromDB } from './services/db.service';
import { injectDynamicMetaTags } from './services/preview.service';
import { isSignificantChange } from './utils/helpers';

// Middlewares
import {
  ipBanMiddleware,
  suspiciousActivityMiddleware,
  userAgentMiddleware,
  timeoutMiddleware,
  helmetMiddleware,
  permissionsPolicyMiddleware,
  apiLimiter,
  publicApiLimiter,
  apiStats
} from "./middleware/security";

// Routers
import ratesRouter from "./routes/rates.routes";
import cronRouter from "./routes/cron.routes";
import pushRouter, { handlePushSwRoute } from "./routes/push.routes";
import trackingRouter, { handleTelegramPageRoute, handleTelegramBannerRoute } from "./routes/tracking.routes";
import systemRouter from "./routes/system.routes";
import { createAdminRouter } from "./routes/admin.routes";

// State and services
import { getUserLogs, clearUserLogs } from "./services/maintenance.service";
import { 
  getOnlineUsers, 
  broadcastConfigUpdate, 
  broadcastUserLogs 
} from "./socket/socket.service";

export const PORT = Number(process.env.PORT) || 3000;

export async function createApp(io?: SocketIOServer | null) {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  app.set('port', port);

  // Core Express Middlewares
  app.use(compression());
  app.use(express.json());
  app.set('trust proxy', 1);

  // Security Middlewares
  app.use(ipBanMiddleware);
  app.use(suspiciousActivityMiddleware);
  app.use(userAgentMiddleware);
  app.use(timeoutMiddleware);
  app.use(helmetMiddleware);
  app.use(permissionsPolicyMiddleware);

  // Global API Rate Limiter
  app.use("/api/", apiLimiter);

  // Admin Routes
  app.use('/api/admin', createAdminRouter({
    io,
    getPublicApiLimiter: () => publicApiLimiter,
    getUserLogs: () => getUserLogs(),
    clearUserLogs: () => { clearUserLogs(); },
    getOnlineUsers: () => getOnlineUsers(),
    apiStats,
    broadcastRatesUpdate,
    broadcastConfigUpdate,
    broadcastUserLogs,
  }));

  // Modular API Routers
  app.use("/api", ratesRouter);
  app.use("/api", cronRouter);
  app.use("/api", pushRouter);
  app.use("/api", trackingRouter);
  app.use("/api", systemRouter);

  // Dedicated push service worker & Telegram landing routes
  app.get("/push-sw.js", handlePushSwRoute);
  app.get(["/telegram", "/telegram.html"], handleTelegramPageRoute);
  app.get("/telegram-banner.png", handleTelegramBannerRoute);

  // ─── Worker → Web Webhook ───
  app.post('/api/internal/notify', (req: express.Request, res: express.Response) => {
    const configuredSecret = (process.env.WORKER_INTERNAL_SECRET || '').trim();
    const providedSecret = (
      (req.headers['x-worker-secret'] as string) ||
      (req.headers['authorization'] as string || '').replace('Bearer ', '')
    ).trim();

    if (!configuredSecret || !providedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hashA = crypto.createHash('sha256').update(configuredSecret).digest();
      const hashB = crypto.createHash('sha256').update(providedSecret).digest();
      if (!crypto.timingSafeEqual(hashA, hashB)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch {
      return res.status(500).json({ error: 'Verification error' });
    }

    const { ratesParallel, ratesOfficial, lastChanged, lastUpdated } = req.body || {};
    
    // 1. Process parallel rates: only update lastChanged if rate actually changed
    if (ratesParallel && typeof ratesParallel === 'object') {
      for (const [code, val] of Object.entries(ratesParallel)) {
        if (typeof val === 'number' && val > 0) {
          const currentVal = rates.parallel[code];
          if (currentVal && isSignificantChange(currentVal, val)) {
            rates.previousParallel[code] = currentVal;
            rates.parallel[code] = val;
            rates.lastChanged.parallel[code] = lastChanged?.parallel?.[code] || new Date().toISOString();
          } else {
            rates.parallel[code] = val;
            if (!rates.lastChanged.parallel[code] && lastChanged?.parallel?.[code]) {
              rates.lastChanged.parallel[code] = lastChanged.parallel[code];
            }
          }
        }
      }
    }

    // 2. Process official rates
    if (ratesOfficial && typeof ratesOfficial === 'object') {
      for (const [code, val] of Object.entries(ratesOfficial)) {
        if (typeof val === 'number' && val > 0) {
          const currentVal = rates.official[code];
          if (currentVal && isSignificantChange(currentVal, val)) {
            rates.previousOfficial[code] = currentVal;
            rates.official[code] = val;
            rates.lastChanged.official[code] = lastChanged?.official?.[code] || new Date().toISOString();
          } else {
            rates.official[code] = val;
            if (!rates.lastChanged.official[code] && lastChanged?.official?.[code]) {
              rates.lastChanged.official[code] = lastChanged.official[code];
            }
          }
        }
      }
    }

    if (lastUpdated && typeof lastUpdated === 'string') {
      rates.lastUpdated = lastUpdated;
    }

    // Trigger complete sync from Supabase database tables to capture full history, previous rates, and metals
    syncLatestRatesFromDB("Worker Webhook Notification").catch(err => {
      console.error("[WebServer] Error syncing rates after worker notification:", err);
    });

    broadcastRatesUpdate(rates);
    console.log('[WebServer] ✅ Rates from Worker broadcasted via Socket.IO');
    return res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Catch-all 404 for any remaining unmatched /api/* routes
  app.all("/api/*", (req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  // Vite development mode vs Production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Dev HTML fallback with dynamic meta-tags
    app.use("*", async (req, res, next) => {
      if (req.method !== "GET") return next();
      const url = req.originalUrl.split("?")[0];
      if (/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest|xml)$/i.test(url)) {
        return next();
      }
      try {
        const rawIndex = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawIndex);
        const dynamicHtml = injectDynamicMetaTags(transformed, false);
        res.setHeader("Content-Type", "text/html; charset=UTF-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.status(200).send(dynamicHtml);
      } catch (e) {
        return next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    let rawIndexHtml = "";
    try {
      rawIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    } catch {
      // Will read on demand if not ready yet
    }

    app.use(express.static(distPath, { 
      index: false,
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (/\.(jpg|jpeg|png|gif|ico|svg|webp|woff2?|ttf|eot)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    }));
    
    // SPA fallback: Real-time dynamic meta tags injection on every HTML request for link previews & crawlers
    app.get(/^(?!.*\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest|xml)$).*$/, (req, res) => {
      if (!rawIndexHtml) {
        try {
          rawIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
        } catch {
          return res.status(500).send("index.html not found");
        }
      }

      const html = injectDynamicMetaTags(rawIndexHtml, false);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.send(html);
    });
  }

  return app;
}
