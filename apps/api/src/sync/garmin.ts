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

      await prisma.activity.upsert({
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
    }

    if (stop || activities.length < PAGE_SIZE) break;
  }

  return { synced, pages: page + 1 };
}
