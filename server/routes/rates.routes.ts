import express from "express";
import { rates, history } from "../state";
import { appConfig } from "../config";
import { supabase, supabaseAnonKey } from "../db";
import { initializeRatesFromDB, fetchHistoryFromSupabase, recentChangesLog } from "../services/db.service";
import { publicApiLimiter, premiumApiLimiter, apiStats } from "../middleware/security";
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
      res.json(obfuscateData(rates));
    }
  }
});

router.all("/public/rates", publicApiLimiter, async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string || 'Unknown';
  const userAgent = req.headers['user-agent'] || 'Unknown';
  apiStats.public.totalRequests++;

  const logRequest = (status: number) => {
    if (status >= 200 && status < 300) {
      apiStats.public.successfulRequests++;
    } else {
      apiStats.public.failedRequests++;
    }
    apiStats.public.recentRequests.unshift({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      status,
      responseTime: Date.now() - startTime
    });
    if (apiStats.public.recentRequests.length > 100) {
      apiStats.public.recentRequests.pop();
    }
  };

  if (appConfig.apiConfig?.enabled === false) {
    logRequest(503);
    res.status(503).json({ success: false, error: "API is currently disabled by administrator." });
    return;
  }

  // CORS Policy: Allow all origins, but only GET method
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    logRequest(204);
    res.status(204).end();
    return;
  }

  // Restrict to GET method
  if (req.method !== 'GET') {
    logRequest(405);
    res.status(405).json({ success: false, error: "Method Not Allowed. Only GET is supported." });
    return;
  }

  try {
    // Check for stale data (older than 12 hours)
    const lastUpdatedTime = new Date(rates.lastUpdated).getTime();
    const isStale = (Date.now() - lastUpdatedTime) > (12 * 60 * 60 * 1000);
    
    // Set cache control headers to force caching for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    const publicData = {
      success: !isStale,
      stale: isStale,
      data: {
        USD: rates.parallel.USD,
        EUR: rates.parallel.EUR,
        GBP: rates.parallel.GBP,
      },
      lastUpdated: rates.lastUpdated
    };
    
    if (isStale) {
      (publicData as any).warning = "البيانات قديمة جداً ولم يتم تحديثها منذ أكثر من 12 ساعة.";
    }
    
    logRequest(200);
    res.json(publicData);
  } catch (err) {
    console.error("Error in /api/public/rates:", err);
    if (!res.headersSent) {
      logRequest(500);
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
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string || 'Unknown';
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
  const validKeys = [process.env.PREMIUM_API_KEY || 'premium-test-key-12345'];
  if (!validKeys.includes(apiKey)) {
    logRequest(403);
    res.status(403).json({ success: false, error: "Forbidden. Invalid API key." });
    return;
  }

  try {
    await initializeRatesFromDB(false);
    res.setHeader('Cache-Control', 'public, max-age=30');
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
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    const dbHistory = await fetchHistoryFromSupabase();
    const trimmed = Array.isArray(dbHistory) && dbHistory.length > 120 
      ? dbHistory.slice(-120) 
      : dbHistory;
    res.json(obfuscateData(trimmed));
  } catch (err) {
    if (!res.headersSent) {
      const fallback = Array.isArray(history) && history.length > 120 
        ? history.slice(-120) 
        : history;
      res.json(obfuscateData(fallback));
    }
  }
});

export default router;
