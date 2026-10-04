import cron from "node-cron";
import { cleanupLocalDatabase } from "../services/maintenance.service";

export function initCronSchedulers() {
  // Local Database Maintenance (Auto-Vacuum) at 3:00 AM every day
  cron.schedule('0 3 * * *', cleanupLocalDatabase);
}
