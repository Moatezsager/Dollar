import { AppConfig } from './types';
import { TelegramManager } from '../telegramClient';
import { db, supabase, supabaseAnonKey } from './db';

export let appConfig: AppConfig = {
  channels: ["dollarr_ly", "musheermarket", "lydollar", "suqalmushir"],
  telegramPostChannel: "lydollar",
  telegramAutoPost: false,
  telegramTemplateStyle: "classic",
  enableHttpScraper: true,
  enableUserTracking: true,
  apiConfig: {
    enabled: true,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 20,
    banDurationMinutes: 5,
  },
  terms: [
    { id: "USD", name: "دولار أمريكي", regex: "(?:USD|usd|الدولار|دولار|الخضراء|خضراء|كاش|💵|🇺🇸)(?!\\s*صكوك|\\s*بصك|\\s*شيك)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "EUR", name: "يورو", regex: "(?:EUR|eur|يورو|اليورو|💶|🇪🇺)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "eu" },
    { id: "GBP", name: "جنيه إسترليني", regex: "(?:GBP|gbp|باوند|استرليني|الباوند|💷|🇬🇧)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "gb" },
    { id: "TND", name: "دينار تونسي", regex: "(?:TND|tnd|تونسي|تونس(?![ا-ي])|🇹🇳)[^\\d]{0,40}?(?:100|1)?\\s*(?:=|ب|\\-)?\\s*(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,30}(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?))?", min: 2.5, max: 3.8, isInverse: false, flag: "tn" },
    { id: "EGP", name: "جنيه مصري", regex: "(?:EGP|egp|مصري|مصر(?![ا-ي])|🇪🇬)[^\\d]{0,40}?(?:100|1)?\\s*(?:=|ب|\\-)?\\s*(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,30}(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?))?", min: 0.13, max: 0.28, isInverse: false, flag: "eg" },
    { id: "TRY", name: "ليرة تركية", regex: "(?:TRY|try|ليرة(?!\\s*ذهب)|(?<!حوالة\\s*)(?<!حوالات\\s*)تركي(?![ا-ي])|🇹🇷)[^\\d]{0,40}?(?:100|1)?\\s*(?:=|ب|\\-)?\\s*(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,30}(?<!\\d)((?!(?:100|1)\\s*(?:=|ب|دينار|ليبي|\\-))\\d{1,3}(?:[\\.,]\\d{1,4})?))?", min: 0.01, max: 5.0, isInverse: false, flag: "tr" },
    { id: "JOD", name: "دينار أردني", regex: "(?:JOD|jod|أردني|🇯🇴)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 30.0, isInverse: false, flag: "jo" },
    { id: "BHD", name: "دينار بحريني", regex: "(?:BHD|bhd|بحريني|🇧🇭)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 10.0, max: 50.0, isInverse: false, flag: "bh" },
    { id: "KWD", name: "دينار كويتي", regex: "(?:KWD|kwd|كويتي|🇰🇼)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 10.0, max: 60.0, isInverse: false, flag: "kw" },
    { id: "AED", name: "درهم إماراتي", regex: "(?:AED|aed|إماراتي|امارات|🇦🇪)[^\\d]{0,40}(\\d{0,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{0,2}(?:[\\.,]\\d{1,4})?))?", min: 0.5, max: 10.0, isInverse: false, flag: "ae" },
    { id: "SAR", name: "ريال سعودي", regex: "(?:SAR|sar|سعودي|ريال|🇸🇦)[^\\d]{0,40}(\\d{0,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{0,2}(?:[\\.,]\\d{1,4})?))?", min: 0.5, max: 10.0, isInverse: false, flag: "sa" },
    { id: "QAR", name: "ريال قطري", regex: "(?:QAR|qar|قطري|🇶🇦)[^\\d]{0,40}(\\d{0,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{0,2}(?:[\\.,]\\d{1,4})?))?", min: 0.5, max: 10.0, isInverse: false, flag: "qa" },
    { id: "USD_CHECKS", name: "دولار أمريكي (صكوك)", regex: "(?:صكوك|شيكات|شيك|بصك|صك)(?!\\s*(?:الجمهورية|التجاري|التجارة|الأمان|الامان|الوحدة))[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_JBANK", name: "صكوك الجمهورية", regex: "(?:jbank|الجمهورية|صكوك الجمهورية|بصك الجمهورية)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_BCD", name: "صكوك التجارة", regex: "(?:bcd|التجارة والتنمية|صكوك التجارة|بصك التجارة)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_NCB", name: "صكوك التجاري", regex: "(?:NCB|التجاري الوطني|صكوك التجاري|بصك التجاري)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_AB", name: "صكوك الأمان", regex: "(?:AB|الأمان|الامان|صكوك الأمان|صكوك الامان)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_WB", name: "صكوك الوحدة", regex: "(?:WB|الوحدة|صكوك الوحدة|بصك الوحدة)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "us" },
    { id: "USD_AE", name: "حوالات دبي", regex: "(?:دبي|امارات|الإمارات|حوالة دبي|حوالات دبي|🇦🇪)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "ae" },
    { id: "USD_TR", name: "حوالات تركيا", regex: "(?:(?<!فضة\\s*)تركيا|(?<!فضة\\s*)تركي(?![ا-ي])|حوالة تركي[اة]|حوالات تركي[اة]|🇹🇷)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "tr" },
    { id: "USD_CN", name: "حوالات الصين", regex: "(?:الصين|صينية|حوالة الصين|حوالات الصين|🇨🇳)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 5.0, max: 25.0, isInverse: false, flag: "cn" },
    { id: "CNY", name: "يوان صيني", regex: "(?:CNY|cny|يوان|🇨🇳)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)(?:\\s+(?:بيع|شراء)?[^\\d]{0,15}(\\d{1,2}(?:[\\.,]\\d{1,4})?))?", min: 0.5, max: 5.0, isInverse: false, flag: "cn" },
    { id: "GOLD_EXT_18", name: "ذهب خارجي 18", regex: "(?:ذهب\\s*خارجي\\s*18|خارجي\\s*18|عيار\\s*18\\s*خارجي|18\\s*خارجي)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_EXT_21", name: "ذهب خارجي 21", regex: "(?:ذهب\\s*خارجي\\s*21|خارجي\\s*21|عيار\\s*21\\s*خارجي|21\\s*خارجي)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_SCRAP_18", name: "ذهب كسر 18", regex: "(?:ذهب\\s*كسر\\s*18|كسر\\s*18|عيار\\s*18\\s*كسر|18\\s*كسر|كسر\\s*الذهب\\s*عيار\\s*18|كسر\\s*ذهب\\s*عيار\\s*18)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_SCRAP_21", name: "ذهب كسر 21", regex: "(?:ذهب\\s*كسر\\s*21|كسر\\s*21|عيار\\s*21\\s*كسر|21\\s*كسر|كسر\\s*الذهب\\s*عيار\\s*21|كسر\\s*ذهب\\s*عيار\\s*21)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_CAST_18", name: "ذهب مسبوك 18", regex: "(?:ذهب\\s*مسبوك\\s*18|مسبوك\\s*18|عيار\\s*18\\s*مسبوك|18\\s*مسبوك)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_CAST_24", name: "ذهب مسبوك 24", regex: "(?:ذهب\\s*مسبوك\\s*24|مسبوك\\s*24|عيار\\s*24\\s*مسبوك|24\\s*مسبوك)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 10000, isInverse: false, flag: "gold" },
    { id: "GOLD_LIRA_8G", name: "ليرة ذهب 8 جرام", regex: "(?:ليرة\\s*(?:ذهب\\s*)?8(?:\\s*جرام|ج)?|ليرة\\s*8(?:\\s*جرام|ج)?)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 30000, isInverse: false, flag: "gold" },
    { id: "GOLD_LIRA_14G", name: "ليرة ذهب 14 جرام", regex: "(?:ليرة\\s*(?:ذهب\\s*)?14(?:\\s*جرام|ج)?|ليرة\\s*14(?:\\s*جرام|ج)?)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 40000, isInverse: false, flag: "gold" },
    { id: "GOLD_MUJARA_14G", name: "مجارة ذهب 14", regex: "(?:مجارة\\s*(?:ذهب\\s*)?14(?:\\s*جرام|ج)?|مجارة\\s*14(?:\\s*جرام|ج)?)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 40000, isInverse: false, flag: "gold" },
    { id: "SILVER_CAST_1000", name: "مسبوك فضة", regex: "(?:مسبوك\\s*فضة(?:\\s*عيار\\s*1000|\\s*1000)?|فضة\\s*مسبوك)[^\\d\\n]{0,30}(\\d{1,5}(?:[\\.,]\\d+)?)(?:[^\\d\\n]{1,15}(\\d{1,5}(?:[\\.,]\\d+)?))?", min: 1, max: 1000, isInverse: false, flag: "silver" },
    { id: "OFFICIAL_USD", name: "الدولار الرسمي", regex: "(?:الرسمي|المركزي)[^\\d]{0,40}(\\d{1,2}(?:[\\.,]\\d{1,4})?)", min: 4.0, max: 6.0, isInverse: false, flag: "us" }
  ]
};

export function updateAppConfig(newConfig: Partial<AppConfig>) {
  for (const key of Object.keys(appConfig)) {
    delete (appConfig as any)[key];
  }
  Object.assign(appConfig, newConfig);
}

export let telegramManager: TelegramManager | null = null;

export function setTelegramManager(manager: TelegramManager | null) {
  telegramManager = manager;
}

export function applyLoadedConfig(loadedConfig: AppConfig, source: string) {
  const existingIds = new Set<string>();
  const mergedTerms = loadedConfig.terms.map(dbTerm => {
    existingIds.add(dbTerm.id);
    const defaultTerm = appConfig.terms.find(t => t.id === dbTerm.id);
    const isMetal = (defaultTerm && (defaultTerm.flag === "gold" || defaultTerm.flag === "silver")) ||
      dbTerm.id.startsWith("GOLD_") || dbTerm.id.startsWith("SILVER_");
    const isOutdatedOrNarrow = !dbTerm.regex || isMetal ||
      (dbTerm.id === "TND" && (dbTerm.max > 3.8 || dbTerm.min < 2.5)) ||
      (dbTerm.id === "EGP" && (dbTerm.max > 0.28 || dbTerm.min < 0.13));

    return {
      id: dbTerm.id,
      name: (isMetal && defaultTerm) ? defaultTerm.name : (dbTerm.name || defaultTerm?.name || dbTerm.id),
      regex: (isOutdatedOrNarrow && defaultTerm?.regex) ? defaultTerm.regex : (dbTerm.regex || defaultTerm?.regex || ""),
      min: (isOutdatedOrNarrow && defaultTerm) ? defaultTerm.min : ((typeof dbTerm.min === 'number' && !isNaN(dbTerm.min) && (!defaultTerm || dbTerm.min <= defaultTerm.min)) ? dbTerm.min : (defaultTerm?.min ?? 0)),
      max: (isOutdatedOrNarrow && defaultTerm) ? defaultTerm.max : ((typeof dbTerm.max === 'number' && !isNaN(dbTerm.max) && (!defaultTerm || dbTerm.max >= defaultTerm.max)) ? dbTerm.max : (defaultTerm?.max ?? 10000)),
      isInverse: typeof dbTerm.isInverse === 'boolean' ? dbTerm.isInverse : (defaultTerm?.isInverse ?? false),
      flag: (dbTerm.flag && dbTerm.flag !== "undefined" && dbTerm.flag !== "null") ? dbTerm.flag : (defaultTerm?.flag || "ly")
    };
  });

  for (const defaultTerm of appConfig.terms) {
    if (!existingIds.has(defaultTerm.id)) {
      mergedTerms.push(defaultTerm);
      console.log(`[Migration] Added new missing currency term: ${defaultTerm.id}`);
    }
  }
  // Filter out any obsolete gold/silver categories to keep exactly the 10 metals
  loadedConfig.terms = mergedTerms.filter(t => t.id !== "GOLD" && t.id !== "GOLD_CAST_21" && t.id !== "SILVER_SCRAP");

  if (!Array.isArray(loadedConfig.channels) || loadedConfig.channels.length === 0) {
    loadedConfig.channels = ["dollarr_ly", "musheermarket", "lydollar", "suqalmushir"];
  }

  if (loadedConfig.enableHttpScraper === undefined) {
    loadedConfig.enableHttpScraper = true;
  }
  if (loadedConfig.enableUserTracking === undefined) {
    loadedConfig.enableUserTracking = true;
  }
  if (!loadedConfig.telegramTemplateStyle) {
    loadedConfig.telegramTemplateStyle = "classic";
  }
  if (!loadedConfig.apiConfig) {
    loadedConfig.apiConfig = {
      enabled: true,
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 20,
      banDurationMinutes: 5,
    };
  }

  updateAppConfig(loadedConfig);
  console.log(`[Config] Config loaded & applied successfully from ${source}`);
}

export function loadConfigFromStorage() {
  try {
    const stored = db.prepare('SELECT value FROM server_config WHERE key = ?').get('app_config') as any;
    if (stored && stored.value) {
      const parsedConfig = JSON.parse(stored.value) as AppConfig;
      if (parsedConfig && Array.isArray(parsedConfig.terms) && Array.isArray(parsedConfig.channels)) {
        applyLoadedConfig(parsedConfig, "SQLite");
      }
    }
  } catch (e) {
    console.error("[Storage] Failed to read config from SQLite:", e);
  }
}

export async function loadConfigFromSupabase() {
  loadConfigFromStorage();

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('config')
      .eq('id', 1)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        await supabase.from('app_config').insert([{ id: 1, config: appConfig }]);
      } else if (!error.message.includes('relation "app_config" does not exist')) {
        console.error("Error loading config from Supabase:", error);
      }
    } else if (data && data.config) {
      applyLoadedConfig(data.config as AppConfig, "Supabase");
      
      try {
        db.prepare(`
          INSERT INTO server_config (key, value) VALUES ('app_config', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(appConfig));
      } catch (e) {
        console.error("[Storage] Failed to sync Supabase config to SQLite:", e);
      }
    }
  } catch (err) {
    console.error("Failed to load/repair config from Supabase", err);
  }
}

// Call loadConfigFromStorage immediately so config and credentials are ready on startup
loadConfigFromStorage();

export async function saveConfigToSupabase(newConfig: AppConfig) {
  try {
    db.prepare(`
      INSERT INTO server_config (key, value) VALUES ('app_config', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(newConfig));
  } catch (e) {
    console.error("[Storage] Failed to save config to SQLite:", e);
  }

  if (!supabase || !supabaseAnonKey || supabaseAnonKey.includes('dummy')) return true;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ id: 1, config: newConfig });
      
    if (error) {
      console.error("Error saving config to Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to save config to Supabase", err);
    return false;
  }
}
