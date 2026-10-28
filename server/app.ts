import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
  apiStats,
  developerApiHeaders
} from "./middleware/security";

// Routers
import ratesRouter from "./routes/rates.routes";
import cronRouter from "./routes/cron.routes";
import pushRouter, { handlePushSwRoute } from "./routes/push.routes";
import trackingRouter, { handleTelegramPageRoute, handleTelegramBannerRoute } from "./routes/tracking.routes";
import systemRouter from "./routes/system.routes";
import { createAdminRouter } from "./routes/admin.routes";
import { readWeeklyHarvest } from './services/weekly-harvest.service';
import { renderWeeklyHarvestImage, renderWeeklyHarvestPreview } from './services/weekly-harvest-image.service';
import { harvestSocialCaption, harvestWindow } from '../shared/weeklyHarvest';
import { getLibyaDateString } from './utils/helpers';

// State and services
import { rates } from "./state";
import { getUserLogs, clearUserLogs } from "./services/maintenance.service";
import { loadLatestRatesFromSupabase } from "./services/db.service";
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
  const jsonBody = express.json();
  // The image route parses its larger payload after admin authentication.
  app.use((req, res, next) => /^\/api\/admin\/weekly-harvest\/send-telegram\/?$/i.test(req.path) ? next() : jsonBody(req, res, next));
  app.set('trust proxy', 1);
  app.use(['/api/public/rates', '/api/premium/rates'], developerApiHeaders);

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

  // ─── Worker → Web Server: Real-time Rates Notification ───────────────────────
  // Called by the Worker Server after it successfully saves updated rates to Supabase.
  // On receiving this, the Web Server fetches the latest rates and broadcasts to all
  // connected visitors via Socket.IO for instant real-time updates.
  let notificationSync: Promise<boolean> | null = null;
  let notificationPending = false;
  let refreshPreview: (() => void) | undefined;
  app.post("/api/internal/notify-rates-updated", async (req: express.Request, res: express.Response) => {
    const configuredSecret = (process.env.WORKER_INTERNAL_SECRET || "").trim();
    const providedHeader = req.headers["x-worker-secret"] || req.headers["authorization"] || "";
    const provided = typeof providedHeader === "string"
      ? (providedHeader.startsWith("Bearer ") ? providedHeader.substring(7).trim() : providedHeader.trim())
      : "";

    // Reject if secret is not configured or doesn't match
    if (!configuredSecret || !provided) {
      return res.status(401).json({ status: "failed", error: "Missing authentication" });
    }
    try {
      const hashA = crypto.createHash("sha256").update(configuredSecret).digest();
      const hashB = crypto.createHash("sha256").update(provided).digest();
      if (!crypto.timingSafeEqual(hashA, hashB)) {
        console.warn("[Notify] Unauthorized notify-rates-updated call — invalid secret.");
        return res.status(403).json({ status: "failed", error: "Forbidden" });
      }
    } catch {
      return res.status(500).json({ status: "failed", error: "Verification error" });
    }

    const waitForSync = req.query.wait === 'true';
    // Legacy callers retain immediate acknowledgement; publishers wait for completed synchronization.
    if (!waitForSync) res.status(200).json({ status: "accepted", message: "Rates update notification received. Broadcasting..." });

    notificationPending = true;
    if (!notificationSync) {
      notificationSync = (async () => {
        let synchronized = false;
        while (notificationPending) {
          notificationPending = false;
          synchronized = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await loadLatestRatesFromSupabase();
              refreshPreview?.();
              broadcastRatesUpdate(rates);
              synchronized = true;
              console.log("[Notify] Rates refreshed and broadcast via Socket.IO.");
              break;
            } catch (err) {
              if (attempt === 2) console.error("[Notify] Reload failed after three attempts:", err);
              else await new Promise<void>(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            }
          }
        }
        return synchronized;
      })().finally(() => { notificationSync = null; });
    }
    const synchronized = await notificationSync;
    if (waitForSync && !res.headersSent) {
      res.status(synchronized ? 200 : 503).json(synchronized ? {
        status: 'synchronized', lastUpdated: rates.lastUpdated,
        parallel: { USD: rates.parallel.USD || null, EUR: rates.parallel.EUR || null },
        official: { USD: rates.official.USD || null, EUR: rates.official.EUR || null }
      } : { status: 'failed', error: 'Rates synchronization failed' });
    }
  });

  const weeklyCards = new Map<string, { expiresAt: number; data: Awaited<ReturnType<typeof readWeeklyHarvest>>; image: Buffer; preview: Buffer; caption: string }>();
  const weeklyCardReads = new Map<string, Promise<{ expiresAt: number; data: Awaited<ReturnType<typeof readWeeklyHarvest>>; image: Buffer; preview: Buffer; caption: string }>>();
  const getWeeklyCard = async (week: string) => {
    week = getLibyaDateString(new Date(Date.parse(harvestWindow(new Date(`${week}T12:00:00+02:00`)).end) - 86400000));
    const cached = weeklyCards.get(week);
    if (cached && cached.expiresAt > Date.now() && (Date.parse(cached.data.end) > Date.now() || Date.parse(cached.data.generatedAt) >= Date.parse(cached.data.end))) return cached;
    let pending = weeklyCardReads.get(week);
    if (!pending) {
      pending = (async () => {
        const data = await readWeeklyHarvest(new Date(`${week}T12:00:00+02:00`));
        if (!data.items.length) throw new Error('لا توجد قراءات كافية لإعداد الحصاد.');
        const image = await renderWeeklyHarvestImage(data);
        const card = { expiresAt: Date.now() + 10 * 60 * 1000, data, image, preview: await renderWeeklyHarvestPreview(image), caption: harvestSocialCaption(data) };
        weeklyCards.set(week, card);
        while (weeklyCards.size > 4) weeklyCards.delete(weeklyCards.keys().next().value!);
        return card;
      })().finally(() => weeklyCardReads.delete(week));
      weeklyCardReads.set(week, pending);
    }
    return pending;
  };
  const validWeek = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T12:00:00+02:00`);
    return Number.isFinite(time) && getLibyaDateString(new Date(time)) === value && new Date(time).getUTCDay() === 5 &&
      time >= Date.now() - 28 * 86400000 && value <= getLibyaDateString(new Date());
  };
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

  app.get('/api/internal/weekly-harvest', async (req, res) => {
    const expected = (process.env.WORKER_INTERNAL_SECRET || '').trim();
    const given = String(req.headers['x-worker-secret'] || '').trim();
    if (!expected || !given) return res.status(401).json({ success: false });
    const a = crypto.createHash('sha256').update(expected).digest(), b = crypto.createHash('sha256').update(given).digest();
    if (!crypto.timingSafeEqual(a, b)) return res.status(403).json({ success: false });
    try {
      const week = getLibyaDateString(new Date());
      const card = await getWeeklyCard(week);
      if (!card.data.items.length) return res.status(503).json({ success: false, error: 'لا توجد قراءات كافية لإعداد الحصاد.' });
      if (res.headersSent || res.destroyed) return;
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, week: getLibyaDateString(new Date(Date.parse(card.data.end) - 86400000)), caption: card.caption, imageBase64: `data:image/png;base64,${card.image.toString('base64')}` });
    } catch (error: any) {
      if (!res.headersSent && !res.destroyed) res.status(503).json({ success: false, error: error.message || 'تعذر إعداد صورة الحصاد.' });
    }
  });

  app.use('/weekly-report', apiLimiter);
  app.get('/weekly-report/:week.png', async (req, res) => {
    if (!validWeek(req.params.week)) return res.sendStatus(404);
    try {
      const card = await getWeeklyCard(req.params.week);
      if (res.headersSent || res.destroyed) return;
      res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'public, max-age=600');
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.send(req.query.preview === '1' ? card.preview : card.image);
    } catch { if (!res.headersSent && !res.destroyed) res.sendStatus(404); }
  });
  app.get('/weekly-report/:week', async (req, res) => {
    if (!validWeek(req.params.week)) return res.sendStatus(404);
    try {
      const card = await getWeeklyCard(req.params.week);
      const origin = (process.env.APP_URL || 'https://dollar-price-qp14.onrender.com').replace(/\/$/, '');
      const title = `حصاد الأسبوع ${card.data.dateRange} | مؤشر الدينار`;
      const description = card.data.notes.slice(0, 3).join(' ');
      const image = `${origin}/weekly-report/${req.params.week}.png`;
      if (res.headersSent || res.destroyed) return;
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(image)}?preview=1"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escapeHtml(title)}"><meta property="og:url" content="${escapeHtml(`${origin}/weekly-report/${req.params.week}`)}"><meta name="twitter:card" content="summary_large_image"></head><body style="margin:0;background:#f3f7f4;font-family:Arial,sans-serif;color:#15392b"><main style="max-width:900px;margin:24px auto;padding:16px"><h1>${escapeHtml(title)}</h1><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="width:100%;height:auto"><p>${escapeHtml(description)}</p><a href="/">مؤشر الدينار</a></main></body></html>`);
    } catch { if (!res.headersSent && !res.destroyed) res.sendStatus(404); }
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
  } else {
    const distPath = path.join(process.cwd(), "dist");

    interface HtmlCache {
      html: string;
      builtAt: number;
      ratesSnapshot: string;
      etag: string;
    }
    let cachedHtmlPage: HtmlCache | null = null;
    const HTML_CACHE_TTL_MS = 5 * 60 * 1000;
    const previewSnapshot = () => JSON.stringify([rates?.parallel?.USD, rates?.parallel?.EUR]);

    function buildAndCacheHtml(): HtmlCache {
      let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');

      const prices = [
        { value: rates?.parallel?.USD, label: '💵 دولار' },
        { value: rates?.parallel?.EUR, label: '💶 يورو' }
      ].filter(price => Number.isFinite(price.value) && price.value > 0);
      if (prices.length) {
        const summary = prices.map(price => `${price.label}: ${price.value.toFixed(2)}`).join(' | ');
        const dynamicTitle = `${summary} | مؤشر الدينار`;
        const dynamicDesc = `السعر الآن في السوق الموازي: ${summary} د.ل. تابع أسعار العملات والذهب لحظة بلحظة.`;

        html = html
          .replace(/<title>.*?<\/title>/i, `<title>${dynamicTitle}</title>`)
          .replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta name="description" content="${dynamicDesc}">`)
          .replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="og:title" content="${dynamicTitle}">`)
          .replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="og:description" content="${dynamicDesc}">`)
          .replace(/<meta\s+property=["']twitter:title["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="twitter:title" content="${dynamicTitle}">`)
          .replace(/<meta\s+property=["']twitter:description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta property="twitter:description" content="${dynamicDesc}">`);
      }

      const etag = `"${crypto.createHash('sha256').update(html).digest('hex')}"`;
      cachedHtmlPage = { html, builtAt: Date.now(), ratesSnapshot: previewSnapshot(), etag };
      console.log('[HtmlCache] ✅ Rebuilt HTML cache. ETag:', etag);
      return cachedHtmlPage;
    }

    // Build initial cache on startup
    buildAndCacheHtml();
    refreshPreview = () => {
      if (!cachedHtmlPage || cachedHtmlPage.ratesSnapshot !== previewSnapshot()) buildAndCacheHtml();
    };

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
      const rateChanged = cachedHtmlPage && cachedHtmlPage.ratesSnapshot !== previewSnapshot();

      const cache = (cacheExpired || rateChanged) ? buildAndCacheHtml() : cachedHtmlPage!;
      let html = cache.html;
      const revision = typeof req.query.r === 'string' && /^\d{6,32}$/.test(req.query.r) ? req.query.r : null;
      if (revision) {
        // Keep Telegram's distinct share URL instead of collapsing previews to the root URL.
        html = html.replace(/(<meta\s+property=["'](?:og|twitter):url["']\s+content=["'])([^"']+)(["'][^>]*>)/gi,
          (_match, before, url, after) => {
            const shareUrl = new URL(url);
            shareUrl.searchParams.set('r', revision);
            return `${before}${shareUrl.toString()}${after}`;
          });
      }
      const etag = revision ? `"${crypto.createHash('sha256').update(html).digest('hex')}"` : cache.etag;

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('ETag', etag);

      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.send(html);
    });
  }

  return app;
}
