import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { explainPlan } from "../../core/plan-explanation";
import { generateDailyPlan } from "../../core/plan-generator";
import { hasRedFlag } from "../../core/readiness";
import type { AppRepositories, StoredPlanRecord } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { isoDateSchema } from "../validation";
import { getProfile } from "./profile";

const todayPlanSchema = z.object({
  date: isoDateSchema.optional()
});

const planQuerySchema = z.object({ date: isoDateSchema.optional() });

interface PlansRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerPlanRoutes(app: FastifyInstance, context: PlansRouteContext): void {
  app.post("/api/plans/today", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const repositories = context.repositories.forUser(userId);
    const profile = await getProfile(context.repositories.db, userId);
    if (!profile?.completedAt) {
      return reply.code(409).send({
        error: "onboarding required",
        code: "ONBOARDING_REQUIRED"
      });
    }
    const parsed = todayPlanSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const statusDate = parsed.data.date
      ? parsed.data.date
      : (await repositories.getLatestCheckin())?.date;

    if (!statusDate) {
      return reply.code(400).send({ error: "missing check-in" });
    }

    const status = await repositories.getCheckinByDate(statusDate);
    if (!status) {
      return reply.code(404).send({ error: "check-in not found" });
    }

    const completedMainSessionsThisWeek = await repositories.countCompletedMainSessionsThisWeek(
      status.date
    );
    const history = await repositories.getTrainingHistory(status.date);
    const plan = generateDailyPlan({
      status,
      completedMainSessionsThisWeek,
      history,
      profile
    });

    const saved = await repositories.savePlan(plan);
    const visiblePlan = applySafetyOverlay(saved, status, plan);
    return {
      plan: {
        ...visiblePlan,
        explanation: explainPlan(visiblePlan, status),
        workout: (await repositories.getWorkoutByPlanId(visiblePlan.id)) ?? null
      }
    };
  });

  app.get("/api/plans/today", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const repositories = context.repositories.forUser(userId);
    const query = planQuerySchema.safeParse(request.query ?? {});
    if (!query.success) {
      return reply.code(400).send({ error: "invalid query" });
    }

    const date = query.data.date;
    const plan = date ? await repositories.getPlanByDate(date) : await repositories.getLatestPlan();
    if (!plan) {
      return reply.code(404).send({ error: "plan not found" });
    }

    const status = await repositories.getCheckinByDate(plan.date);
    const visiblePlan = status ? applySafetyOverlay(plan, status) : plan;
    return {
      plan: {
        ...visiblePlan,
        explanation: explainPlan(visiblePlan, status),
        workout: (await repositories.getWorkoutByPlanId(visiblePlan.id)) ?? null
      }
    };
  });

  app.post("/api/plans/:planId/exercises/:exerciseId/replace", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const repositories = context.repositories.forUser(userId);
    const { planId, exerciseId } = request.params as Record<string, string>;
    const parsedPlanId = Number(planId);
    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0 || !exerciseId) {
      return reply.code(400).send({ error: "invalid plan or exercise" });
    }

    try {
      const plan = await repositories.replacePlanExercise(parsedPlanId, exerciseId);
      const status = await repositories.getCheckinByDate(plan.date);
      const visiblePlan = status ? applySafetyOverlay(plan, status) : plan;
      return { plan: { ...visiblePlan, explanation: explainPlan(visiblePlan, status) } };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "replace failed" });
    }
  });

  app.post("/api/plans/:planId/exercises/:exerciseId/revert", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const repositories = context.repositories.forUser(userId);
    const { planId, exerciseId } = request.params as Record<string, string>;
    const parsedPlanId = Number(planId);
    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0 || !exerciseId) {
      return reply.code(400).send({ error: "invalid plan or exercise" });
    }

    try {
      const plan = await repositories.revertPlanExercise(parsedPlanId, exerciseId);
      const status = await repositories.getCheckinByDate(plan.date);
      const visiblePlan = status ? applySafetyOverlay(plan, status) : plan;
      return { plan: { ...visiblePlan, explanation: explainPlan(visiblePlan, status) } };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "revert failed" });
    }
  });
}

function applySafetyOverlay(
  savedPlan: StoredPlanRecord,
  status: Parameters<typeof explainPlan>[1],
  freshlyGenerated?: StoredPlanRecord | ReturnType<typeof generateDailyPlan>
): StoredPlanRecord {
  if (!status || !hasRedFlag(status)) {
    return savedPlan;
  }
  if (savedPlan.exercises.length === 0 && savedPlan.safetyMessage?.includes("红旗")) {
    return savedPlan;
  }

  const blocked = freshlyGenerated && freshlyGenerated.decision.readinessScore === 0
    ? freshlyGenerated
    : generateDailyPlan({
        status,
        completedMainSessionsThisWeek: 0,
        history: { sessions: [] }
      });

  return {
    ...savedPlan,
    ...blocked,
    id: savedPlan.id,
    createdAt: savedPlan.createdAt
  };
}
