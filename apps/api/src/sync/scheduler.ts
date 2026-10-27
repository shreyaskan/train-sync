import cron from "node-cron";
import { syncActivities } from "./garmin.js";

export function startScheduler() {
  const schedule = process.env.SYNC_CRON ?? "0 * * * *"; // hourly by default

  // Bounds the DB-is-empty case: without a `days` cutoff, incremental mode has
  // no already-synced activity to stop at and would walk your entire history.
  const days = Number(process.env.SYNC_DAYS ?? 14);

  cron.schedule(schedule, async () => {
    try {
      const { synced } = await syncActivities({ days });
      console.log(`[garmin-sync] synced ${synced} activities`);
    } catch (err) {
      console.error("[garmin-sync] failed", err);
    }
  });

  console.log(`[garmin-sync] scheduled with cron "${schedule}"`);
}
