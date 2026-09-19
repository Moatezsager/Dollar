export interface RateMap {
  [key: string]: number;
}

export interface LastChangedMap {
  [key: string]: string;
}

export interface Rates {
  official: RateMap;
  parallel: RateMap;
  previousOfficial: RateMap;
  previousParallel: RateMap;
  lastUpdated: string;
  lastChanged: {
    official: LastChangedMap;
    parallel: LastChangedMap;
  };
}

export interface HistoryPoint {
  time: string;
  usdParallel: number;
  usdOfficial: number;
  ratesParallel?: RateMap;
  ratesOfficial?: RateMap;
}

export interface AppConfig {
  channels: string[];
  terms: {
    id: string;
    name: string;
    regex: string;
    min: number;
    max: number;
    isInverse: boolean;
    flag: string;
  }[];
  telegramApiId?: number;
  telegramApiHash?: string;
  telegramSessionString?: string;
  telegramPostChannel?: string;
  telegramAutoPost?: boolean;
  telegramTemplateStyle?: string;
  enableHttpScraper?: boolean;
  enableUserTracking?: boolean;
  facebookPageId?: string;
  facebookAccessToken?: string;
  facebookAutoPost?: boolean;
  apiConfig?: {
    enabled: boolean;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    banDurationMinutes: number;
  };
}

export interface PriceChangeLog {
  id: string;
  currencyCode: string;
  currencyName: string;
  oldPrice: number;
  newPrice: number;
  source: string;
  timestamp: string;
}

export interface CurrencyStat {
  high: number;
  low: number;
  sum: number;
  count: number;
  startPrice: number;
}

export interface ChannelStatusInfo {
  last_scrape_attempt: number;
  last_post_time: number;
  status: 'active' | 'stale' | 'error';
  messages_processed: number;
}

export interface LiveFeedMessage {
  id: string;
  channel: string;
  text: string;
  time: number;
  status: 'processed' | 'skipped' | 'error';
  extractedRates?: { code: string; value: number }[];
  error?: string;
}

export interface DeviceLogEntry {
  id: string;
  deviceId: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  deviceType: string;
  deviceName: string;
  os?: string;
  browser?: string;
  visits?: number;
  firstVisit?: string;
  isOnline?: boolean;
  last_active?: string;
}
