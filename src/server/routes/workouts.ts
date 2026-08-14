import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ExerciseCompletionStatus, ExerciseResult } from "../../core/types";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const exerciseResultSchema = z.object({
  exerciseId: z.string().min(1).max(100),
  exerciseIndex: z.number().int().min(0).max(50),
  completionStatus: z.enum(["completed", "partial", "skipped"]),
  feedback: z.enum(["none", "time", "fatigue", "pain", "technique"])
});

const workoutSchema = z.object({
  completionStatus: z.enum(["completed", "partial", "skipped"]).optional(),
  notes: z.string().max(500).optional(),
  lowBackPainAfter: z.number().int().min(0).max(10).optional(),
  exerciseResults: z.array(exerciseResultSchema).max(50).optional()
});

interface WorkoutsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerWorkoutRoutes(app: FastifyInstance, context: WorkoutsRouteContext): void {
  app.post("/api/workouts/:planId/complete", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
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

    const exerciseResults = parsed.data.exerciseResults as ExerciseResult[] | undefined;
    const completionStatus = exerciseResults
      ? deriveCompletionStatus(exerciseResults)
      : (parsed.data.completionStatus ?? "completed");

    try {
      const workoutLog = await context.repositories.forUser(userId).completeWorkout({
        planId,
        completionStatus,
        notes: parsed.data.notes,
        lowBackPainAfter: parsed.data.lowBackPainAfter,
        exerciseResults
      });

      return { workoutLog };
    } catch (error) {
      if (error instanceof Error && error.message === "plan not found") {
        return reply.code(404).send({ error: "plan not found" });
      }
      if (error instanceof Error && error.message.startsWith("invalid exercise results:")) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });
}

function deriveCompletionStatus(results: ExerciseResult[]): ExerciseCompletionStatus {
  if (results.length > 0 && results.every((result) => result.completionStatus === "completed")) {
    return "completed";
  }
  if (results.length > 0 && results.every((result) => result.completionStatus === "skipped")) {
    return "skipped";
  }
  return "partial";
}
