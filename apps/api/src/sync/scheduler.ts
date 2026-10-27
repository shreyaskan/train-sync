import cron from "node-cron";
import { syncActivities } from "./garmin.js";

export function startScheduler() {
  const schedule = process.env.SYNC_CRON ?? "0 * * * *"; // hourly by default

  cron.schedule(schedule, async () => {
    try {
      const { synced } = await syncActivities();
      console.log(`[garmin-sync] synced ${synced} activities`);
    } catch (err) {
      console.error("[garmin-sync] failed", err);
    }
  });

  console.log(`[garmin-sync] scheduled with cron "${schedule}"`);
}
