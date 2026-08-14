import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DailyStatus } from "../../core/types";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { isoDateSchema } from "../validation";
import { getProfile } from "./profile";

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
  date: isoDateSchema,
  lowBackPain: z.number().int().min(0).max(10),
  neckShoulderPain: z.number().int().min(0).max(10).optional(),
  energy: z.number().int().min(1).max(5),
  availableMinutes: z.number().int().min(1).max(240),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  steps: z.number().int().min(0).max(200_000).optional(),
  eatingStatus: z.enum(["poor", "normal", "good"]).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  redFlags: redFlagsSchema
});

interface CheckinRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerCheckinRoutes(app: FastifyInstance, context: CheckinRouteContext): void {
  app.post("/api/checkins", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }
    const profile = await getProfile(context.repositories.db, userId);
    if (!profile?.completedAt) {
      return reply.code(409).send({ error: "onboarding required", code: "ONBOARDING_REQUIRED" });
    }

    const parsed = checkinSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const checkin = await context.repositories.forUser(userId).upsertCheckin(parsed.data as DailyStatus);
    return { checkin };
  });

  app.get("/api/checkins/recent", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const recent = await context.repositories.forUser(userId).listRecentCheckins();
    return { checkins: recent };
  });
}
