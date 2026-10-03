import express from 'express';
import { rates } from '../../state';
import { appConfig } from '../../config';
import { supabase, supabaseAnonKey } from '../../db';
import { Rates } from '../../types';
import { 
  cleanupOldData, 
  clearDbCache, 
  recentChangesLog, 
  syncCheckRates 
} from '../../services/db.service';
import { broadcastRateChanges } from '../../services/social.service';

export interface AdminDatabaseDeps {
  broadcastRatesUpdate: (rates: Rates) => void;
  clearUserLogs: () => void;
}

export function createAdminDatabaseRouter(deps: AdminDatabaseDeps): express.Router {
  const router = express.Router();

  // Records management
  router.get('/records/:market/:currency', async (req: express.Request, res: express.Response) => {
    const { market, currency } = req.params;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id, recorded_at, rates')
        .order('recorded_at', { ascending: false })
        .limit(500);
        
      if (error) throw error;
      
      const records = data.map(row => ({
        id: row.id,
        recorded_at: row.recorded_at,
        value: row.rates ? row.rates[currency] : null
      })).filter(r => r.value !== null && r.value !== undefined);
      
      res.json({ success: true, records });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  router.put('/records/:market/:id', async (req: express.Request, res: express.Response) => {
    const { market, id } = req.params;
    const { currency, value } = req.body;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { data: existing, error: fetchError } = await supabase
        .from(table)
        .select('rates')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      const updatedRates = { ...existing.rates, [currency]: parseFloat(value) };
      
      const { error: updateError } = await supabase
        .from(table)
        .update({ rates: updatedRates })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      clearDbCache();
      
      try {
        const { data: latestRecord } = await supabase
          .from(table)
          .select('rates, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();
          
        if (latestRecord && latestRecord.rates) {
          if (market === 'official') {
             rates.official = { ...rates.official, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.official = latestRecord.recorded_at;
          } else {
             const oldVal = rates.parallel[currency] || existing.rates?.[currency] || parseFloat(value);
             const newVal = parseFloat(value);
             rates.parallel = { ...rates.parallel, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.parallel = latestRecord.recorded_at;
             
             const term = appConfig.terms.find(t => t.id === currency);
             if (term && Math.abs(newVal - oldVal) > 0.0001) {
                broadcastRateChanges([{
                   id: currency,
                   name: term.name,
                   oldVal: oldVal,
                   newVal: newVal,
                   flag: term.flag
                }], false, 'all').catch(console.error);
             }
             await syncCheckRates("تعديل السجل");
          }
          deps.broadcastRatesUpdate(rates);
        }
      } catch (syncErr) {
        console.error("Error resyncing cache after update:", syncErr);
      }
      
      res.json({ success: true, message: "تم تحديث السجل بنجاح" });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  router.delete('/records/:market/:id', async (req: express.Request, res: express.Response) => {
    const { market, id } = req.params;
    const table = market === 'official' ? 'official_rates' : 'parallel_rates';
    
    if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      clearDbCache();
      
      try {
        const { data: latestRecord } = await supabase
          .from(table)
          .select('rates, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();
          
        if (latestRecord && latestRecord.rates) {
          if (market === 'official') {
             rates.official = { ...rates.official, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.official = latestRecord.recorded_at;
          } else {
             rates.parallel = { ...rates.parallel, ...latestRecord.rates };
             rates.lastUpdated = latestRecord.recorded_at;
             rates.lastChanged.parallel = latestRecord.recorded_at;
          }
          deps.broadcastRatesUpdate(rates);
        }
      } catch (syncErr) {
        console.error("Error resyncing cache after delete:", syncErr);
      }
      
      res.json({ success: true, message: "تم حذف السجل بنجاح" });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  // Manual Cleanup
  router.post('/cleanup', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual cleanup triggered by admin session`);
      await cleanupOldData(deps.clearUserLogs);
      res.json({ success: true, message: "تم تنظيف البيانات القديمة بنجاح" });
    } catch (err) {
      console.error("Manual cleanup failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل تنظيف البيانات" });
      }
    }
  });

  // Recent changes log
  router.get('/recent-changes', (req: express.Request, res: express.Response) => {
    res.json(recentChangesLog);
  });

  router.delete('/recent-changes', async (req: express.Request, res: express.Response) => {
    recentChangesLog.length = 0;
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        await supabase.from('price_changes_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error("Failed to clear price changes in Supabase", e);
      }
    }
    res.json({ success: true });
  });

  return router;
}

export default createAdminDatabaseRouter;
