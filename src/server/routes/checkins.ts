import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DailyStatus } from "../../core/types";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const redFlagsSchema = z
  .object({
    legNumbness: z.boolean().optional(),
    radiatingPain: z.boolean().optional(),
    weakness: z.boolean().optional(),
    bowelBladderChange: z.boolean().optional(),
    sharpSuddenPain: z.boolean().optional()
  })
  .optional();

const checkinSchema = z.object({
  date: z.string().min(1),
  lowBackPain: z.number().int().min(0).max(10),
  neckShoulderPain: z.number().int().min(0).max(10).optional(),
  energy: z.number().int().min(1).max(5),
  availableMinutes: z.number().int().min(1),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  steps: z.number().int().min(0).optional(),
  eatingStatus: z.enum(["poor", "normal", "good"]).optional(),
  weightKg: z.number().min(0).optional(),
  redFlags: redFlagsSchema
});

interface CheckinRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerCheckinRoutes(app: FastifyInstance, context: CheckinRouteContext): void {
  app.post("/api/checkins", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const parsed = checkinSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const checkin = await context.repositories.upsertCheckin(parsed.data as DailyStatus);
    return { checkin };
  });

  app.get("/api/checkins/recent", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const recent = await context.repositories.listRecentCheckins();
    return { checkins: recent };
  });
}
