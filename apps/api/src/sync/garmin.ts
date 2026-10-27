import garminConnectPkg from "garmin-connect";
import { prisma } from "../db.js";
import type { IOauth1Token, IOauth2Token } from "garmin-connect/dist/garmin/types.js";

// garmin-connect is CJS-only; Node's ESM/CJS interop doesn't reliably detect
// its named export, so pull it off the default import instead.
const { GarminConnect } = garminConnectPkg;

const AUTH_ID = "default";
const PAGE_SIZE = 50;
// Hard stop for a full backfill so a bug (or a huge Garmin history) can't spin
// forever making requests against Garmin's servers.
const MAX_PAGES = 40;

let client: InstanceType<typeof GarminConnect> | null = null;

async function persistToken(gc: InstanceType<typeof GarminConnect>) {
  const { oauth1, oauth2 } = gc.exportToken();
  const data = { oauth1: oauth1 as unknown as object, oauth2: oauth2 as unknown as object };
  await prisma.garminAuth.upsert({
    where: { id: AUTH_ID },
    update: data,
    create: { id: AUTH_ID, ...data },
  });
}

function newClient() {
  const username = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("GARMIN_EMAIL and GARMIN_PASSWORD must be set");
  }
  // The constructor requires non-empty credentials even when we end up
  // reusing a saved token below and never call login() with them.
  return new GarminConnect({ username, password });
}

async function loginWithCredentials(gc: InstanceType<typeof GarminConnect>) {
  await gc.login();
  await persistToken(gc);
}

async function getClient() {
  if (client) return client;

  const gc = newClient();
  const saved = await prisma.garminAuth.findUnique({ where: { id: AUTH_ID } });

  if (saved) {
    // The library auto-refreshes the oauth2 access token from the refresh
    // token on expiry, so loading a saved token avoids a fresh credentials
    // login (and its MFA/bot-detection risk) on most sync runs.
    gc.loadToken(saved.oauth1 as unknown as IOauth1Token, saved.oauth2 as unknown as IOauth2Token);
    try {
      await gc.getUserProfile();
      client = gc;
      return gc;
    } catch {
      // Saved token/refresh token is no longer valid — fall back to a full login.
    }
  }

  await loginWithCredentials(gc);
  client = gc;
  return gc;
}

// Maps Garmin's activityType.typeKey values (e.g. "street_running",
// "lap_swimming") onto the small set of types used for planned sessions.
function normalizeType(typeKey: string | undefined): string {
  const key = typeKey ?? "";
  if (key.includes("running")) return "run";
  if (key.includes("cycling") || key.includes("biking")) return "bike";
  if (key.includes("swim")) return "swim";
  if (key.includes("strength") || key.includes("training")) return "strength";
  return key || "other";
}

function utcDayRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Links a newly-synced activity to a planned session on the same day with a
// matching type, so completing a workout on Garmin marks the plan done
// without manual bookkeeping. A day can have several sessions of the same
// type (e.g. warm up / main set / cool down as separate planned sessions),
// so this picks whichever unmatched candidate's planned time is closest to
// the activity's actual start time rather than just the first one found —
// sessions need a real time set (not just a date) for that to disambiguate.
async function matchToSession(activityId: string, startTime: Date, typeKey: string | undefined) {
  const { start, end } = utcDayRange(startTime);
  const candidates = await prisma.session.findMany({
    where: {
      completed: false,
      activityId: null,
      type: normalizeType(typeKey),
      date: { gte: start, lt: end },
    },
  });
  if (candidates.length === 0) return false;

  const closest = candidates.reduce((best, c) =>
    Math.abs(c.date.getTime() - startTime.getTime()) <
    Math.abs(best.date.getTime() - startTime.getTime())
      ? c
      : best,
  );

  await prisma.session.update({
    where: { id: closest.id },
    data: { completed: true, activityId },
  });
  return true;
}

interface SyncOptions {
  /** Keep paginating through full activity history instead of stopping at the first already-synced activity. */
  full?: boolean;
  /** Only sync activities from the last N days — also bounds how many pages a full sync has to walk. */
  days?: number;
}

// Garmin returns activities newest-first. For an incremental sync we page
// through until we hit one we've already stored, since that means everything
// after it is already synced; a full sync instead pages until Garmin runs
// out of history (or we hit the safety cap). A `days` cutoff stops either
// mode early once activities get older than the window, which is what
// actually keeps a sync fast.
export async function syncActivities({ full = false, days }: SyncOptions = {}) {
  const gc = await getClient();
  const knownIds = new Set(
    (await prisma.activity.findMany({ select: { garminId: true } })).map((a) => a.garminId),
  );
  const cutoff = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  let synced = 0;
  let matched = 0;
  let page = 0;

  for (; page < MAX_PAGES; page++) {
    const activities = await gc.getActivities(page * PAGE_SIZE, PAGE_SIZE);
    if (activities.length === 0) break;

    let stop = false;
    for (const a of activities) {
      const garminId = String(a.activityId);
      if (cutoff && new Date(a.startTimeLocal) < cutoff) {
        stop = true;
        break;
      }
      if (!full && knownIds.has(garminId)) {
        stop = true;
        break;
      }

      const activityRecord = await prisma.activity.upsert({
        where: { garminId },
        update: {
          type: a.activityType?.typeKey ?? "unknown",
          name: a.activityName,
          startTime: new Date(a.startTimeLocal),
          durationSec: Math.round(a.duration),
          distanceM: a.distance ?? null,
          avgHr: a.averageHR ?? null,
          maxHr: a.maxHR ?? null,
          calories: a.calories ?? null,
          raw: a as unknown as object,
        },
        create: {
          garminId,
          type: a.activityType?.typeKey ?? "unknown",
          name: a.activityName,
          startTime: new Date(a.startTimeLocal),
          durationSec: Math.round(a.duration),
          distanceM: a.distance ?? null,
          avgHr: a.averageHR ?? null,
          maxHr: a.maxHR ?? null,
          calories: a.calories ?? null,
          raw: a as unknown as object,
        },
      });
      synced++;

      const didMatch = await matchToSession(
        activityRecord.id,
        activityRecord.startTime,
        a.activityType?.typeKey,
      );
      if (didMatch) matched++;
    }

    if (stop || activities.length < PAGE_SIZE) break;
  }

  return { synced, matched, pages: page + 1 };
}
