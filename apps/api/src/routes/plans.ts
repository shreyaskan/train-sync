import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/plans", async () => {
    return prisma.plan.findMany({ include: { sessions: true } });
  });

  app.get("/plans/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { sessions: { include: { activity: true }, orderBy: { date: "asc" } } },
    });
    if (!plan) return reply.code(404).send({ error: "Plan not found" });
    return plan;
  });

  app.post("/plans", async (req) => {
    const body = req.body as {
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
    };
    return prisma.plan.create({
      data: {
        name: body.name,
        description: body.description,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
  });

  app.delete("/plans/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.plan.delete({ where: { id } });
    return { ok: true };
  });
}
