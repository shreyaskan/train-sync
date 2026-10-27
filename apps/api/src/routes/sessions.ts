import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function sessionRoutes(app: FastifyInstance) {
  app.get("/sessions", async () => {
    return prisma.session.findMany({
      include: { activity: true, plan: true },
      orderBy: { date: "asc" },
    });
  });

  app.post("/sessions", async (req) => {
    const body = req.body as {
      planId?: string;
      date: string;
      type: string;
      title: string;
      description?: string;
      targetDuration?: number;
      targetDistance?: number;
    };
    return prisma.session.create({
      data: {
        planId: body.planId,
        date: new Date(body.date),
        type: body.type,
        title: body.title,
        description: body.description,
        targetDuration: body.targetDuration,
        targetDistance: body.targetDistance,
      },
    });
  });

  app.patch("/sessions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      completed?: boolean;
      activityId?: string;
      title?: string;
      description?: string;
    };
    return prisma.session.update({ where: { id }, data: body });
  });

  app.delete("/sessions/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.session.delete({ where: { id } });
    return { ok: true };
  });
}
