import cron from "node-cron";
import { broadcastWeeklyReport } from "../services/reporting.service";
import { cleanupLocalDatabase } from "../services/maintenance.service";

export function initCronSchedulers() {
  // Weekly report on Friday night
  cron.schedule('55 23 * * 5', () => {
    broadcastWeeklyReport().catch(console.error);
  }, {
    timezone: "Africa/Tripoli"
  });

  // Local Database Maintenance (Auto-Vacuum) at 3:00 AM every day
  cron.schedule('0 3 * * *', cleanupLocalDatabase);
}
