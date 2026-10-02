import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";

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
import { rates } from "./state";
import { getUserLogs, clearUserLogs } from "./services/maintenance.service";
import { 
  getOnlineUsers, 
  broadcastRatesUpdate, 
  broadcastConfigUpdate, 
  broadcastUserLogs 
} from "./socket/socket.service";

export async function createApp(io: SocketIOServer) {
  const app = express();

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
  } else {
    const distPath = path.join(process.cwd(), "dist");

    interface HtmlCache {
      html: string;
      builtAt: number;
      usdSnapshot: number;
      etag: string;
    }
    let cachedHtmlPage: HtmlCache | null = null;
    const HTML_CACHE_TTL_MS = 5 * 60 * 1000;

    function buildAndCacheHtml(): HtmlCache {
      let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');

      if (rates?.parallel?.USD) {
        const usdStr = rates.parallel.USD.toFixed(2);
        const eurStr = (rates.parallel.EUR || 0).toFixed(2);
        const dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | مؤشر الدينار`;
        const dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل، واليورو ${eurStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة.`;

        html = html
          .replace(/<title>.*?<\/title>/i, `<title>${dynamicTitle}</title>`)
          .replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta name="description" content="${dynamicDesc}">`)
          .replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="og:title" content="${dynamicTitle}">`)
          .replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="og:description" content="${dynamicDesc}">`)
          .replace(/<meta\s+property=["']twitter:title["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="twitter:title" content="${dynamicTitle}">`)
          .replace(/<meta\s+property=["']twitter:description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="twitter:description" content="${dynamicDesc}">`);
      }

      const etag = `"${Buffer.from(`${rates?.parallel?.USD || 0}-${Date.now()}`).toString('base64').slice(0, 16)}"`;
      cachedHtmlPage = { html, builtAt: Date.now(), usdSnapshot: rates?.parallel?.USD || 0, etag };
      console.log('[HtmlCache] ✅ Rebuilt HTML cache. ETag:', etag);
      return cachedHtmlPage;
    }

    // Build initial cache on startup
    buildAndCacheHtml();

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
    
    // SPA fallback with in-memory caching and ETag support
    app.get(/^(?!.*\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest|xml)$).*$/, (req, res) => {
      const now = Date.now();
      const cacheExpired = !cachedHtmlPage || (now - cachedHtmlPage.builtAt) >= HTML_CACHE_TTL_MS;
      const rateChanged = cachedHtmlPage && cachedHtmlPage.usdSnapshot !== (rates?.parallel?.USD || 0);

      const cache = (cacheExpired || rateChanged) ? buildAndCacheHtml() : cachedHtmlPage!;

      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === cache.etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('ETag', cache.etag);
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.send(cache.html);
    });
  }

  return app;
}
