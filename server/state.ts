import { Rates, HistoryPoint } from './types';

// Display persisted prices only; a missing database must not create a market quote.
export let rates: Rates = {
  official: {}, parallel: {}, previousOfficial: {}, previousParallel: {},
  lastUpdated: '', lastChanged: { official: {}, parallel: {} }
};
export let history: HistoryPoint[] = [];
export const serverStartTime = new Date();


