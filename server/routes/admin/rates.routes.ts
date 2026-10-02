import express from 'express';
import { rates } from '../../state';
import { appConfig } from '../../config';
import { Rates } from '../../types';
import { 
  fetchOfficialRates, 
  fetchParallelRatesFromTelegram, 
  extractRatesFromText,
  liveFeed,
  clearLiveFeed,
  isCblFetchEnabled, 
  setCblFetchEnabled, 
  getCblStatusInfo 
} from '../../services/scraper.service';
import { 
  saveToSupabase, 
  logPriceChange, 
  syncCheckRates 
} from '../../services/db.service';
import { broadcastRateChanges } from '../../services/social.service';
import { updateStats } from '../../services/reporting.service';
import { ALLOWED_GOLD_IDS } from '../../utils/helpers';

export interface AdminRatesDeps {
  broadcastRatesUpdate: (rates: Rates) => void;
}

export function createAdminRatesRouter(deps: AdminRatesDeps): express.Router {
  const router = express.Router();

  // Manual Refresh
  router.post('/refresh', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual refresh triggered`);
      const officialUpdate = await fetchOfficialRates(false, true);
      const parallelTally = await fetchParallelRatesFromTelegram();
      
      if (officialUpdate || parallelTally) {
        console.log("[Admin] Changes detected! Saving to database...");
        const saveType = (officialUpdate && parallelTally) ? 'both' : (officialUpdate ? 'official' : 'parallel');
        await saveToSupabase(saveType);
        deps.broadcastRatesUpdate(rates);
      }
      
      res.json({ 
        success: true, 
        message: "تم تشغيل عملية التحديث بنجاح",
        details: {
          official: officialUpdate ? "تم التحديث" : "لا يوجد تغيير",
          parallel: parallelTally ? "تم التحديث" : "لا يوجد تغيير"
        }
      });
    } catch (err) {
      console.error("Manual refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل التحديث اليدوي" });
      }
    }
  });

  // Manual Official Rates Refresh (Admin Auth) - Forces instant fetch bypassing 9-11 AM window & today lock
  router.post('/refresh-official', async (req: express.Request, res: express.Response) => {
    try {
      console.log(`[Admin] Manual official rates refresh triggered with force=true`);
      const officialUpdate = await fetchOfficialRates(true, true);
      await saveToSupabase('official');
      deps.broadcastRatesUpdate(rates);
      const status = getCblStatusInfo();
      res.json({ 
        success: true, 
        message: "تم تحديث أسعار المصرف المركزي بنجاح", 
        updated: officialUpdate,
        status
      });
    } catch (err: any) {
      console.error("Manual official refresh failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "فشل التحديث اليدوي للسعر الرسمي: " + (err?.message || err) });
      }
    }
  });

  // Get Central Bank Scraper Status
  router.get('/cbl-status', (req: express.Request, res: express.Response) => {
    try {
      const status = getCblStatusInfo();
      res.json({ success: true, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Toggle Central Bank Scraper Enabled / Disabled
  router.post('/cbl-toggle', (req: express.Request, res: express.Response) => {
    try {
      const { enabled } = req.body;
      const nextEnabled = typeof enabled === 'boolean' ? enabled : !isCblFetchEnabled;
      setCblFetchEnabled(nextEnabled);
      const status = getCblStatusInfo();
      res.json({ 
        success: true, 
        message: nextEnabled ? "تم تنشيط دالة جلب أسعار المصرف المركزي" : "تم إيقاف تنشيط دالة جلب أسعار المصرف المركزي", 
        enabled: nextEnabled,
        status 
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Queue & RAM Clear Queue
  router.post('/clear-queue', (req: express.Request, res: express.Response) => {
    clearLiveFeed();
    res.json({ success: true, message: "تم تفريغ الطابور والرسائل المعلقة بنجاح ✅" });
  });

  // Live Feed
  router.get('/live-feed', (req: express.Request, res: express.Response) => {
    res.json({ success: true, feed: liveFeed });
  });

  // Manual Extract
  router.post('/manual-extract', async (req: express.Request, res: express.Response) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Text is required" });
    
    const cleanText = text;
    const rawExtracted = extractRatesFromText(cleanText);
    
    // Filter to keep only specific gold/metals if the term is a metal, while keeping other currencies
    const extracted = rawExtracted.filter(item => {
      const isMetal = item.code === "GOLD" || item.code.startsWith("GOLD_") || item.code.startsWith("SILVER_");
      if (isMetal) {
        return ALLOWED_GOLD_IDS.includes(item.code);
      }
      return true;
    });
    
    if (extracted.length === 0) {
      return res.json({ success: false, message: "لم يتم العثور على أي أسعار في هذا النص" });
    }
    
    let anyChanged = false;
    const manualUpdates: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];
    for (const item of extracted) {
      const currentVal = rates.parallel[item.code];
      const term = appConfig.terms.find(t => t.id === item.code);
      const hasChanged = true; // يتم معاملة جميع المدخلات اليدوية كتغييرات حقيقية لحفظها ونشرها فوراً بدون شروط
      if (hasChanged) {
        rates.previousParallel[item.code] = currentVal !== item.value ? (currentVal || item.value) : (rates.previousParallel[item.code] || currentVal || item.value);
        rates.parallel[item.code] = item.value;
        rates.lastChanged.parallel[item.code] = new Date().toISOString();
        anyChanged = true;
      }
      if (term) {
        manualUpdates.push({
          id: item.code,
          name: term.name,
          oldVal: rates.previousParallel[item.code] || currentVal || item.value,
          newVal: item.value,
          flag: term.flag
        });
      }
    }
    
    if (anyChanged || manualUpdates.length > 0) {
      await syncCheckRates("استخراج المشرف");
      await saveToSupabase();
      deps.broadcastRatesUpdate(rates);

      if (manualUpdates.length > 0) {
        broadcastRateChanges(manualUpdates, false, 'all', true).catch(e => {
          console.error("[Manual Extract Broadcast Error]:", e);
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `تم استخراج ${extracted.length} أسعار بنجاح ✅`,
      extracted 
    });
  });

  // Essale Fetch
  router.post('/fetch-essale', async (req: express.Request, res: express.Response) => {
    try {
      const response = await fetch("https://essale.ly/api/tick?fbclid=IwZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPMjc1MjU0NjkyNTk4Mjc5AAEewyFcX9XSJyGppLrX8mTzJ93xM3OWsx5NXnMmXZIKhCsJGfiW1pNkKU2kwnk_aem_5dOdrJMZDqyD8p_DDrntEw");
      const data = await response.json();
      
      const mapping: Record<string, string> = {
        "USD": "USD",
        "CJM": "USD_AE",
        "TUR": "TRY",
        "TUN": "TND",
        "EUR": "EUR",
        "GBP": "GBP",
        "EGP": "EGP",
        "CTT": "JOD",
        "GOLD": "GOLD_SCRAP_18",
        "SLVR": "SILVER_SCRAP"
      };
      
      const extractedRates: Record<string, number> = {};
      const extractedDates: Record<string, string> = {};
      
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const internalCode = mapping[item.n];
          if (internalCode && item.v) {
            extractedRates[internalCode] = parseFloat(item.v);
            if (item.d) {
              extractedDates[internalCode] = item.d;
            }
          }
        });
      }

      if (Object.keys(extractedRates).length > 0) {
        res.json({ success: true, extractedRates, extractedDates });
      } else {
        res.json({ success: false, message: "لم يتم العثور على أسعار مطابقة" });
      }
    } catch (err: any) {
      console.error("Essale fetch failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ في جلب البيانات: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  // Extract from text
  router.post('/extract', async (req: express.Request, res: express.Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, message: "No text provided" });
      }
      
      const extractedRates: Record<string, number> = {};
      const extractedDates: Record<string, string> = {};
      const rawResults = extractRatesFromText(text);
      
      // Filter to keep only specific gold/metals if the term is a metal, while keeping other currencies
      const results = rawResults.filter(item => {
        const isMetal = item.code === "GOLD" || item.code.startsWith("GOLD_") || item.code.startsWith("SILVER_");
        if (isMetal) {
          return ALLOWED_GOLD_IDS.includes(item.code);
        }
        return true;
      });
      
      for (const item of results) {
        extractedRates[item.code] = item.value;
        if (item.date) {
          extractedDates[item.code] = item.date;
        }
      }

      if (Object.keys(extractedRates).length > 0) {
        res.json({ success: true, extractedRates, extractedDates });
      } else {
        res.json({ success: false, message: "لم يتمكن النظام من استخراج أي أسعار من النص المدخل" });
      }
    } catch (err: any) {
      console.error("Extraction failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ في الاستخراج: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  // Manual Rates update
  router.post('/rates', async (req: express.Request, res: express.Response) => {
    try {
      const { updates } = req.body;
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: "Invalid updates object" });
      }

      let anyChanged = false;
      let checkPriceUpdate: number | null = null;
      let checkOldPrice: number | null = null;
      const changedCurrencies: {id: string, name: string, oldVal: number, newVal: number, flag: string}[] = [];

      for (const [code, value] of Object.entries(updates)) {
        const numVal = parseFloat(value as string);
        if (isNaN(numVal) || numVal <= 0) continue;

        // التقاط أي تحديث يخص ثلاثي الصكوك
        if (code === 'USD_CHECKS' || code === 'USD_JBANK' || code === 'USD_NCB') {
          checkPriceUpdate = numVal;
        }

        const term = appConfig.terms.find(t => t.id === code);
        const currentVal = rates.parallel[code];
        const hasChanged = true; // معاملة المدخلات اليدوية كتعديلات معتمدة ومطلوبة للنشر فوراً
        
        if (hasChanged) {
          rates.previousParallel[code] = currentVal !== numVal ? (currentVal || numVal) : (rates.previousParallel[code] || currentVal || numVal);
          rates.parallel[code] = numVal;
          rates.lastChanged.parallel[code] = new Date().toISOString();
          anyChanged = true;
          
          updateStats(code, numVal);

          const changeLog = {
            id: Math.random().toString(36).substring(2, 9),
            currencyCode: code,
            currencyName: term ? term.name : code,
            oldPrice: currentVal || 0,
            newPrice: numVal,
            source: "تعديل يدوي من المشرف",
            timestamp: new Date().toISOString()
          };
          await logPriceChange(changeLog);
        }

        // استبعاد صكوك الجمهورية والتجاري من قائمة النشر، والاحتفاظ بـ USD_CHECKS فقط
        if (code === 'USD_CHECKS' || code === 'USD_JBANK' || code === 'USD_NCB') {
          if (checkOldPrice === null) checkOldPrice = currentVal || numVal;
        } else if (term) {
          // في التحديث اليدوي / مستخرج النصوص: نضيف العملة أو المعدن لقائمة النشر
          const oldVal = hasChanged 
            ? (currentVal || numVal) 
            : (rates.previousParallel[code] || currentVal || numVal);

          changedCurrencies.push({
            id: code,
            name: term.name,
            oldVal: oldVal,
            newVal: numVal,
            flag: term.flag
          });
        }
      }

      // المزامنة الفورية لثلاثي الصكوك (دولار صكوك، صكوك تجاري، صكوك جمهورية)
      if (checkPriceUpdate !== null) {
        const synced = await syncCheckRates("تعديل يدوي من المشرف", checkPriceUpdate);
        if (synced) anyChanged = true;

        changedCurrencies.push({
          id: 'USD_CHECKS',
          name: 'دولار أمريكي (صكوك)',
          oldVal: checkOldPrice !== null ? checkOldPrice : checkPriceUpdate,
          newVal: checkPriceUpdate,
          flag: 'us'
        });
      }

      if (anyChanged || changedCurrencies.length > 0) {
        rates.lastUpdated = new Date().toISOString();
        await saveToSupabase('parallel');
        deps.broadcastRatesUpdate(rates);

        if (changedCurrencies.length > 0) {
          console.log(`[Admin Update] Broadcasting ${changedCurrencies.length} manual updates to social media (bypassing all conditions)...`);
          try {
            await broadcastRateChanges(changedCurrencies, false, 'all', true);
          } catch (err) {
            console.error("[Admin Update] Social broadcast failed:", err);
          }
        }
      }

      res.json({ 
        success: true, 
        message: anyChanged || changedCurrencies.length > 0
          ? `تم تحديث الأسعار وحفظها ونشرها تلقائياً للمتابعين بنجاح (${changedCurrencies.length} صنف/عملة)` 
          : "لم يتم تحديد أي أسعار صالحة للحفظ" 
      });
    } catch (err: any) {
      console.error("Rates update failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `خطأ أثناء الحفظ: ${err.message || 'فشل العملية'}` });
      }
    }
  });

  return router;
}

export default createAdminRatesRouter;
