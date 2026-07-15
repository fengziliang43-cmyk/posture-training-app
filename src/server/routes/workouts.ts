import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const workoutSchema = z.object({
  completionStatus: z.string().min(1),
  notes: z.string().optional(),
  lowBackPainAfter: z.number().int().min(0).max(10).optional()
});

interface WorkoutsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerWorkoutRoutes(app: FastifyInstance, context: WorkoutsRouteContext): void {
  app.post("/api/workouts/:planId/complete", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const planId = Number((request.params as Record<string, string>).planId);
    if (!Number.isInteger(planId) || planId <= 0) {
      return reply.code(400).send({ error: "invalid plan id" });
    }

    const parsed = workoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const workoutLog = await context.repositories.completeWorkout({
      planId,
      completionStatus: parsed.data.completionStatus,
      notes: parsed.data.notes,
      lowBackPainAfter: parsed.data.lowBackPainAfter
    });

    return { workoutLog };
  });
}
