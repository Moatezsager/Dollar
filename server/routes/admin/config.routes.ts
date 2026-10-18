import express from 'express';
import { appConfig, getAdminSafeConfig, updateAppConfig, saveConfigToSupabase } from '../../config';
import { serverStartTime } from '../../state';
import { AppConfig, DeviceLogEntry, Rates } from '../../types';
import { facebookBroadcastStatus, telegramBroadcastStatus } from '../../services/social.service';
import { getPublicApiConfig } from '../../middleware/security';
import { PUBLIC_API_BOUNDS } from '../../../shared/developerApi';


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
    res.set('Cache-Control', 'no-store').json({ ...deps.apiStats, config: getPublicApiConfig(), since: serverStartTime.toISOString(), premiumConfigured: !!process.env.PREMIUM_API_KEY });
  });

  router.post('/api-config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body;
      const allowed = ['enabled', 'rateLimitWindowMs', 'rateLimitMaxRequests'];
      if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig) ||
          Object.keys(newConfig).some(key => !allowed.includes(key)) || typeof newConfig.enabled !== 'boolean' ||
          !Number.isInteger(newConfig.rateLimitWindowMs) || newConfig.rateLimitWindowMs < PUBLIC_API_BOUNDS.minWindow || newConfig.rateLimitWindowMs > PUBLIC_API_BOUNDS.maxWindow ||
          !Number.isInteger(newConfig.rateLimitMaxRequests) || newConfig.rateLimitMaxRequests < PUBLIC_API_BOUNDS.minRequests || newConfig.rateLimitMaxRequests > PUBLIC_API_BOUNDS.maxRequests) {
        return res.status(400).json({ success: false, error: 'إعدادات غير صالحة: المدة من دقيقة إلى 60 دقيقة، والطلبات من 1 إلى 5.' });
      }
      appConfig.apiConfig = {
        ...appConfig.apiConfig,
        ...newConfig,
      };
      
      const persisted = await saveConfigToSupabase(appConfig);
      res.json({ success: true, persisted, config: getPublicApiConfig() });
    } catch (err) {
      console.error("Error updating API config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Failed to update API config" });
      }
    }
  });

  // App Config
  router.get('/config', (req: express.Request, res: express.Response) => {
    res.json({ ...getAdminSafeConfig(), serverStartTime: serverStartTime.toISOString(), facebookBroadcastStatus, telegramBroadcastStatus });
  });

  router.post('/config', async (req: express.Request, res: express.Response) => {
    try {
      const newConfig = req.body as AppConfig;
      if (!newConfig.channels || !newConfig.terms) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
      }
      updateAppConfig(newConfig);
      const saved = await saveConfigToSupabase(appConfig);

      // Note: Re-fetching rates from Telegram after config save is now handled by the Worker Server.
      deps.broadcastConfigUpdate();
      res.json({
        success: true,
        message: saved ? "تم حفظ الإعدادات بنجاح" : "تم حفظ الإعدادات وتطبيقها بنجاح (وضع الذاكرة المؤقتة)",
        config: getAdminSafeConfig(),
      });
    } catch (err) {
      console.error("Error saving config:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "حدث خطأ أثناء الحفظ" });
      }
    }
  });


  // User tracking
  router.get('/tracking/logs', (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, logs: deps.getUserLogs(), capturedAt: new Date().toISOString(), trackingEnabled: appConfig.enableUserTracking });
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
