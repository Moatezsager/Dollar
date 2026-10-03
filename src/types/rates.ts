export interface Rates {
  official: Record<string, number>;
  parallel: Record<string, number>;
  previousOfficial?: Record<string, number>;
  previousParallel?: Record<string, number>;
  lastUpdated: string;
  lastChanged?: {
    official: Record<string, string>;
    parallel: Record<string, string>;
  };
}

export interface HistoryPoint {
  time: string;
  usdParallel: number;
  usdOfficial: number;
  ratesParallel?: Record<string, number>;
  ratesOfficial?: Record<string, number>;
}

export interface CurrencyItem {
  code: string;
  name: string;
  flag?: string;
  unit?: string;
}

export const CURRENCIES: CurrencyItem[] = [
  { code: "USD", name: "دولار أمريكي", flag: "us" },
  { code: "EUR", name: "يورو", flag: "eu" },
  { code: "GBP", name: "جنيه إسترليني", flag: "gb" },
  { code: "TND", name: "دينار تونسي", flag: "tn" },
  { code: "TRY", name: "ليرة تركية", flag: "tr" },
  { code: "EGP", name: "جنيه مصري", flag: "eg" },
  { code: "JOD", name: "دينار أردني", flag: "jo" },
  { code: "BHD", name: "دينار بحريني", flag: "bh" },
  { code: "KWD", name: "دينار كويتي", flag: "kw" },
  { code: "AED", name: "درهم إماراتي", flag: "ae" },
  { code: "SAR", name: "ريال سعودي", flag: "sa" },
  { code: "QAR", name: "ريال قطري", flag: "qa" },
  { code: "CNY", name: "يوان صيني", flag: "cn" },
];

export const PARALLEL_DETAILS = [
  { code: "USD_TR", name: "حوالات تركيا", flag: "tr", unit: "د.ل" },
  { code: "USD_AE", name: "حوالات دبي", flag: "ae", unit: "د.ل" },
  { code: "USD_CN", name: "حوالات الصين", flag: "cn", unit: "د.ل" },
];

export const METAL_IDS = [
  "GOLD_CAST_18",
  "GOLD_CAST_24",
  "GOLD_EXT_18",
  "GOLD_EXT_21",
  "GOLD_SCRAP_18",
  "GOLD_SCRAP_21",
  "GOLD_LIRA_8G",
  "GOLD_LIRA_14G",
  "GOLD_MUJARA_14G",
  "SILVER_CAST_1000"
];

export interface AppStatus {
  status: string;
  minutesSinceLastScrape: number;
  minutesSinceLastChange?: number;
  lastUpdated?: string;
}

export interface ToastItem {
  id: string;
  title: string;
  body: string;
  type: 'up' | 'down' | 'info';
}
