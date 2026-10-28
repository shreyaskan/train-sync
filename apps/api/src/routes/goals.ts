import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function goalRoutes(app: FastifyInstance) {
  app.get("/goals", async () => {
    return prisma.monthlyGoal.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
  });

  app.post("/goals", async (req) => {
    const body = req.body as { year: number; month: number; text: string };
    const last = await prisma.monthlyGoal.findFirst({
      where: { year: body.year, month: body.month },
      orderBy: { order: "desc" },
    });
    return prisma.monthlyGoal.create({
      data: {
        year: body.year,
        month: body.month,
        text: body.text,
        order: (last?.order ?? -1) + 1,
      },
    });
  });

  app.patch("/goals/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string; completed?: boolean };
    return prisma.monthlyGoal.update({ where: { id }, data: body });
  });

  app.delete("/goals/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.monthlyGoal.delete({ where: { id } });
    return { ok: true };
  });
}
