import express from 'express';
import { supabase, supabaseAnonKey } from '../../db';
import {
  getBroadcastLogPage,
  getBroadcastLogSummary
} from '../../services/broadcastLog.service';
import { getRetryQueueCount } from '../../services/social.service';

const router = express.Router();

// Error Logs
router.delete('/error-logs', async (req: express.Request, res: express.Response) => {
  try {
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(400).json({ success: false, message: "قاعدة بيانات Supabase غير متصلة" });
    }
    const { error } = await supabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ success: true, message: "تم مسح جميع سجلات الأخطاء بنجاح" });
  } catch (err: any) {
    console.error("Error deleting error logs:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || "فشل مسح السجلات" });
    }
  }
});

router.get('/error-logs', async (req: express.Request, res: express.Response) => {
  try {
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.json({ success: true, logs: [] });
    }
    
    const limit = parseInt(req.query.limit as string) || 50;
    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    res.json({ success: true, logs: data || [] });
  } catch (err: any) {
    console.error("Error fetching error logs:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || "فشل جلب السجلات" });
    }
  }
});

// Broadcast logs (read-only)
router.get('/broadcast-log', (req: express.Request, res: express.Response) => {
  try {
    const { platform, status, page, limit } = req.query;
    const result = getBroadcastLogPage({
      platform: platform ? String(platform) : undefined,
      status: status ? String(status) : undefined,
      page: page ? String(page) : undefined,
      limit: limit ? String(limit) : undefined
    });
    res.json(result);
  } catch (err: any) {
    console.error("[Admin] Error fetching broadcast logs:", err);
    res.status(500).json({ error: "Failed to fetch broadcast logs" });
  }
});

router.get('/broadcast-log/summary', (req: express.Request, res: express.Response) => {
  try {
    const summary = getBroadcastLogSummary();
    const activeRetryQueueCount = getRetryQueueCount();
    res.json({
      ...summary,
      activeRetryQueueCount
    });
  } catch (err: any) {
    console.error("[Admin] Error fetching broadcast log summary:", err);
    res.status(500).json({ error: "Failed to fetch broadcast log summary" });
  }
});

export default router;
