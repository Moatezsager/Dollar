export const PUBLIC_RATES_PATH = '/api/public/rates';
export const PUBLIC_RATES_URL = 'https://dollar-price-qp14.onrender.com' + PUBLIC_RATES_PATH;
export const PUBLIC_API_CAPACITY = 120;
export const PUBLIC_API_DEFAULTS = { enabled: true, rateLimitWindowMs: 60000, rateLimitMaxRequests: 5 };
export const PUBLIC_API_BOUNDS = { minWindow: 60000, maxWindow: 3600000, minRequests: 1, maxRequests: 5 };
export const PUBLIC_API_STALE_MS = 12 * 60 * 60 * 1000;
