import express from 'express';
import { appConfig, updateAppConfig, saveConfigToSupabase } from '../../config';
import { rates, serverStartTime } from '../../state';
import { AppConfig, DeviceLogEntry, Rates } from '../../types';
import { fetchParallelRatesFromTelegram } from '../../services/scraper.service';
import { saveToSupabase } from '../../services/db.service';
import { facebookBroadcastStatus, telegramBroadcastStatus } from '../../services/social.service';

export interface AdminConfigDeps {
  apiStats: any;
  publicApiLimiter?: any;
  getPublicApiLimiter?: () => any;
  getUserLogs: () => DeviceLogEntry[];
  clearUserLogs: () => void;
  broadcastRatesUpdate: (rates: Rates) => void;
  broadcastConfigUpdate: () => void;
  broadcastUserLogs: () => void;
}

export function createAdminConfigRouter(deps: AdminConfigDeps): express.Router {
  const router = express.Router();

  // API Stats & Config
  router.get('/api-stats', (req: express.Request, res: express.Response) => {
    res.json(deps.apiStats);
  });

  router.post('/api-config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body;
      appConfig.apiConfig = {
        ...appConfig.apiConfig,
        ...newConfig,
      };
      
      const limiter = deps.getPublicApiLimiter ? deps.getPublicApiLimiter() : deps.publicApiLimiter;
      if (limiter) {
        (limiter as any).windowMs = appConfig.apiConfig?.rateLimitWindowMs || 60000;
        (limiter as any).max = appConfig.apiConfig?.rateLimitMaxRequests || 20;
      }
      await saveConfigToSupabase(appConfig);
      res.json({ success: true, config: appConfig.apiConfig });
    } catch (err) {
      console.error("Error updating API config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Failed to update API config" });
      }
    }
  });

  // App Config
  router.get('/config', (req: express.Request, res: express.Response) => {
    res.json({ ...appConfig, serverStartTime: serverStartTime.toISOString(), facebookBroadcastStatus, telegramBroadcastStatus });
  });

  router.post('/config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body as AppConfig;
      if (!newConfig.channels || !newConfig.terms) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
      }
      updateAppConfig(newConfig);
      const saved = await saveConfigToSupabase(appConfig);
      
      const parallelTally = await fetchParallelRatesFromTelegram();
      if (parallelTally) {
        await saveToSupabase('parallel');
        deps.broadcastRatesUpdate(rates);
      }
      
      deps.broadcastConfigUpdate();
      res.json({ success: true, message: saved ? "تم حفظ الإعدادات بنجاح" : "تم حفظ الإعدادات وتطبيقها بنجاح (وضع الذاكرة المؤقتة)" });
    } catch (err) {
      console.error("Error saving config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "حدث خطأ أثناء الحفظ" });
      }
    }
  });

  // User tracking
  router.get('/tracking/logs', (req: express.Request, res: express.Response) => {
    res.json({ success: true, logs: deps.getUserLogs() });
  });

  router.post('/tracking/toggle', async (req: express.Request, res: express.Response) => {
    appConfig.enableUserTracking = !appConfig.enableUserTracking;
    await saveConfigToSupabase(appConfig);
    deps.broadcastConfigUpdate();
    res.json({ success: true, enabled: appConfig.enableUserTracking });
  });

  router.post('/tracking/clear', (req: express.Request, res: express.Response) => {
    deps.clearUserLogs();
    deps.broadcastUserLogs();
    res.json({ success: true, message: "تم مسح سجل المتصلين بنجاح" });
  });

  return router;
}

export default createAdminConfigRouter;
