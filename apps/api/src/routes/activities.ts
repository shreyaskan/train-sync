import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { syncActivities } from "../sync/garmin.js";

export async function activityRoutes(app: FastifyInstance) {
  app.get("/activities", async () => {
    return prisma.activity.findMany({ orderBy: { startTime: "desc" } });
  });

  app.post("/activities/sync", async (req, reply) => {
    const { full, days } = (req.query as { full?: string; days?: string }) ?? {};
    try {
      const result = await syncActivities({
        full: full === "true",
        days: days ? Number(days) : undefined,
      });
      return result;
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: "Garmin sync failed" });
    }
  });
}
