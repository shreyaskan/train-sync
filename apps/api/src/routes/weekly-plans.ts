import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function weeklyPlanRoutes(app: FastifyInstance) {
  app.get("/weekly-plans", async () => {
    return prisma.weeklyPlan.findMany();
  });

  // Upsert by weekStart — one planned-distance override per week.
  app.put("/weekly-plans", async (req) => {
    const body = req.body as { weekStart: string; plannedDistance: number };
    const weekStart = new Date(body.weekStart);
    return prisma.weeklyPlan.upsert({
      where: { weekStart },
      update: { plannedDistance: body.plannedDistance },
      create: { weekStart, plannedDistance: body.plannedDistance },
    });
  });
}
