import express from "express";
import { requestWorkerMaintenance } from "../services/worker-maintenance.service";
import { 
  extractProvidedCronKey, 
  isValidCronSecret, 
  cronParallelLimiter, 
  cronOfficialLimiter, 
  cronCleanupLimiter 
} from "../middleware/security";


const router = express.Router();

router.get("/refresh-parallel", cronParallelLimiter, (req: express.Request, res: express.Response) => {
  // [MOVED TO WORKER SERVER]
  // Parallel rates scraping is now exclusively handled by the Worker Server.
  // Trigger the Worker via its internal API instead.
  res.status(503).json({
    success: false,
    message: "This endpoint has been moved to the Worker Server. Scraping is no longer performed by the Web Server.",
    worker_endpoint: "POST /internal/jobs/telegram"
  });
});


router.get("/refresh-official", cronOfficialLimiter, (req: express.Request, res: express.Response) => {
  // [MOVED TO WORKER SERVER]
  // Official (CBL) rates scraping is now exclusively handled by the Worker Server.
  // Trigger the Worker via its internal API instead.
  res.status(503).json({
    success: false,
    message: "This endpoint has been moved to the Worker Server. Scraping is no longer performed by the Web Server.",
    worker_endpoint: "POST /internal/jobs/cbl"
  });
});


router.get("/cleanup-db", cronCleanupLimiter, async (req: express.Request, res: express.Response) => {
  const ip = req.ip || req.socket.remoteAddress;
  const providedKey = extractProvidedCronKey(req);
  
  if (!isValidCronSecret(providedKey)) {
    console.warn(`[Maintenance] Unauthorized cleanup attempt from IP: ${ip}`);
    return res.status(403).json({ success: false, error: "Forbidden: Invalid security key" });
  }

  try {
    await requestWorkerMaintenance();
    if (res.headersSent || res.destroyed) return;
    res.status(202).json({
      success: true,
      message: "أُرسلت مهمة تنظيف وأرشفة سجل الأسعار إلى Worker."
    });
  } catch (err) {
    console.error("[Maintenance] Cleanup failed:", err);
    if (!res.headersSent && !res.destroyed) {
      res.status(500).json({ success: false, error: "Internal server error during cleanup" });
    }
  }
});

export default router;
