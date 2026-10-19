import express from "express";
import crypto from 'node:crypto';
import { rates, history } from "../state";
import { appConfig } from "../config";
import { supabase, supabaseAnonKey } from "../db";
import { initializeRatesFromDB, fetchHistoryFromSupabase, recentChangesLog, getParallelUpdatedAt } from "../services/db.service";
import { publicApiLimiter, premiumApiLimiter, apiStats } from "../middleware/security";
import { PUBLIC_API_STALE_MS } from '../../shared/developerApi';
import { obfuscateData } from "../utils/helpers";

const router = express.Router();

router.get("/config", (req: express.Request, res: express.Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ terms: appConfig.terms });
});

router.get("/rates", async (req: express.Request, res: express.Response) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    const force = req.query.refresh === 'true';
    await initializeRatesFromDB(force);
    res.json(obfuscateData(rates));
  } catch (err) {
    console.error("Error in /api/rates:", err);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        stale: true,
        error: 'RATES_UNAVAILABLE',
        lastUpdated: rates.lastUpdated || null,
        data: null,
      });
    }
  }
});

router.all("/public/rates", (req, res, next) => {
  const startTime = Date.now();
  apiStats.public.totalRequests++;
  res.on('finish', () => {
    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      apiStats.public.successfulRequests++;
    } else {
      apiStats.public.failedRequests++;
    }
    apiStats.public.recentRequests.unshift({
      timestamp: new Date().toISOString(),
      ip: req.ip || 'Unknown',
      userAgent: (req.headers['user-agent'] || 'Unknown').slice(0, 200),
      status,
      responseTime: Date.now() - startTime
    });
    if (apiStats.public.recentRequests.length > 100) {
      apiStats.public.recentRequests.pop();
    }
  });
  next();
}, publicApiLimiter, (req: express.Request, res: express.Response) => {
  if (appConfig.apiConfig?.enabled === false) {
    res.set('Retry-After', '60').status(503).json({ success: false, error: 'API_DISABLED' });
    return;
  }

  // CORS Policy: Allow all origins, but only GET method
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Restrict to GET method
  if (req.method !== 'GET') {
    res.set('Allow', 'GET, OPTIONS').status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const lastUpdated = getParallelUpdatedAt();
    const timestamp = Date.parse(lastUpdated || '');
    const valid = ['USD', 'EUR'].every(code => Number.isFinite(rates.parallel[code]) && rates.parallel[code] > 0);
    if (!valid || !Number.isFinite(timestamp) || timestamp > Date.now() + 60000) {
      return res.set('Retry-After', '60').status(503).json({ success: false, error: 'RATES_UNAVAILABLE', data: null, lastUpdated: null });
    }
    const isStale = Date.now() - timestamp > PUBLIC_API_STALE_MS;
    const publicData = {
      success: !isStale,
      stale: isStale,
      market: 'parallel',
      quoteCurrency: 'LYD',
      data: {
        USD: rates.parallel.USD,
        EUR: rates.parallel.EUR,
      },
      lastUpdated,
      lastChanged: Object.fromEntries(['USD', 'EUR'].map(code => {
        const time = Date.parse(rates.lastChanged.parallel[code] || '');
        return [code, Number.isFinite(time) && time <= Date.now() ? new Date(time).toISOString() : null];
      })),
      ...(isStale ? { error: 'STALE_RATES', warning: 'Latest saved parallel-market data is older than 12 hours.' } : {})
    };
    if (isStale) {
      res.set('Retry-After', '60');
    }
    res.status(isStale ? 503 : 200).json(publicData);
  } catch (err) {
    console.error("Error in /api/public/rates:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  }
});

router.all("/premium/rates", premiumApiLimiter, async (req: express.Request, res: express.Response) => {
  // CORS Policy: Allow all origins, but only GET method
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: "Method Not Allowed. Only GET is supported." });
    return;
  }

  const startTime = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'Unknown';
  const userAgent = req.headers['user-agent'] || 'Unknown';
  apiStats.premium.totalRequests++;

  const logRequest = (status: number) => {
    if (status >= 200 && status < 300) {
      apiStats.premium.successfulRequests++;
    } else {
      apiStats.premium.failedRequests++;
    }
    apiStats.premium.recentRequests.unshift({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      status,
      responseTime: Date.now() - startTime
    });
    if (apiStats.premium.recentRequests.length > 100) {
      apiStats.premium.recentRequests.pop();
    }
  };

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logRequest(401);
    res.status(401).json({ success: false, error: "Unauthorized. Missing or invalid API key." });
    return;
  }

  const apiKey = authHeader.split(' ')[1];
  const configuredKey = process.env.PREMIUM_API_KEY;
  if (!configuredKey) {
    logRequest(503);
    return res.status(503).json({ success: false, error: 'Premium API is not configured.' });
  }
  if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(apiKey).digest(), crypto.createHash('sha256').update(configuredKey).digest())) {
    logRequest(403);
    res.status(403).json({ success: false, error: "Forbidden. Invalid API key." });
    return;
  }

  try {
    await initializeRatesFromDB(false);
    res.setHeader('Cache-Control', 'private, no-store');
    logRequest(200);
    res.json({
      success: true,
      data: rates,
      lastUpdated: rates.lastUpdated
    });
  } catch (err) {
    console.error("Error in /api/premium/rates:", err);
    if (!res.headersSent) {
      logRequest(500);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  }
});

router.get("/recent-changes", async (req: express.Request, res: express.Response) => {
  if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    try {
      const { data, error } = await supabase
        .from('price_changes_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
        
      if (!error && data) {
        return res.json(data.map(d => ({
          id: d.id,
          currencyCode: d.currency_code,
          currencyName: d.currency_name,
          oldPrice: d.old_price,
          newPrice: d.new_price,
          source: d.source,
          timestamp: d.created_at
        })));
      }
    } catch (e) {
      console.error("Failed to fetch price changes from Supabase", e);
    }
  }
  res.json(recentChangesLog);
});

router.get("/history", async (req: express.Request, res: express.Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const dbHistory = await fetchHistoryFromSupabase(true);
    res.json(obfuscateData(dbHistory));
  } catch (err) {
    if (!res.headersSent) {
      res.status(503).json({ error: 'History temporarily unavailable' });
    }
  }
});

export default router;
