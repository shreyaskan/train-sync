import garminConnectPkg from "garmin-connect";
import { prisma } from "../db.js";

// garmin-connect is CJS-only; Node's ESM/CJS interop doesn't reliably detect
// its named export, so pull it off the default import instead.
const { GarminConnect } = garminConnectPkg;

let client: InstanceType<typeof GarminConnect> | null = null;

async function getClient() {
  if (client) return client;

  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("GARMIN_EMAIL and GARMIN_PASSWORD must be set");
  }

  const gc = new GarminConnect({ username: email, password });
  await gc.login();
  client = gc;
  return gc;
}

// Garmin returns duration/distance in seconds and meters already; kept as-is to
// match what the Session/Plan "target" fields use for comparison.
export async function syncActivities(limit = 20) {
  const gc = await getClient();
  const activities = await gc.getActivities(0, limit);

  let synced = 0;
  for (const a of activities) {
    await prisma.activity.upsert({
      where: { garminId: String(a.activityId) },
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
        garminId: String(a.activityId),
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

  return { synced };
}
