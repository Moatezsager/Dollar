import express from "express";
import { rates } from "../state";
import { appConfig } from "../config";
import { requireAdmin } from "../middleware/auth";
import { serverStartTime, getAppBuildSignature } from "../utils/version";
import { logErrorArabic, logPriceChange, syncCheckRates, saveToSupabase } from "../services/db.service";
import { broadcastRatesUpdate } from "../socket/socket.service";
import { getOrInitTelegramManager } from "../services/social.service";
import { extractRatesFromText } from "../services/scraper.service";
import { isSignificantChange } from "../utils/helpers";
import { activeClient } from "../../telegramClient";

const router = express.Router();

router.get("/version", (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const buildSignature = getAppBuildSignature();

  res.json({
    version: buildSignature,
    serverTime: Date.now(),
    startTime: serverStartTime.getTime()
  });
});

router.get(["/ping"], (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json({
    status: "pong",
    alive: true,
    uptime: Math.round((Date.now() - serverStartTime.getTime()) / 1000),
    timestamp: new Date().toISOString()
  });
});

router.get("/health", async (req: express.Request, res: express.Response) => {
  res.json({
    status: "online",
    uptime: Math.round((new Date().getTime() - serverStartTime.getTime()) / 1000),
    telegram: activeClient?.connected || false,
    timestamp: new Date().toISOString()
  });
});

router.get("/status", (req: express.Request, res: express.Response) => {
  res.json({
    status: "online",
    uptime: Math.round((Date.now() - serverStartTime.getTime()) / 1000),
    telegramConnected: !!(activeClient && activeClient.connected),
    timestamp: new Date().toISOString(),
    lastUpdated: rates?.lastUpdated || new Date().toISOString()
  });
});

router.get("/telegram/status", (req: express.Request, res: express.Response) => {
  const tgMgr = getOrInitTelegramManager();
  const isConnected = !!(activeClient && activeClient.connected);
  const hasBotToken = !!((tgMgr && tgMgr.botToken) || appConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
  res.json({
    isConnected: isConnected || hasBotToken,
    isAuthRevoked: tgMgr ? tgMgr.isAuthRevoked : false,
    lastError: tgMgr ? tgMgr.lastError : "",
    hasBotToken,
    lastFetchTime: tgMgr ? tgMgr.lastFetchTime : 0
  });
});

router.post("/logs/error", async (req: express.Request, res: express.Response) => {
  const { message, stack, context, url, userAgent } = req.body;
  
  let arabicMessage = message;
  if (message?.includes("Failed to fetch")) arabicMessage = "فشل في جلب البيانات من السيرفر (مشكلة اتصال)";
  if (message?.includes("Unexpected token")) arabicMessage = "خطأ في معالجة البيانات المستلمة من السيرفر";
  if (message?.includes("NetworkError")) arabicMessage = "خطأ في الشبكة - تعذر الاتصال";

  console.error("\n[CLIENT ERROR LOG]");
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`Message: ${message}`);
  console.error(`Context: ${context}`);
  console.error(`URL: ${url}`);
  console.error(`User Agent: ${userAgent}`);
  if (stack) console.error(`Stack: ${stack}`);
  console.error("-------------------\n");

  await logErrorArabic(arabicMessage || message, context || "تطبيق العميل", stack, url);

  res.status(200).json({ success: true });
});

router.post("/telegram/send-message", requireAdmin, async (req: express.Request, res: express.Response) => {
  const { channel, message } = req.body;

  if (!channel || !message) {
    return res.status(400).json({ success: false, error: "Channel username and message are required" });
  }

  const tgMgr = getOrInitTelegramManager();
  if (!tgMgr) {
    return res.status(503).json({ success: false, error: "Telegram client is not properly initialized" });
  }

  try {
    let finalMsg = message;
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const dynamicTgUrl = `https://dollar-price-qp14.onrender.com/?r=${randomNum}`;
    finalMsg = finalMsg.replace(/https:\/\/tinyurl\.com\/2j7667u2/g, dynamicTgUrl);
    finalMsg = finalMsg.replace(/https:\/\/dollar-price-qp14\.onrender\.com(?:\/[^\s]*)?/g, dynamicTgUrl);

    const success = await tgMgr.sendMessage(channel, finalMsg, { linkPreview: true });
    if (success) {
      res.json({ success: true, message: "تم النشر بنجاح" });
    } else {
      res.status(500).json({ success: false, error: tgMgr.lastError || "فشل النشر في تيليجرام" });
    }
  } catch (error: any) {
    console.error(`[API] Error sending message to ${channel}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || "Failed to send message" });
    }
  }
});

router.post("/telegram/update", requireAdmin, async (req: express.Request, res: express.Response) => {
  const { channel, limit = 10 } = req.body;

  if (!channel) {
    return res.status(400).json({ success: false, error: "Channel username is required" });
  }

  const tgMgr = getOrInitTelegramManager();
  if (!tgMgr || !tgMgr.isConnected()) {
    return res.status(503).json({ success: false, error: "Telegram client is not connected" });
  }

  try {
    const messages = await tgMgr.fetchMessages(channel, Math.min(limit, 50));
    
    let anyUpdated = false;
    const allExtracted: { code: string, value: number }[] = [];
    
    const sortedMessages = [...messages].sort((a, b) => a.date - b.date);
    
    for (const msg of sortedMessages) {
      const cleanText = msg.text;
      const extracted = extractRatesFromText(cleanText).filter(item => !item.code.startsWith('GOLD_') && item.code !== 'GOLD');
      
      for (const item of extracted) {
        allExtracted.push(item);
        const currentVal = rates.parallel[item.code];
        
        if (isSignificantChange(currentVal, item.value)) {
          rates.previousParallel[item.code] = currentVal || item.value;
          rates.parallel[item.code] = item.value;
          rates.lastChanged.parallel[item.code] = new Date(msg.date).toISOString();
          anyUpdated = true;
          
          const term = appConfig.terms.find(t => t.id === item.code);
          await logPriceChange({
            id: Math.random().toString(36).substring(2, 9),
            currencyCode: item.code,
            currencyName: term ? term.name : item.code,
            oldPrice: currentVal || item.value,
            newPrice: item.value,
            source: `API Update (${channel})`,
            timestamp: new Date(msg.date).toISOString()
          });
        }
      }
    }
    
    if (anyUpdated) {
      rates.lastUpdated = new Date().toISOString();
      await syncCheckRates(`API Update (${channel})`);
      await saveToSupabase('parallel');
      broadcastRatesUpdate(rates);
    }
    
    res.json({ 
      success: true, 
      message: anyUpdated ? "Rates updated successfully" : "No new rates found",
      extracted: allExtracted,
      updated: anyUpdated
    });
  } catch (error: any) {
    console.error(`[API] Error updating from ${channel}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || "Failed to update from channel" });
    }
  }
});

export default router;
